import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { hashPassword, verifyPassword, isBcryptHash } from "@/lib/auth"
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit"
import { getSession } from "@/lib/session"
import { cookies } from "next/headers"

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
  // Rate limit check
  const ip = getClientIdentifier(request)
  const { success, response } = await checkRateLimit(ip, "api")
  if (!success && response) return response
  
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
  // Rate limit check
  const ip = getClientIdentifier(request)
  const { success, response } = await checkRateLimit(ip, "api")
  if (!success && response) return response
  
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

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Nome do bolao e obrigatorio" }, { status: 400 })
  }

  if (!admin_name || typeof admin_name !== "string" || admin_name.trim().length === 0) {
    return NextResponse.json({ error: "Nome do administrador e obrigatorio" }, { status: 400 })
  }

  if (!admin_password || typeof admin_password !== "string" || admin_password.length < 4) {
    return NextResponse.json({ error: "Senha do administrador deve ter pelo menos 4 caracteres" }, { status: 400 })
  }

  // Validate point values
  const pointFields = { points_exact, points_result_one_score, points_result_goal_diff, points_result_only, points_exact_opposite }
  for (const [field, value] of Object.entries(pointFields)) {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      return NextResponse.json({ error: `${field} deve ser um numero inteiro` }, { status: 400 })
    }
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
      name: name.trim(),
      admin_name: admin_name.trim(),
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

  // Hash the admin password before storing
  const hashedPassword = await hashPassword(admin_password)

  // Check if admin name already exists in this pool (case-insensitive)
  const { data: existingParticipant } = await supabase
    .from("participants")
    .select("id, name")
    .eq("pool_id", data.id)
    .ilike("name", admin_name.trim())
    .single()

  if (existingParticipant) {
    // This should not happen for a new pool, but check anyway
    return NextResponse.json({ error: "Este usuário já existe" }, { status: 409 })
  }

  // Also add admin as first participant with hashed password
  await supabase.from("participants").insert({
    pool_id: data.id,
    name: admin_name.trim(),
    password_hash: hashedPassword,
  })

  return NextResponse.json(data, { status: 201 })
}

// PATCH - Update pool settings (requires admin authentication)
export async function PATCH(request: Request) {
  // Rate limit check
  const ip = getClientIdentifier(request)
  const { success, response } = await checkRateLimit(ip, "api")
  if (!success && response) return response
  
  const supabase = await createClient()
  const body = await request.json()

  const { 
    pool_id,
    admin_name,
    admin_password,
    points_exact,
    points_result_one_score,
    points_result_goal_diff,
    points_result_only,
    points_exact_opposite
  } = body

  if (!pool_id) {
    return NextResponse.json({ error: "pool_id e obrigatorio" }, { status: 400 })
  }

  // Require admin authentication - try session cookie first, then body
  let passwordToVerify = admin_password
  let adminNameToVerify = admin_name
  
  if (!passwordToVerify || !adminNameToVerify) {
    const cookieStore = await cookies()
    const session = await getSession(cookieStore)
    if (session) {
      passwordToVerify = passwordToVerify || session.password
      adminNameToVerify = adminNameToVerify || session.participantName
    }
  }

  if (!adminNameToVerify || !passwordToVerify) {
    return NextResponse.json({ error: "Credenciais de administrador sao obrigatorias" }, { status: 401 })
  }

  // Get the pool to find admin info
  const { data: pool, error: poolError } = await supabase
    .from("pools")
    .select("id, admin_name")
    .eq("id", pool_id)
    .single()

  if (poolError || !pool) {
    return NextResponse.json({ error: "Bolao nao encontrado" }, { status: 404 })
  }

  // Verify admin is the pool admin (case-insensitive comparison)
  if (pool.admin_name.toLowerCase() !== adminNameToVerify.toLowerCase()) {
    return NextResponse.json({ error: "Apenas o administrador pode alterar configuracoes" }, { status: 403 })
  }

  // Get admin participant to verify password (case-insensitive)
  const { data: adminParticipant } = await supabase
    .from("participants")
    .select("id, password_hash")
    .eq("pool_id", pool_id)
    .ilike("name", adminNameToVerify)
    .single()

  if (!adminParticipant || !adminParticipant.password_hash) {
    return NextResponse.json({ error: "Erro de autenticacao" }, { status: 401 })
  }

  // Verify password
  let isValid = false
  if (isBcryptHash(adminParticipant.password_hash)) {
    isValid = await verifyPassword(passwordToVerify, adminParticipant.password_hash)
  } else {
    // Legacy plaintext password - verify and migrate
    isValid = adminParticipant.password_hash === passwordToVerify
    if (isValid) {
      const newHash = await hashPassword(passwordToVerify)
      await supabase
        .from("participants")
        .update({ password_hash: newHash })
        .eq("id", adminParticipant.id)
    }
  }

  if (!isValid) {
    return NextResponse.json({ error: "Senha incorreta" }, { status: 401 })
  }

  // Validate and build update data
  const updateData: Record<string, number> = {}
  
  const updates = [
    { key: "points_exact", value: points_exact },
    { key: "points_result_one_score", value: points_result_one_score },
    { key: "points_result_goal_diff", value: points_result_goal_diff },
    { key: "points_result_only", value: points_result_only },
    { key: "points_exact_opposite", value: points_exact_opposite },
  ]

  for (const { key, value } of updates) {
    if (value !== undefined) {
      if (typeof value !== "number" || !Number.isInteger(value)) {
        return NextResponse.json({ error: `${key} deve ser um numero inteiro` }, { status: 400 })
      }
      updateData[key] = value
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Nenhuma alteracao fornecida" }, { status: 400 })
  }

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
