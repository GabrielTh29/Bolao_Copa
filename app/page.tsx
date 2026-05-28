"use client"

import { useState } from "react"
import { Trophy, ArrowRight, Settings2, ChevronDown, ChevronUp, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"

export default function HomePage() {
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Create pool form
  const [poolName, setPoolName] = useState("")
  const [adminName, setAdminName] = useState("")
  const [adminPassword, setAdminPassword] = useState("")
  const [showPointsConfig, setShowPointsConfig] = useState(false)
  const [pointsExact, setPointsExact] = useState(10)
  const [pointsResultOneScore, setPointsResultOneScore] = useState(5)
  const [pointsResultGoalDiff, setPointsResultGoalDiff] = useState(4)
  const [pointsResultOnly, setPointsResultOnly] = useState(3)
  const [pointsExactOpposite, setPointsExactOpposite] = useState(-5)

  // Join pool form
  const [inviteCode, setInviteCode] = useState("")
  const [participantName, setParticipantName] = useState("")
  const [participantPassword, setParticipantPassword] = useState("")
  const [poolInfo, setPoolInfo] = useState<{ id: string; name: string; admin_name: string } | null>(null)

  const handleCreatePool = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (!adminPassword.trim() || adminPassword.length < 4) {
      setError("Senha deve ter pelo menos 4 caracteres")
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/pools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: poolName,
          admin_name: adminName,
          admin_password: adminPassword,
          points_exact: pointsExact,
          points_result_one_score: pointsResultOneScore,
          points_result_goal_diff: pointsResultGoalDiff,
          points_result_only: pointsResultOnly,
          points_exact_opposite: pointsExactOpposite,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro ao criar bolão")
      }

      // Get the admin participant that was created with the pool
      const participantsResponse = await fetch(`/api/pools/${data.id}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: adminName,
          password: adminPassword,
        }),
      })

      const participant = await participantsResponse.json()

      if (!participantsResponse.ok) {
        throw new Error(participant.error || "Erro ao registrar participante")
      }

      // Create session with HTTP-only cookie
      const sessionResponse = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: participant.id,
          participantName: participant.name,
          poolId: data.id,
          password: adminPassword,
        }),
      })

      if (!sessionResponse.ok) {
        throw new Error("Erro ao criar sessão")
      }

      router.push(`/pool/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar bolão")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCheckPool = async () => {
    if (!inviteCode.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/pools?invite_code=${inviteCode.toUpperCase()}`)
      const data = await response.json()

      if (!response.ok || !data) {
        throw new Error("Codigo de convite inválido")
      }

      setPoolInfo(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar bolão")
      setPoolInfo(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinPool = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (!participantPassword.trim() || participantPassword.length < 4) {
      setError("Senha deve ter pelo menos 4 caracteres")
      setIsLoading(false)
      return
    }

    try {
      // If we don't have pool info yet, fetch it first
      let pool = poolInfo
      if (!pool) {
        const response = await fetch(`/api/pools?invite_code=${inviteCode.toUpperCase()}`)
        const data = await response.json()

        if (!response.ok || !data) {
          throw new Error("Codigo de convite inválido")
        }
        pool = data
        setPoolInfo(data)
      }

      // Join pool through secure API
      const joinResponse = await fetch(`/api/pools/${pool.id}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: participantName,
          password: participantPassword,
        }),
      })

      const participant = await joinResponse.json()

      if (!joinResponse.ok) {
        throw new Error(participant.error || "Erro ao entrar no bolao")
      }

      // Create session with HTTP-only cookie
      const sessionResponse = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: participant.id,
          participantName: participant.name,
          poolId: pool.id,
          password: participantPassword,
        }),
      })

      if (!sessionResponse.ok) {
        throw new Error("Erro ao criar sessão")
      }

      router.push(`/pool/${pool.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar no bolão")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <header className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_25%_25%,_white_2px,_transparent_2px),_radial-gradient(circle_at_75%_75%,_white_1px,_transparent_1px)] bg-[length:40px_40px]" />
        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <div className="flex flex-col items-center text-center gap-6">
            <div className="flex items-center gap-3">
              <Trophy className="h-12 w-12 text-secondary" />
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Bolão da Copa 2026 :)</h1>
            </div>
            <p className="text-lg md:text-xl max-w-2xl text-primary-foreground/90">
              Diversão e Alegria nas pernas! Mostra tua força, Brasil!!!
            </p>
          </div>
        </div>
      </header>

      {/* Main Action */}
      <main className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-md">
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Comece Agora</CardTitle>
              <CardDescription>Crie um novo bolão ou entre em um existente</CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}

              <Tabs defaultValue="create" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="create">Criar Bolão</TabsTrigger>
                  <TabsTrigger value="join">Entrar</TabsTrigger>
                </TabsList>

                <TabsContent value="create" className="mt-6">
                  <form onSubmit={handleCreatePool} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="poolName">Nome do Bolão</Label>
                      <Input
                        id="poolName"
                        placeholder="Ex: Bolao da Familia"
                        value={poolName}
                        onChange={(e) => setPoolName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="adminName">Seu Nome</Label>
                      <Input
                        id="adminName"
                        placeholder="Ex: Bibi"
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="adminPassword" className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Sua Senha
                      </Label>
                      <Input
                        id="adminPassword"
                        type="password"
                        placeholder="Crie uma senha (min. 4 caracteres)"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        minLength={4}
                        required
                      />
                      <span className="text-xs text-muted-foreground">
                        Voce precisará desta senha para acessar sua conta
                      </span>
                    </div>

                    {/* Points Configuration Toggle */}
                    <button
                      type="button"
                      onClick={() => setShowPointsConfig(!showPointsConfig)}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Settings2 className="h-4 w-4" />
                      Configurar pontuação
                      {showPointsConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {showPointsConfig && (
                      <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
                        <p className="text-xs text-muted-foreground">
                          Defina quantos pontos cada tipo de acerto vale:
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1">
                            <Label htmlFor="pointsExact" className="text-xs">Placar exato</Label>
                            <Input
                              id="pointsExact"
                              type="number"
                              min="0"
                              max="100"
                              value={pointsExact}
                              onChange={(e) => setPointsExact(Number(e.target.value))}
                              className="text-center"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label htmlFor="pointsResultOneScore" className="text-xs">Resultado + 1 placar</Label>
                            <Input
                              id="pointsResultOneScore"
                              type="number"
                              min="0"
                              max="100"
                              value={pointsResultOneScore}
                              onChange={(e) => setPointsResultOneScore(Number(e.target.value))}
                              className="text-center"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label htmlFor="pointsResultGoalDiff" className="text-xs">Resultado + dif. gols</Label>
                            <Input
                              id="pointsResultGoalDiff"
                              type="number"
                              min="0"
                              max="100"
                              value={pointsResultGoalDiff}
                              onChange={(e) => setPointsResultGoalDiff(Number(e.target.value))}
                              className="text-center"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label htmlFor="pointsResultOnly" className="text-xs">Só resultado</Label>
                            <Input
                              id="pointsResultOnly"
                              type="number"
                              min="0"
                              max="100"
                              value={pointsResultOnly}
                              onChange={(e) => setPointsResultOnly(Number(e.target.value))}
                              className="text-center"
                            />
                          </div>
                          <div className="flex flex-col gap-1 col-span-2">
                            <Label htmlFor="pointsExactOpposite" className="text-xs text-destructive">Placar invertido (penalidade)</Label>
                            <Input
                              id="pointsExactOpposite"
                              type="number"
                              min="-100"
                              max="0"
                              value={pointsExactOpposite}
                              onChange={(e) => setPointsExactOpposite(Number(e.target.value))}
                              className="text-center border-destructive/50"
                            />
                            <span className="text-xs text-muted-foreground">Ex: palpite 2x1, resultado 1x2 (não vale empate)</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Padrão: 10 (exato), 5 (resultado+1), 4 (dif. gols), 3 (resultado), -5 (invertido)
                        </p>
                      </div>
                    )}

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? "Criando..." : "Criar Bolao"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="join" className="mt-6">
                  <form onSubmit={handleJoinPool} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="inviteCode">Código de Convite</Label>
                      <div className="flex gap-2">
                        <Input
                          id="inviteCode"
                          placeholder="Ex: ABC123"
                          value={inviteCode}
                          onChange={(e) => {
                            setInviteCode(e.target.value.toUpperCase())
                            setPoolInfo(null)
                          }}
                          maxLength={6}
                          required
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCheckPool}
                          disabled={isLoading || inviteCode.length < 6}
                        >
                          Verificar
                        </Button>
                      </div>
                    </div>

                    {poolInfo && (
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                        <p className="text-sm font-medium">Bolão: {poolInfo.name}</p>
                        <p className="text-xs text-muted-foreground">Criado por: {poolInfo.admin_name}</p>
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="participantName">Seu Nome</Label>
                      <Input
                        id="participantName"
                        placeholder="Ex: Maria"
                        value={participantName}
                        onChange={(e) => setParticipantName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="participantPassword" className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Sua Senha
                      </Label>
                      <Input
                        id="participantPassword"
                        type="password"
                        placeholder="Crie ou digite sua senha (min. 4 caracteres)"
                        value={participantPassword}
                        onChange={(e) => setParticipantPassword(e.target.value)}
                        minLength={4}
                        required
                      />
                      <span className="text-xs text-muted-foreground">
                        Novo usuário? Crie uma senha. Já tem conta? Digite sua senha.
                      </span>
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? "Entrando..." : "Entrar no Bolao"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Bolão da Copa 2026
        </div>
      </footer>
    </div>
  )
}
