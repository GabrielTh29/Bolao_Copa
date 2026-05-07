import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET - List all matches with team info
export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("matches")
    .select(
      `
      *,
      home_team:teams!matches_home_team_id_fkey(id, name, short_code, flag_url),
      away_team:teams!matches_away_team_id_fkey(id, name, short_code, flag_url)
    `
    )
    .order("match_date", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
