import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import {
  fetchMatches,
  fetchTeams,
  transformMatch,
  transformTeam,
  COMPETITIONS,
  type CompetitionCode,
} from "@/lib/football-data"
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit"

// POST - Sync matches and teams from Football-Data.org
export async function POST(request: Request) {
  // Rate limit check for sync (heavy operation)
  const ip = getClientIdentifier(request)
  const { success, response } = await checkRateLimit(ip, "sync")
  if (!success && response) return response
  
  try {
    const body = await request.json().catch(() => ({}))
    const competition = (body.competition || COMPETITIONS.WORLD_CUP) as CompetitionCode

    const supabase = await createClient()

    // 1. Fetch and sync teams
    const apiTeams = await fetchTeams(competition)
    const transformedTeams = apiTeams.map(transformTeam)

    // Upsert teams (insert or update if exists)
    for (const team of transformedTeams) {
      await supabase
        .from("teams")
        .upsert(team, { onConflict: "short_code" })
    }

    // 2. Get all teams from DB to map names to IDs
    const { data: dbTeams } = await supabase.from("teams").select("id, short_code")
    const teamMap = new Map(dbTeams?.map((t) => [t.short_code, t.id]) || [])

    // 3. Fetch and sync matches
    const apiMatches = await fetchMatches(competition)
    const transformedMatches = apiMatches.map(transformMatch)

    let syncedCount = 0
    let updatedCount = 0

    for (const match of transformedMatches) {
      const homeTeamId = teamMap.get(match.home_team_code)
      const awayTeamId = teamMap.get(match.away_team_code)

      if (!homeTeamId || !awayTeamId) {
        console.log(`[v0] Skipping match: team not found - ${match.home_team_code} vs ${match.away_team_code}`)
        continue
      }

      // Find existing match. Primary key is the external_id from the API,
      // which is stable even if the kickoff time changes. Fall back to the
      // legacy lookup (teams + date) for matches saved before external_id existed.
      let existingMatch: {
        id: string
        status: string
        home_score: number | null
        away_score: number | null
      } | null = null

      if (match.external_id != null) {
        const { data } = await supabase
          .from("matches")
          .select("id, status, home_score, away_score")
          .eq("external_id", match.external_id)
          .maybeSingle()
        existingMatch = data
      }

      if (!existingMatch) {
        const { data } = await supabase
          .from("matches")
          .select("id, status, home_score, away_score")
          .eq("home_team_id", homeTeamId)
          .eq("away_team_id", awayTeamId)
          .eq("match_date", match.match_date)
          .maybeSingle()
        existingMatch = data
      }

      if (existingMatch) {
        // Update existing match if anything relevant changed (status, scores,
        // kickoff time, or backfilling the external_id on legacy rows).
        await supabase
          .from("matches")
          .update({
            external_id: match.external_id,
            status: match.status,
            home_score: match.home_score,
            away_score: match.away_score,
            match_date: match.match_date,
            stage: match.stage,
            group_name: match.group_name,
          })
          .eq("id", existingMatch.id)

        // If match just finished, calculate points for predictions
        if (match.status === "finished" && existingMatch.status !== "finished") {
          await calculateMatchPoints(supabase, existingMatch.id, match.home_score!, match.away_score!)
        }

        updatedCount++
      } else {
        // Insert new match
        await supabase.from("matches").insert({
          external_id: match.external_id,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          home_score: match.home_score,
          away_score: match.away_score,
          match_date: match.match_date,
          stage: match.stage,
          group_name: match.group_name,
          status: match.status,
        })
        syncedCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sincronizacao concluida`,
      teams: transformedTeams.length,
      matchesSynced: syncedCount,
      matchesUpdated: updatedCount,
    })
  } catch (error) {
    console.error("[v0] Sync error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao sincronizar dados" },
      { status: 500 }
    )
  }
}

// Calculate points for all predictions of a finished match
async function calculateMatchPoints(
  supabase: Awaited<ReturnType<typeof createClient>>,
  matchId: string,
  actualHomeScore: number,
  actualAwayScore: number
) {
  // Get all predictions for this match with participant info to get pool settings
  const { data: predictions } = await supabase
    .from("predictions")
    .select(`
      id, 
      home_score, 
      away_score,
      participant:participants(
        pool_id,
        pool:pools(
          points_exact,
          points_result_one_score,
          points_result_goal_diff,
          points_result_only,
          points_exact_opposite
        )
      )
    `)
    .eq("match_id", matchId)

  if (!predictions) return

  // Determine actual result and goal difference
  const actualResult =
    actualHomeScore > actualAwayScore ? "home" : actualHomeScore < actualAwayScore ? "away" : "draw"
  const actualGoalDiff = actualHomeScore - actualAwayScore

  for (const prediction of predictions) {
    let points = 0
    
    // Get pool-specific point values or use defaults
    const poolConfig = (prediction as { participant?: { pool?: { points_exact?: number; points_result_one_score?: number; points_result_goal_diff?: number; points_result_only?: number; points_exact_opposite?: number } } }).participant?.pool
    const pointsExact = poolConfig?.points_exact ?? 10
    const pointsResultOneScore = poolConfig?.points_result_one_score ?? 5
    const pointsResultGoalDiff = poolConfig?.points_result_goal_diff ?? 4
    const pointsResultOnly = poolConfig?.points_result_only ?? 3
    const pointsExactOpposite = poolConfig?.points_exact_opposite ?? -5

    // Determine predicted result and goal difference
    const predictedResult =
      prediction.home_score > prediction.away_score
        ? "home"
        : prediction.home_score < prediction.away_score
          ? "away"
          : "draw"
    const predictedGoalDiff = prediction.home_score - prediction.away_score

    // Exact score - highest points
    if (prediction.home_score === actualHomeScore && prediction.away_score === actualAwayScore) {
      points = pointsExact
    }
    // Correct result with one correct score
    else if (
      predictedResult === actualResult &&
      (prediction.home_score === actualHomeScore || prediction.away_score === actualAwayScore)
    ) {
      points = pointsResultOneScore
    }
    // Correct result with correct goal difference (NOT for draws)
    else if (
      predictedResult === actualResult &&
      predictedResult !== "draw" &&
      predictedGoalDiff === actualGoalDiff
    ) {
      points = pointsResultGoalDiff
    }
    // Correct result only
    else if (predictedResult === actualResult) {
      points = pointsResultOnly
    }
    // Exact opposite score penalty (NOT for draws) - e.g., predicted 2-1 but result was 1-2
    else if (
      actualResult !== "draw" &&
      prediction.home_score === actualAwayScore &&
      prediction.away_score === actualHomeScore
    ) {
      points = pointsExactOpposite
    }

    // Update prediction points
    await supabase.from("predictions").update({ points }).eq("id", prediction.id)
  }
}

// GET - Get sync status / last sync info
export async function GET() {
  return NextResponse.json({
    available_competitions: COMPETITIONS,
    default: "WC",
    instructions: "POST para sincronizar. Envie { competition: 'WC' } para Copa do Mundo.",
  })
}
