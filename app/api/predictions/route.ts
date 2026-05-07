import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET - Get predictions for a participant
export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const participantId = searchParams.get("participant_id")
  const poolId = searchParams.get("pool_id")

  if (!participantId && !poolId) {
    return NextResponse.json({ error: "participant_id ou pool_id e obrigatorio" }, { status: 400 })
  }

  let query = supabase.from("predictions").select(
    `
      *,
      match:matches(
        *,
        home_team:teams!matches_home_team_id_fkey(id, name, short_code),
        away_team:teams!matches_away_team_id_fkey(id, name, short_code)
      ),
      participant:participants(id, name, pool_id)
    `
  )

  if (participantId) {
    query = query.eq("participant_id", participantId)
  }

  if (poolId) {
    // Get all predictions for all participants in this pool
    const { data: participants } = await supabase.from("participants").select("id").eq("pool_id", poolId)

    if (participants && participants.length > 0) {
      const participantIds = participants.map((p) => p.id)
      query = query.in("participant_id", participantIds)
    }
  }

  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// POST - Create or update a prediction
export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  const { participant_id, match_id, home_score, away_score } = body

  if (!participant_id || !match_id || home_score === undefined || away_score === undefined) {
    return NextResponse.json({ error: "Todos os campos sao obrigatorios" }, { status: 400 })
  }

  // Check if match hasn't started yet
  const { data: match } = await supabase.from("matches").select("match_date, status").eq("id", match_id).single()

  if (!match) {
    return NextResponse.json({ error: "Jogo nao encontrado" }, { status: 404 })
  }

  if (match.status !== "scheduled") {
    return NextResponse.json({ error: "Nao e possivel fazer palpites para jogos que ja comecaram" }, { status: 400 })
  }

  const matchDate = new Date(match.match_date)
  if (matchDate <= new Date()) {
    return NextResponse.json({ error: "Nao e possivel fazer palpites para jogos que ja comecaram" }, { status: 400 })
  }

  // Upsert prediction
  const { data, error } = await supabase
    .from("predictions")
    .upsert(
      {
        participant_id,
        match_id,
        home_score,
        away_score,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "participant_id,match_id",
      }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
