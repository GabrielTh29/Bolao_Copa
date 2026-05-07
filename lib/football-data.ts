const FOOTBALL_DATA_API_URL = "https://api.football-data.org/v4"
const API_KEY = process.env.FOOTBALL_DATA_API_KEY

// Competition codes
export const COMPETITIONS = {
  WORLD_CUP: "WC", // FIFA World Cup
  EURO: "EC", // European Championship
  COPA_AMERICA: "CA", // Copa America
  PREMIER_LEAGUE: "PL",
  LA_LIGA: "PD",
  SERIE_A: "SA",
  BUNDESLIGA: "BL1",
  LIGUE_1: "FL1",
  CHAMPIONS_LEAGUE: "CL",
} as const

export type CompetitionCode = (typeof COMPETITIONS)[keyof typeof COMPETITIONS]

// Types from Football-Data.org API
export interface FootballDataTeam {
  id: number
  name: string
  shortName: string
  tla: string // 3-letter abbreviation
  crest: string // Flag/logo URL
}

export interface FootballDataScore {
  home: number | null
  away: number | null
}

export interface FootballDataMatch {
  id: number
  utcDate: string
  status: "SCHEDULED" | "TIMED" | "IN_PLAY" | "PAUSED" | "FINISHED" | "SUSPENDED" | "POSTPONED" | "CANCELLED"
  matchday: number
  stage: string
  group: string | null
  homeTeam: FootballDataTeam
  awayTeam: FootballDataTeam
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null
    duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT"
    fullTime: FootballDataScore
    halfTime: FootballDataScore
  }
}

export interface FootballDataResponse {
  competition: {
    id: number
    name: string
    code: string
  }
  matches: FootballDataMatch[]
}

// Map Football-Data status to our status
function mapStatus(status: FootballDataMatch["status"]): "scheduled" | "live" | "finished" {
  switch (status) {
    case "IN_PLAY":
    case "PAUSED":
      return "live"
    case "FINISHED":
      return "finished"
    default:
      return "scheduled"
  }
}

// Map stage names to Portuguese
function mapStage(stage: string): string {
  const stageMap: Record<string, string> = {
    GROUP_STAGE: "Grupos",
    ROUND_OF_16: "Oitavas de Final",
    QUARTER_FINALS: "Quartas de Final",
    SEMI_FINALS: "Semifinais",
    THIRD_PLACE: "Disputa 3º Lugar",
    FINAL: "Final",
  }
  return stageMap[stage] || stage
}

// Fetch matches from Football-Data.org
export async function fetchMatches(competition: CompetitionCode = COMPETITIONS.WORLD_CUP): Promise<FootballDataMatch[]> {
  if (!API_KEY) {
    throw new Error("FOOTBALL_DATA_API_KEY is not configured")
  }

  const response = await fetch(`${FOOTBALL_DATA_API_URL}/competitions/${competition}/matches`, {
    headers: {
      "X-Auth-Token": API_KEY,
    },
    next: { revalidate: 60 }, // Cache for 1 minute
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Football-Data API error: ${response.status} - ${error}`)
  }

  const data: FootballDataResponse = await response.json()
  return data.matches
}

// Fetch teams from a competition
export async function fetchTeams(competition: CompetitionCode = COMPETITIONS.WORLD_CUP): Promise<FootballDataTeam[]> {
  if (!API_KEY) {
    throw new Error("FOOTBALL_DATA_API_KEY is not configured")
  }

  const response = await fetch(`${FOOTBALL_DATA_API_URL}/competitions/${competition}/teams`, {
    headers: {
      "X-Auth-Token": API_KEY,
    },
    next: { revalidate: 3600 }, // Cache for 1 hour
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Football-Data API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.teams
}

// Transform Football-Data match to our format
export function transformMatch(match: FootballDataMatch) {
  return {
    external_id: match.id,
    home_team_name: match.homeTeam.name,
    home_team_code: match.homeTeam.tla,
    home_team_flag: match.homeTeam.crest,
    away_team_name: match.awayTeam.name,
    away_team_code: match.awayTeam.tla,
    away_team_flag: match.awayTeam.crest,
    home_score: match.score.fullTime.home,
    away_score: match.score.fullTime.away,
    match_date: match.utcDate,
    stage: mapStage(match.stage),
    group_name: match.group ? `Grupo ${match.group.replace("GROUP_", "")}` : null,
    status: mapStatus(match.status),
  }
}

// Transform Football-Data team to our format
export function transformTeam(team: FootballDataTeam) {
  return {
    name: team.name,
    short_code: team.tla,
    flag_url: team.crest,
  }
}
