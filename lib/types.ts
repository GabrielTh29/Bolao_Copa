export interface Pool {
  id: string
  name: string
  invite_code: string
  admin_name: string
  created_at: string
  points_exact: number
  points_result_one_score: number
  points_result_goal_diff: number
  points_result_only: number
  points_exact_opposite: number
}

export interface PointsConfig {
  points_exact: number
  points_result_one_score: number
  points_result_goal_diff: number
  points_result_only: number
  points_exact_opposite: number
}

export interface Participant {
  id: string
  pool_id: string
  name: string
  created_at: string
  total_points?: number
}

export interface Team {
  id: string
  name: string
  flag_url: string | null
  short_code: string
}

export interface Match {
  id: string
  home_team_id: string
  away_team_id: string
  home_score: number | null
  away_score: number | null
  match_date: string
  stage: string
  group_name: string | null
  status: 'scheduled' | 'live' | 'finished'
  created_at: string
  home_team?: Team
  away_team?: Team
}

export interface Prediction {
  id: string
  participant_id: string
  match_id: string
  home_score: number
  away_score: number
  points: number
  created_at: string
  updated_at: string
  match?: Match
}

export interface LeaderboardEntry {
  participant_id: string
  name: string
  total_points: number
  exact_scores: number
  correct_results: number
}
