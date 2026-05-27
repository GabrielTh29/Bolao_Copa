"use client"

import { useState, useEffect, useCallback } from "react"

interface SessionData {
  participantId: string | null
  participantName: string | null
  poolId: string | null
  isLoading: boolean
}

export function useSession() {
  const [session, setSession] = useState<SessionData>({
    participantId: null,
    participantName: null,
    poolId: null,
    isLoading: true,
  })

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch("/api/session")
      if (response.ok) {
        const data = await response.json()
        setSession({
          participantId: data.participantId,
          participantName: data.participantName,
          poolId: data.poolId,
          isLoading: false,
        })
      } else {
        setSession({
          participantId: null,
          participantName: null,
          poolId: null,
          isLoading: false,
        })
      }
    } catch {
      setSession({
        participantId: null,
        participantName: null,
        poolId: null,
        isLoading: false,
      })
    }
  }, [])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  const login = async (participantId: string, participantName: string, poolId: string, password: string) => {
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, participantName, poolId, password }),
      })
      
      if (response.ok) {
        setSession({
          participantId,
          participantName,
          poolId,
          isLoading: false,
        })
        return { success: true }
      } else {
        const data = await response.json()
        return { success: false, error: data.error }
      }
    } catch {
      return { success: false, error: "Erro ao fazer login" }
    }
  }

  const logout = async () => {
    try {
      await fetch("/api/session", { method: "DELETE" })
      setSession({
        participantId: null,
        participantName: null,
        poolId: null,
        isLoading: false,
      })
    } catch {
      // Clear session locally even if API fails
      setSession({
        participantId: null,
        participantName: null,
        poolId: null,
        isLoading: false,
      })
    }
  }

  return {
    ...session,
    login,
    logout,
    refresh: fetchSession,
  }
}
