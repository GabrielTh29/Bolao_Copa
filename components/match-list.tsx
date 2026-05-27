"use client"

import { useState } from "react"
import { Calendar, Clock, Check, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Match, Prediction } from "@/lib/types"

interface MatchListProps {
  matches: Match[]
  predictions: Prediction[]
  currentParticipantId: string | null
  onPredictionUpdate: () => void
}

export function MatchList({ matches, predictions, currentParticipantId, onPredictionUpdate }: MatchListProps) {
  const [editingMatch, setEditingMatch] = useState<string | null>(null)
  const [homeScore, setHomeScore] = useState("")
  const [awayScore, setAwayScore] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getPrediction = (matchId: string) => {
    return predictions.find(p => p.match_id === matchId)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const canPredict = (match: Match) => {
    const now = new Date()
    const matchDate = new Date(match.match_date)
    return match.status === "scheduled" && matchDate > now
  }

  const startEditing = (match: Match) => {
    const existing = getPrediction(match.id)
    setEditingMatch(match.id)
    setHomeScore(existing?.home_score?.toString() || "")
    setAwayScore(existing?.away_score?.toString() || "")
  }

  const cancelEditing = () => {
    setEditingMatch(null)
    setHomeScore("")
    setAwayScore("")
  }

  const savePrediction = async (matchId: string) => {
    if (!currentParticipantId) return
    
    setIsSubmitting(true)
    setError(null)
    
    try {
      // The API will get the password from the HTTP-only session cookie
      const response = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participant_id: currentParticipantId,
          match_id: matchId,
          home_score: parseInt(homeScore),
          away_score: parseInt(awayScore),
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || "Erro ao salvar palpite")
        return
      }
      
      onPredictionUpdate()
      cancelEditing()
    } catch (err) {
      setError("Erro ao salvar palpite. Tente novamente.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusBadge = (status: Match["status"]) => {
    switch (status) {
      case "live":
        return <Badge variant="destructive" className="animate-pulse">AO VIVO</Badge>
      case "finished":
        return <Badge variant="secondary">Finalizado</Badge>
      default:
        return <Badge variant="outline">Agendado</Badge>
    }
  }

  // Group matches by date
  const groupedMatches = matches.reduce((acc, match) => {
    const date = new Date(match.match_date).toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(match)
    return acc
  }, {} as Record<string, Match[]>)

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum jogo cadastrado ainda
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {Object.entries(groupedMatches).map(([date, dayMatches]) => (
        <div key={date}>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {date}
          </h3>
          
          <div className="flex flex-col gap-3">
            {dayMatches.map((match) => {
              const prediction = getPrediction(match.id)
              const isEditing = editingMatch === match.id
              
              return (
                <Card key={match.id} className={cn(
                  "overflow-hidden transition-all",
                  isEditing && "ring-2 ring-primary"
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDate(match.match_date)}
                      </div>
                      <div className="flex items-center gap-2">
                        {match.group_name && (
                          <Badge variant="outline" className="text-xs">
                            {match.stage} - {match.group_name}
                          </Badge>
                        )}
                        {getStatusBadge(match.status)}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between gap-4">
                      {/* Home Team */}
                      <div className="flex-1 text-center">
                        <p className="font-medium text-sm truncate">
                          {match.home_team?.name || "Time A"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {match.home_team?.short_code || "TMA"}
                        </p>
                      </div>
                      
                      {/* Score / Prediction */}
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <>
                            <Input
                              type="number"
                              min="0"
                              max="99"
                              className="w-12 h-10 text-center text-lg font-bold"
                              value={homeScore}
                              onChange={(e) => setHomeScore(e.target.value)}
                            />
                            <span className="text-muted-foreground font-bold">x</span>
                            <Input
                              type="number"
                              min="0"
                              max="99"
                              className="w-12 h-10 text-center text-lg font-bold"
                              value={awayScore}
                              onChange={(e) => setAwayScore(e.target.value)}
                            />
                          </>
                        ) : match.status === "finished" ? (
                          <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-lg">
                            <span className="text-2xl font-bold">{match.home_score}</span>
                            <span className="text-muted-foreground font-bold">x</span>
                            <span className="text-2xl font-bold">{match.away_score}</span>
                          </div>
                        ) : prediction ? (
                          <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-lg border border-primary/20">
                            <span className="text-xl font-bold text-primary">{prediction.home_score}</span>
                            <span className="text-primary/60 font-bold">x</span>
                            <span className="text-xl font-bold text-primary">{prediction.away_score}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-lg">
                            <span className="text-lg text-muted-foreground">? x ?</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Away Team */}
                      <div className="flex-1 text-center">
                        <p className="font-medium text-sm truncate">
                          {match.away_team?.name || "Time B"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {match.away_team?.short_code || "TMB"}
                        </p>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    {canPredict(match) && currentParticipantId && (
                      <div className="mt-4 flex flex-col items-center gap-2">
                        {isEditing && error && (
                          <p className="text-sm text-destructive">{error}</p>
                        )}
                        <div className="flex gap-2">
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => savePrediction(match.id)}
                              disabled={isSubmitting || !homeScore || !awayScore}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Salvar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelEditing}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancelar
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant={prediction ? "outline" : "default"}
                            onClick={() => startEditing(match)}
                          >
                            {prediction ? "Editar Palpite" : "Fazer Palpite"}
                          </Button>
                        )}
                        </div>
                      </div>
                    )}
                    
                    {/* Show prediction result for finished matches */}
                    {match.status === "finished" && prediction && (
                      <div className="mt-3 pt-3 border-t text-center">
                        <p className="text-sm">
                          Seu palpite: <span className="font-medium">{prediction.home_score} x {prediction.away_score}</span>
                          {prediction.points > 0 && (
                            <Badge variant="secondary" className="ml-2">
                              +{prediction.points} pts
                            </Badge>
                          )}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
