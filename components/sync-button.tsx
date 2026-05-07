"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, Check, AlertCircle } from "lucide-react"

interface SyncResult {
  success: boolean
  message: string
  teams?: number
  matchesSynced?: number
  matchesUpdated?: number
  error?: string
}

export function SyncButton() {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)

  const handleSync = async () => {
    setSyncing(true)
    setResult(null)

    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competition: "WC" }),
      })

      const data = await response.json()

      if (!response.ok) {
        setResult({ success: false, message: data.error || "Erro ao sincronizar" })
      } else {
        setResult(data)
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Erro de conexao",
      })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={handleSync}
        disabled={syncing}
        variant="outline"
        className="gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Sincronizando..." : "Sincronizar Jogos"}
      </Button>

      {result && (
        <div
          className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
            result.success
              ? "bg-primary/10 text-primary"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {result.success ? (
            <Check className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          <div>
            <p className="font-medium">{result.message}</p>
            {result.success && (
              <p className="text-muted-foreground mt-1">
                {result.teams} times, {result.matchesSynced} novos jogos,{" "}
                {result.matchesUpdated} atualizados
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
