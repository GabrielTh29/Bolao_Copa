import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit"

// GET - Get predictions for a participant
export async function GET(request: Request) {
  // Rate limit check
  const ip = getClientIdentifier(request)
  const { success, response } = await checkRateLimit(ip, "api")
  if (!success && response) return response
  
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
  // Rate limit check for predictions
  const ip = getClientIdentifier(request)
  const { success, response } = await checkRateLimit(ip, "predictions")
  if (!success && response) return response
  
  const supabase = await createClient()
  const body = await request.json()

  const { participant_id, match_id, home_score, away_score } = body

  if (!participant_id || !match_id || home_score === undefined || away_score === undefined) {
    return NextResponse.json({ error: "Todos os campos sao obrigatorios" }, { status: 400 })
  }

  // Validate scores are non-negative integers
  if (!Number.isInteger(home_score) || !Number.isInteger(away_score) || home_score < 0 || away_score < 0) {
    return NextResponse.json({ error: "Placares devem ser numeros inteiros nao negativos" }, { status: 400 })
  }

  // Verify participant exists
  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("id")
    .eq("id", participant_id)
    .single()

  if (participantError || !participant) {
    return NextResponse.json({ error: "Participante nao encontrado" }, { status: 404 })
  }

  // Check if match hasn't started yet
  const { data: match } = await supabase.from("matches").select("match_date, status").eq("id", match_id).single()

  if (!match) {
    return NextResponse.json({ error: "Jogo nao encontrado" }, { status: 404 })
  }

  if (match.status !== "scheduled") {
    return NextResponse.json({ error: "Nao e possivel fazer palpites para jogos que ja comecaram" }, { status: 400 })
  }

  // Predictions close 1 minute before kickoff
  const matchDate = new Date(match.match_date)
  const deadline = new Date(matchDate.getTime() - 60 * 1000)
  if (new Date() >= deadline) {
    return NextResponse.json(
      { error: "Os palpites para este jogo ja foram encerrados (fecham 1 minuto antes do inicio)" },
      { status: 400 },
    )
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
