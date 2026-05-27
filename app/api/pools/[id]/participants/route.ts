import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { hashPassword, verifyPassword, isBcryptHash } from "@/lib/auth"
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit"

// POST - Join a pool
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Rate limit check for auth endpoints
  const ip = getClientIdentifier(request)
  const { success, response } = await checkRateLimit(ip, "auth")
  if (!success && response) return response
  
  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  const { name, password } = body

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Nome e obrigatorio" }, { status: 400 })
  }

  if (!password || typeof password !== "string" || password.length < 4) {
    return NextResponse.json({ error: "Senha deve ter pelo menos 4 caracteres" }, { status: 400 })
  }

  // Check if pool exists
  const { data: pool, error: poolError } = await supabase.from("pools").select("id").eq("id", id).single()

  if (poolError || !pool) {
    return NextResponse.json({ error: "Bolao nao encontrado" }, { status: 404 })
  }

  // Check if participant already exists - only select id and password_hash
  const { data: existing } = await supabase
    .from("participants")
    .select("id, name, password_hash")
    .eq("pool_id", id)
    .eq("name", name.trim())
    .single()

  if (existing) {
    // User exists - verify password
    const storedHash = existing.password_hash
    
    if (!storedHash) {
      return NextResponse.json({ error: "Erro de autenticacao. Entre em contato com o administrador." }, { status: 401 })
    }

    // Handle backwards compatibility: check if stored value is already hashed
    let isValid = false
    if (isBcryptHash(storedHash)) {
      isValid = await verifyPassword(password, storedHash)
    } else {
      // Legacy plaintext password - verify and migrate to hash
      isValid = storedHash === password
      if (isValid) {
        // Migrate to hashed password
        const newHash = await hashPassword(password)
        await supabase
          .from("participants")
          .update({ password_hash: newHash })
          .eq("id", existing.id)
      }
    }

    if (!isValid) {
      return NextResponse.json({ error: "Senha incorreta. Se voce esqueceu sua senha, entre em contato com o administrador." }, { status: 401 })
    }
    
    // Password correct - return existing participant (without sensitive data)
    return NextResponse.json({ id: existing.id, name: existing.name }, { status: 200 })
  }

  // Create new participant with hashed password
  const hashedPassword = await hashPassword(password)
  
  const { data, error } = await supabase
    .from("participants")
    .insert({
      pool_id: id,
      name: name.trim(),
      password_hash: hashedPassword,
    })
    .select("id, name")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
