import { NextResponse } from "next/server"
import { setSessionCookies, clearSessionCookies, type SessionData } from "@/lib/session"
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit"

export async function POST(request: Request) {
  // Rate limit check
  const ip = getClientIdentifier(request)
  const { success, response } = await checkRateLimit(ip, "auth")
  if (!success && response) return response
  
  try {
    const body = await request.json()
    const { participantId, participantName, poolId } = body
    
    if (!participantId || !participantName || !poolId) {
      return NextResponse.json(
        { error: "Dados de sessao incompletos" },
        { status: 400 }
      )
    }
    
    const session: SessionData = {
      participantId,
      participantName,
      poolId,
    }
    
    const res = NextResponse.json({ success: true })
    return setSessionCookies(res, session)
  } catch (error) {
    console.error("[Session] Error creating session:", error)
    return NextResponse.json(
      { error: "Erro ao criar sessao" },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const res = NextResponse.json({ success: true })
    return clearSessionCookies(res)
  } catch (error) {
    console.error("[Session] Error clearing session:", error)
    return NextResponse.json(
      { error: "Erro ao encerrar sessao" },
      { status: 500 }
    )
  }
}
