import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET - Get leaderboard for a pool
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  // Get all participants for this pool
  const { data: participants, error: participantsError } = await supabase
    .from("participants")
    .select("id, name")
    .eq("pool_id", id)

  if (participantsError) {
    return NextResponse.json({ error: participantsError.message }, { status: 500 })
  }

  if (!participants || participants.length === 0) {
    return NextResponse.json([])
  }

  // Get all predictions for these participants
  const participantIds = participants.map((p) => p.id)

  const { data: predictions, error: predictionsError } = await supabase
    .from("predictions")
    .select("participant_id, points")
    .in("participant_id", participantIds)

  if (predictionsError) {
    return NextResponse.json({ error: predictionsError.message }, { status: 500 })
  }

  // Calculate total points per participant
  const pointsMap: Record<string, number> = {}
  const predictionsCountMap: Record<string, number> = {}

  predictions?.forEach((prediction) => {
    if (!pointsMap[prediction.participant_id]) {
      pointsMap[prediction.participant_id] = 0
      predictionsCountMap[prediction.participant_id] = 0
    }
    pointsMap[prediction.participant_id] += prediction.points || 0
    predictionsCountMap[prediction.participant_id] += 1
  })

  // Build leaderboard
  const leaderboard = participants.map((participant) => ({
    id: participant.id,
    name: participant.name,
    points: pointsMap[participant.id] || 0,
    predictions_count: predictionsCountMap[participant.id] || 0,
  }))

  // Sort by points descending
  leaderboard.sort((a, b) => b.points - a.points)

  // Add rank
  const rankedLeaderboard = leaderboard.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }))

  return NextResponse.json(rankedLeaderboard)
}
