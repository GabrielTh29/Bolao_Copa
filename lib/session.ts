import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
}

export interface SessionData {
  participantId: string
  participantName: string
  poolId: string
  // Note: password is NOT stored in session - only used for verification
}

/**
 * Set session cookies (server-side)
 */
export function setSessionCookies(
  response: NextResponse,
  session: SessionData
): NextResponse {
  response.cookies.set("participant_id", session.participantId, COOKIE_OPTIONS)
  response.cookies.set("participant_name", encodeURIComponent(session.participantName), COOKIE_OPTIONS)
  response.cookies.set("pool_id", session.poolId, COOKIE_OPTIONS)
  
  return response
}

/**
 * Get session from cookies (server-side)
 */
export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies()
  
  const participantId = cookieStore.get("participant_id")?.value
  const participantName = cookieStore.get("participant_name")?.value
  const poolId = cookieStore.get("pool_id")?.value
  
  if (!participantId || !participantName || !poolId) {
    return null
  }
  
  return {
    participantId,
    participantName,
    poolId,
  }
}

/**
 * Clear session cookies (server-side)
 */
export function clearSessionCookies(response: NextResponse): NextResponse {
  response.cookies.delete("participant_id")
  response.cookies.delete("participant_name")
  response.cookies.delete("pool_id")
  
  return response
}

/**
 * Get session from request cookies (for API routes)
 */
export function getSessionFromRequest(request: Request): SessionData | null {
  const cookieHeader = request.headers.get("cookie")
  if (!cookieHeader) return null
  
  const cookies = Object.fromEntries(
    cookieHeader.split("; ").map(c => {
      const [key, ...values] = c.split("=")
      return [key, values.join("=")]
    })
  )
  
  const participantId = cookies["participant_id"]
  const participantName = cookies["participant_name"]
  const poolId = cookies["pool_id"]
  
  if (!participantId || !participantName || !poolId) {
    return null
  }
  
  return {
    participantId,
    participantName: decodeURIComponent(participantName),
    poolId,
  }
}
