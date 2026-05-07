import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// Generate a random invite code
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// GET - List all pools or get pool by invite code
export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const inviteCode = searchParams.get("invite_code")

  if (inviteCode) {
    const { data, error } = await supabase
      .from("pools")
      .select("*")
      .eq("invite_code", inviteCode.toUpperCase())
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Bolao nao encontrado" }, { status: 404 })
    }

    return NextResponse.json(data)
  }

  const { data, error } = await supabase.from("pools").select("*").order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// POST - Create a new pool
export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  const { 
    name, 
    admin_name,
    admin_password,
    points_exact = 10,
    points_result_one_score = 5,
    points_result_goal_diff = 4,
    points_result_only = 3,
    points_exact_opposite = -5
  } = body

  if (!name || !admin_name) {
    return NextResponse.json({ error: "Nome do bolao e nome do administrador sao obrigatorios" }, { status: 400 })
  }

  if (!admin_password) {
    return NextResponse.json({ error: "Senha do administrador e obrigatoria" }, { status: 400 })
  }

  // Generate unique invite code
  let inviteCode = generateInviteCode()
  let attempts = 0

  while (attempts < 10) {
    const { data: existing } = await supabase.from("pools").select("id").eq("invite_code", inviteCode).single()

    if (!existing) break
    inviteCode = generateInviteCode()
    attempts++
  }

  const { data, error } = await supabase
    .from("pools")
    .insert({
      name,
      admin_name,
      invite_code: inviteCode,
      points_exact,
      points_result_one_score,
      points_result_goal_diff,
      points_result_only,
      points_exact_opposite,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Also add admin as first participant with password
  await supabase.from("participants").insert({
    pool_id: data.id,
    name: admin_name,
    password: admin_password,
  })

  return NextResponse.json(data, { status: 201 })
}

// PATCH - Update pool settings (only admin)
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  const { 
    pool_id,
    points_exact,
    points_result_one_score,
    points_result_goal_diff,
    points_result_only,
    points_exact_opposite
  } = body

  if (!pool_id) {
    return NextResponse.json({ error: "pool_id e obrigatorio" }, { status: 400 })
  }

  const updateData: Record<string, number> = {}
  if (points_exact !== undefined) updateData.points_exact = points_exact
  if (points_result_one_score !== undefined) updateData.points_result_one_score = points_result_one_score
  if (points_result_goal_diff !== undefined) updateData.points_result_goal_diff = points_result_goal_diff
  if (points_result_only !== undefined) updateData.points_result_only = points_result_only
  if (points_exact_opposite !== undefined) updateData.points_exact_opposite = points_exact_opposite

  const { data, error } = await supabase
    .from("pools")
    .update(updateData)
    .eq("id", pool_id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
