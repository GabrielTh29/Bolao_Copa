import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// POST - Join a pool
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  const { name } = body

  if (!name) {
    return NextResponse.json({ error: "Nome e obrigatorio" }, { status: 400 })
  }

  // Check if pool exists
  const { data: pool, error: poolError } = await supabase.from("pools").select("id").eq("id", id).single()

  if (poolError || !pool) {
    return NextResponse.json({ error: "Bolao nao encontrado" }, { status: 404 })
  }

  // Check if participant already exists
  const { data: existing } = await supabase
    .from("participants")
    .select("id")
    .eq("pool_id", id)
    .eq("name", name)
    .single()

  if (existing) {
    return NextResponse.json({ error: "Ja existe um participante com esse nome neste bolao" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("participants")
    .insert({
      pool_id: id,
      name,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
