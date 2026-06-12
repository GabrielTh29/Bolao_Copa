"use client"

import { useState, useEffect } from "react"
import { Trophy, Users, Calendar, Share2, Copy, Check, LogOut, Settings, Pencil, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import type { Pool, Participant, Match, Prediction } from "@/lib/types"
import type { SessionData } from "@/lib/session"
import { Leaderboard } from "@/components/leaderboard"
import { MatchList } from "@/components/match-list"
import { PredictionHistory } from "@/components/prediction-history"

interface PoolDashboardProps {
  pool: Pool
  initialParticipants: Participant[]
  initialMatches: Match[]
  session: SessionData
}

export function PoolDashboard({ pool, initialParticipants, initialMatches, session }: PoolDashboardProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const [participants, setParticipants] = useState(initialParticipants)
  const [matches, setMatches] = useState(initialMatches)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [allPredictions, setAllPredictions] = useState<Prediction[]>([])
  const [copied, setCopied] = useState(false)
  const [currentParticipantId] = useState<string>(session.participantId)
  const [currentParticipantName] = useState<string>(session.participantName)
  
  // Points configuration editing
  const [editingPoints, setEditingPoints] = useState(false)
  const [pointsExact, setPointsExact] = useState(pool.points_exact || 10)
  const [pointsResultOneScore, setPointsResultOneScore] = useState(pool.points_result_one_score || 5)
  const [pointsResultGoalDiff, setPointsResultGoalDiff] = useState(pool.points_result_goal_diff || 4)
  const [pointsResultOnly, setPointsResultOnly] = useState(pool.points_result_only || 3)
  const [pointsExactOpposite, setPointsExactOpposite] = useState(pool.points_exact_opposite ?? -5)
  const [savingPoints, setSavingPoints] = useState(false)
  const isAdmin = currentParticipantName === pool.admin_name

  useEffect(() => {
    // Carrega predictions para o participante da sessao
    loadPredictions(session.participantId)
    // Carrega predictions de todos os participantes do bolao
    loadAllPredictions()
  }, [session.participantId])

  const refreshParticipants = async () => {
    const { data } = await supabase
      .from("participants")
      .select("*")
      .eq("pool_id", pool.id)
      .order("created_at", { ascending: true })
    
    if (data) {
      setParticipants(data)
    }
  }

  const loadPredictions = async (participantId: string) => {
    const { data } = await supabase
      .from("predictions")
      .select(`
        *,
        match:matches(
          *,
          home_team:teams!matches_home_team_id_fkey(*),
          away_team:teams!matches_away_team_id_fkey(*)
        )
      `)
      .eq("participant_id", participantId)
    
    if (data) {
      setPredictions(data)
    }
  }

  const loadAllPredictions = async () => {
    // Busca todos os participantes do bolao
    const { data: poolParticipants } = await supabase
      .from("participants")
      .select("id")
      .eq("pool_id", pool.id)

    if (!poolParticipants || poolParticipants.length === 0) {
      setAllPredictions([])
      return
    }

    const participantIds = poolParticipants.map((p) => p.id)

    const { data } = await supabase
      .from("predictions")
      .select(`
        *,
        participant:participants(id, name)
      `)
      .in("participant_id", participantIds)

    if (data) {
      setAllPredictions(data)
    }
  }

  const copyInviteCode = async () => {
    await navigator.clipboard.writeText(pool.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLogout = async () => {
    try {
      await fetch("/api/session", { method: "DELETE" })
    } catch {
      // Continue with redirect even if API fails
    }
    router.push("/")
  }

  const handlePredictionUpdate = () => {
    if (currentParticipantId) {
      loadPredictions(currentParticipantId)
      loadAllPredictions()
    }
  }

  const savePointsConfig = async () => {
    setSavingPoints(true)
    try {
      // The API will get credentials from the HTTP-only session cookie
      const response = await fetch("/api/pools", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pool_id: pool.id,
          admin_name: currentParticipantName,
          points_exact: pointsExact,
          points_result_one_score: pointsResultOneScore,
          points_result_goal_diff: pointsResultGoalDiff,
          points_result_only: pointsResultOnly,
          points_exact_opposite: pointsExactOpposite,
        }),
      })
      
      if (response.ok) {
        setEditingPoints(false)
        // Update local pool state
        pool.points_exact = pointsExact
        pool.points_result_one_score = pointsResultOneScore
        pool.points_result_goal_diff = pointsResultGoalDiff
        pool.points_result_only = pointsResultOnly
        pool.points_exact_opposite = pointsExactOpposite
      }
    } catch (error) {
      console.error("Erro ao salvar configuracao:", error)
    } finally {
      setSavingPoints(false)
    }
  }

  // Calculate leaderboard usando os palpites de TODOS os participantes
  const leaderboard = participants.map(p => {
    const participantPredictions = allPredictions.filter(pred => pred.participant_id === p.id)
    const totalPoints = participantPredictions.reduce((sum, pred) => sum + (pred.points || 0), 0)
    
    return {
      ...p,
      total_points: totalPoints,
    }
  }).sort((a, b) => b.total_points - a.total_points)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-secondary" />
              <div>
                <h1 className="text-2xl font-bold">{pool.name}</h1>
                <p className="text-sm text-primary-foreground/80">
                  Criado por {pool.admin_name}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={copyInviteCode}
                className="gap-2"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado!" : pool.invite_code}
              </Button>
              
              {currentParticipantName && (
                <Badge variant="outline" className="bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20">
                  {currentParticipantName}
                </Badge>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-primary-foreground hover:bg-primary-foreground/10"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats */}
      <section className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{participants.length}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Users className="h-3 w-3" /> Participantes
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{matches.length}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Calendar className="h-3 w-3" /> Jogos
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {matches.filter(m => m.status === "finished").length}
              </div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Trophy className="h-3 w-3" /> Finalizados
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="matches" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="matches">Jogos</TabsTrigger>
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
            <TabsTrigger value="history">Meus Palpites</TabsTrigger>
            <TabsTrigger value="admin">
              <Settings className="h-4 w-4 mr-1" />
              Infos
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="matches">
            <MatchList 
              matches={matches}
              predictions={predictions}
              allPredictions={allPredictions}
              currentParticipantId={currentParticipantId}
              onPredictionUpdate={handlePredictionUpdate}
            />
          </TabsContent>
          
          <TabsContent value="ranking">
            <Leaderboard 
              participants={leaderboard}
              currentParticipantId={currentParticipantId}
            />
          </TabsContent>
          
          <TabsContent value="history">
            <PredictionHistory 
              predictions={predictions}
            />
          </TabsContent>
          
          <TabsContent value="admin">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Configuracoes do Bolão
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-medium mb-2">Compartilhar Bolão</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Convide amigos compartilhando o link ou código abaixo:
                  </p>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-muted px-3 py-2 rounded-lg text-sm font-mono">
                      {typeof window !== "undefined" ? `${window.location.origin}/join/${pool.invite_code}` : `/join/${pool.invite_code}`}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/join/${pool.invite_code}`)
                        setCopied(true)
                        setTimeout(() => setCopied(false), 2000)
                      }}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Sistema de Pontuação</h3>
                    {isAdmin && !editingPoints && (
                      <Button variant="outline" size="sm" onClick={() => setEditingPoints(true)}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                    )}
                    {isAdmin && editingPoints && (
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => {
                          setEditingPoints(false)
                          setPointsExact(pool.points_exact || 10)
                          setPointsResultOneScore(pool.points_result_one_score || 5)
                          setPointsResultGoalDiff(pool.points_result_goal_diff || 4)
                          setPointsResultOnly(pool.points_result_only || 3)
                          setPointsExactOpposite(pool.points_exact_opposite ?? -5)
                        }}>
                          Cancelar
                        </Button>
                        <Button size="sm" onClick={savePointsConfig} disabled={savingPoints}>
                          <Save className="h-4 w-4 mr-1" />
                          {savingPoints ? "Salvando..." : "Salvar"}
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {editingPoints ? (
                    <div className="space-y-4 p-4 rounded-lg border bg-background">
                      <p className="text-sm text-muted-foreground">
                        Configure quantos pontos cada tipo de acerto vale:
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="editPointsExact" className="text-xs">Placar exato</Label>
                          <Input
                            id="editPointsExact"
                            type="number"
                            min="0"
                            max="100"
                            value={pointsExact}
                            onChange={(e) => setPointsExact(Number(e.target.value))}
                            className="text-center"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="editPointsResultOneScore" className="text-xs">Resultado + 1 placar</Label>
                          <Input
                            id="editPointsResultOneScore"
                            type="number"
                            min="0"
                            max="100"
                            value={pointsResultOneScore}
                            onChange={(e) => setPointsResultOneScore(Number(e.target.value))}
                            className="text-center"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="editPointsResultGoalDiff" className="text-xs">Resultado + dif. gols</Label>
                          <Input
                            id="editPointsResultGoalDiff"
                            type="number"
                            min="0"
                            max="100"
                            value={pointsResultGoalDiff}
                            onChange={(e) => setPointsResultGoalDiff(Number(e.target.value))}
                            className="text-center"
                          />
                          <span className="text-xs text-muted-foreground">Não vale para empates</span>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="editPointsResultOnly" className="text-xs">Só resultado</Label>
                          <Input
                            id="editPointsResultOnly"
                            type="number"
                            min="0"
                            max="100"
                            value={pointsResultOnly}
                            onChange={(e) => setPointsResultOnly(Number(e.target.value))}
                            className="text-center"
                          />
                        </div>
                        <div className="flex flex-col gap-2 col-span-2">
                          <Label htmlFor="editPointsExactOpposite" className="text-xs text-destructive">Placar invertido (penalidade)</Label>
                          <Input
                            id="editPointsExactOpposite"
                            type="number"
                            min="-100"
                            max="0"
                            value={pointsExactOpposite}
                            onChange={(e) => setPointsExactOpposite(Number(e.target.value))}
                            className="text-center border-destructive/50"
                          />
                          <span className="text-xs text-muted-foreground">Ex: palpite 2x1, resultado 1x2</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
                      <div className="flex justify-between">
                        <span>Placar exato</span>
                        <span className="font-bold text-primary">{pool.points_exact || 10} pontos</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Resultado correto + 1 placar</span>
                        <span className="font-bold text-primary">{pool.points_result_one_score || 5} pontos</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Resultado + diferenca de gols</span>
                        <span className="font-bold text-primary">{pool.points_result_goal_diff || 4} pontos</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Apenas resultado correto</span>
                        <span className="font-bold text-primary">{pool.points_result_only || 3} pontos</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Resultado errado</span>
                        <span>0 pontos</span>
                      </div>
                      <div className="flex justify-between text-destructive border-t pt-2 mt-2">
                        <span>Placar invertido</span>
                        <span className="font-bold">{pool.points_exact_opposite ?? -5} pontos</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
