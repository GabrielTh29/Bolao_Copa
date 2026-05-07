import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET - Get pool details with participants
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  const { data: pool, error: poolError } = await supabase.from("pools").select("*").eq("id", id).single()

  if (poolError || !pool) {
    return NextResponse.json({ error: "Bolao nao encontrado" }, { status: 404 })
  }

  const { data: participants, error: participantsError } = await supabase
    .from("participants")
    .select("*")
    .eq("pool_id", id)
    .order("created_at", { ascending: true })

  if (participantsError) {
    return NextResponse.json({ error: participantsError.message }, { status: 500 })
  }

  return NextResponse.json({ ...pool, participants })
}
