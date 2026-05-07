// Script para sincronizar jogos da Copa do Mundo
// Execute com: npx tsx scripts/sync-world-cup.ts

import { createClient } from "@supabase/supabase-js"

const FOOTBALL_DATA_API_URL = "https://api.football-data.org/v4"
const API_KEY = process.env.FOOTBALL_DATA_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing environment variables")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

interface Team {
  id: number
  name: string
  tla: string
  crest: string
}

interface Match {
  id: number
  utcDate: string
  status: string
  stage: string
  group: string | null
  homeTeam: Team
  awayTeam: Team
  score: {
    fullTime: { home: number | null; away: number | null }
  }
}

function mapStatus(status: string): "scheduled" | "live" | "finished" {
  if (status === "IN_PLAY" || status === "PAUSED") return "live"
  if (status === "FINISHED") return "finished"
  return "scheduled"
}

function mapStage(stage: string): string {
  const stageMap: Record<string, string> = {
    GROUP_STAGE: "Grupos",
    ROUND_OF_16: "Oitavas de Final",
    QUARTER_FINALS: "Quartas de Final",
    SEMI_FINALS: "Semifinais",
    THIRD_PLACE: "Disputa 3o Lugar",
    FINAL: "Final",
  }
  return stageMap[stage] || stage
}

async function syncWorldCup() {
  console.log("Buscando times da Copa do Mundo...")
  
  // Fetch teams
  const teamsRes = await fetch(`${FOOTBALL_DATA_API_URL}/competitions/WC/teams`, {
    headers: { "X-Auth-Token": API_KEY! },
  })
  
  if (!teamsRes.ok) {
    console.error("Erro ao buscar times:", await teamsRes.text())
    return
  }
  
  const teamsData = await teamsRes.json()
  const teams: Team[] = teamsData.teams
  
  console.log(`Encontrados ${teams.length} times`)
  
  // Insert teams
  for (const team of teams) {
    const { error } = await supabase
      .from("teams")
      .upsert({
        name: team.name,
        short_code: team.tla,
        flag_url: team.crest,
      }, { onConflict: "short_code" })
    
    if (error) {
      console.error(`Erro ao inserir time ${team.name}:`, error.message)
    }
  }
  
  console.log("Times sincronizados!")
  
  // Fetch matches
  console.log("Buscando jogos da Copa do Mundo...")
  
  const matchesRes = await fetch(`${FOOTBALL_DATA_API_URL}/competitions/WC/matches`, {
    headers: { "X-Auth-Token": API_KEY! },
  })
  
  if (!matchesRes.ok) {
    console.error("Erro ao buscar jogos:", await matchesRes.text())
    return
  }
  
  const matchesData = await matchesRes.json()
  const matches: Match[] = matchesData.matches
  
  console.log(`Encontrados ${matches.length} jogos`)
  
  // Get team IDs from DB
  const { data: dbTeams } = await supabase.from("teams").select("id, short_code")
  const teamMap = new Map(dbTeams?.map((t) => [t.short_code, t.id]) || [])
  
  let inserted = 0
  let updated = 0
  
  for (const match of matches) {
    const homeTeamId = teamMap.get(match.homeTeam.tla)
    const awayTeamId = teamMap.get(match.awayTeam.tla)
    
    if (!homeTeamId || !awayTeamId) {
      console.log(`Pulando jogo: time nao encontrado - ${match.homeTeam.tla} vs ${match.awayTeam.tla}`)
      continue
    }
    
    // Check if match exists
    const { data: existing } = await supabase
      .from("matches")
      .select("id")
      .eq("home_team_id", homeTeamId)
      .eq("away_team_id", awayTeamId)
      .eq("match_date", match.utcDate)
      .single()
    
    if (existing) {
      // Update
      await supabase
        .from("matches")
        .update({
          status: mapStatus(match.status),
          home_score: match.score.fullTime.home,
          away_score: match.score.fullTime.away,
        })
        .eq("id", existing.id)
      updated++
    } else {
      // Insert
      await supabase.from("matches").insert({
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        home_score: match.score.fullTime.home,
        away_score: match.score.fullTime.away,
        match_date: match.utcDate,
        stage: mapStage(match.stage),
        group_name: match.group ? `Grupo ${match.group.replace("GROUP_", "")}` : null,
        status: mapStatus(match.status),
      })
      inserted++
    }
  }
  
  console.log(`Sincronizacao concluida! ${inserted} jogos inseridos, ${updated} atualizados.`)
}

syncWorldCup().catch(console.error)
