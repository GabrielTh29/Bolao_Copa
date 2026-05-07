import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import {
  fetchMatches,
  fetchTeams,
  transformMatch,
  transformTeam,
  COMPETITIONS,
} from "@/lib/football-data"

// Vercel Cron Job - runs automatically to sync matches
// This endpoint is protected by CRON_SECRET
export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = await createClient()
    const competition = COMPETITIONS.WORLD_CUP

    // 1. Fetch and sync teams
    const apiTeams = await fetchTeams(competition)
    const transformedTeams = apiTeams.map(transformTeam)

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
    let pointsCalculated = 0

    for (const match of transformedMatches) {
      const homeTeamId = teamMap.get(match.home_team_code)
      const awayTeamId = teamMap.get(match.away_team_code)

      if (!homeTeamId || !awayTeamId) continue

      const { data: existingMatch } = await supabase
        .from("matches")
        .select("id, status, home_score, away_score")
        .eq("home_team_id", homeTeamId)
        .eq("away_team_id", awayTeamId)
        .eq("match_date", match.match_date)
        .single()

      if (existingMatch) {
        if (
          existingMatch.status !== match.status ||
          existingMatch.home_score !== match.home_score ||
          existingMatch.away_score !== match.away_score
        ) {
          await supabase
            .from("matches")
            .update({
              status: match.status,
              home_score: match.home_score,
              away_score: match.away_score,
            })
            .eq("id", existingMatch.id)

          // If match just finished, calculate points
          if (match.status === "finished" && existingMatch.status !== "finished") {
            await calculateMatchPoints(supabase, existingMatch.id, match.home_score!, match.away_score!)
            pointsCalculated++
          }

          updatedCount++
        }
      } else {
        await supabase.from("matches").insert({
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

    // Log sync result
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      teams: transformedTeams.length,
      matchesSynced: syncedCount,
      matchesUpdated: updatedCount,
      pointsCalculated,
    }

    console.log("[Cron] Sync completed:", result)

    return NextResponse.json(result)
  } catch (error) {
    console.error("[Cron] Sync error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao sincronizar" },
      { status: 500 }
    )
  }
}

// Calculate points for predictions (same logic as manual sync)
async function calculateMatchPoints(
  supabase: Awaited<ReturnType<typeof createClient>>,
  matchId: string,
  actualHomeScore: number,
  actualAwayScore: number
) {
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

  const actualResult =
    actualHomeScore > actualAwayScore ? "home" : actualHomeScore < actualAwayScore ? "away" : "draw"
  const actualGoalDiff = actualHomeScore - actualAwayScore

  for (const prediction of predictions) {
    let points = 0
    
    const poolConfig = (prediction as { participant?: { pool?: { points_exact?: number; points_result_one_score?: number; points_result_goal_diff?: number; points_result_only?: number; points_exact_opposite?: number } } }).participant?.pool
    const pointsExact = poolConfig?.points_exact ?? 10
    const pointsResultOneScore = poolConfig?.points_result_one_score ?? 5
    const pointsResultGoalDiff = poolConfig?.points_result_goal_diff ?? 4
    const pointsResultOnly = poolConfig?.points_result_only ?? 3
    const pointsExactOpposite = poolConfig?.points_exact_opposite ?? -5

    const predictedResult =
      prediction.home_score > prediction.away_score
        ? "home"
        : prediction.home_score < prediction.away_score
          ? "away"
          : "draw"
    const predictedGoalDiff = prediction.home_score - prediction.away_score

    if (prediction.home_score === actualHomeScore && prediction.away_score === actualAwayScore) {
      points = pointsExact
    } else if (
      predictedResult === actualResult &&
      (prediction.home_score === actualHomeScore || prediction.away_score === actualAwayScore)
    ) {
      points = pointsResultOneScore
    } else if (
      predictedResult === actualResult &&
      predictedResult !== "draw" &&
      predictedGoalDiff === actualGoalDiff
    ) {
      points = pointsResultGoalDiff
    } else if (predictedResult === actualResult) {
      points = pointsResultOnly
    } else if (
      actualResult !== "draw" &&
      prediction.home_score === actualAwayScore &&
      prediction.away_score === actualHomeScore
    ) {
      points = pointsExactOpposite
    }

    await supabase.from("predictions").update({ points }).eq("id", prediction.id)
  }
}
