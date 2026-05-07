import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// POST - Join a pool
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  const { name, password } = body

  if (!name) {
    return NextResponse.json({ error: "Nome e obrigatorio" }, { status: 400 })
  }

  if (!password) {
    return NextResponse.json({ error: "Senha e obrigatoria" }, { status: 400 })
  }

  // Check if pool exists
  const { data: pool, error: poolError } = await supabase.from("pools").select("id").eq("id", id).single()

  if (poolError || !pool) {
    return NextResponse.json({ error: "Bolao nao encontrado" }, { status: 404 })
  }

  // Check if participant already exists
  const { data: existing } = await supabase
    .from("participants")
    .select("id, name, password")
    .eq("pool_id", id)
    .eq("name", name)
    .single()

  if (existing) {
    // User exists - verify password
    if (existing.password !== password) {
      return NextResponse.json({ error: "Senha incorreta. Se voce esqueceu sua senha, entre em contato com o administrador." }, { status: 401 })
    }
    // Password correct - return existing participant
    return NextResponse.json({ id: existing.id, name: existing.name }, { status: 200 })
  }

  // Create new participant with password
  const { data, error } = await supabase
    .from("participants")
    .insert({
      pool_id: id,
      name,
      password,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
