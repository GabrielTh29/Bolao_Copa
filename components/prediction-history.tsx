"use client"

import { History, Check, X, Minus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Prediction } from "@/lib/types"

interface PredictionHistoryProps {
  predictions: Prediction[]
}

export function PredictionHistory({ predictions }: PredictionHistoryProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getResultIcon = (prediction: Prediction) => {
    if (!prediction.match || prediction.match.status !== "finished") {
      return <Minus className="h-4 w-4 text-muted-foreground" />
    }
    
    const match = prediction.match
    const isExact = prediction.home_score === match.home_score && 
                    prediction.away_score === match.away_score
    
    if (isExact) {
      return <Check className="h-4 w-4 text-primary" />
    }
    
    // Check if got the winner right
    const predictedResult = prediction.home_score > prediction.away_score ? "home" : 
                           prediction.home_score < prediction.away_score ? "away" : "draw"
    const actualResult = match.home_score! > match.away_score! ? "home" : 
                        match.home_score! < match.away_score! ? "away" : "draw"
    
    if (predictedResult === actualResult) {
      return <Check className="h-4 w-4 text-secondary-foreground" />
    }
    
    return <X className="h-4 w-4 text-destructive" />
  }

  const totalPoints = predictions.reduce((sum, p) => sum + (p.points || 0), 0)
  const finishedPredictions = predictions.filter(p => p.match?.status === "finished")

  if (predictions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Voce ainda nao fez nenhum palpite
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <Card className="bg-primary/5">
        <CardContent className="py-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{predictions.length}</p>
              <p className="text-xs text-muted-foreground">Palpites</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{finishedPredictions.length}</p>
              <p className="text-xs text-muted-foreground">Conferidos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{totalPoints}</p>
              <p className="text-xs text-muted-foreground">Pontos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Predictions List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-5 w-5 text-primary" />
            Historico de Palpites
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {predictions.map((prediction) => {
              const match = prediction.match
              if (!match) return null
              
              return (
                <div key={prediction.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">
                      {formatDate(match.match_date)}
                    </p>
                    <div className="flex items-center gap-2">
                      {getResultIcon(prediction)}
                      {prediction.match?.status === "finished" && (
                        <Badge
                          variant={
                            prediction.points > 0
                              ? "secondary"
                              : prediction.points < 0
                                ? "destructive"
                                : "outline"
                          }
                          className="text-xs"
                        >
                          {prediction.points > 0 ? `+${prediction.points}` : prediction.points}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate flex-1">
                      {match.home_team?.short_code || "TMA"}
                    </span>
                    
                    <div className="flex items-center gap-3 mx-4">
                      <div className={cn(
                        "px-3 py-1 rounded font-medium",
                        match.status === "finished" ? "bg-muted" : "bg-primary/10"
                      )}>
                        {prediction.home_score} x {prediction.away_score}
                      </div>
                      
                      {match.status === "finished" && (
                        <>
                          <span className="text-muted-foreground">vs</span>
                          <div className="px-3 py-1 rounded bg-muted font-medium">
                            {match.home_score} x {match.away_score}
                          </div>
                        </>
                      )}
                    </div>
                    
                    <span className="truncate flex-1 text-right">
                      {match.away_team?.short_code || "TMB"}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
