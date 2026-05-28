"use client"

import { Trophy, Medal } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Participant } from "@/lib/types"

interface LeaderboardProps {
  participants: (Participant & { total_points: number })[]
  currentParticipantId: string | null
}

export function Leaderboard({ participants, currentParticipantId }: LeaderboardProps) {
  const getRankBadge = (position: number) => {
    switch (position) {
      case 1:
        return (
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
            <Trophy className="h-4 w-4 text-secondary-foreground" />
          </div>
        )
      case 2:
        return (
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <Medal className="h-4 w-4 text-muted-foreground" />
          </div>
        )
      case 3:
        return (
          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
            <Medal className="h-4 w-4 text-orange-600" />
          </div>
        )
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
            {position}
          </div>
        )
    }
  }

  if (participants.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum participante ainda
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Ranking
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {participants.map((participant, index) => (
            <div
              key={participant.id}
              className={cn(
                "flex items-center gap-4 px-6 py-4 transition-colors",
                participant.id === currentParticipantId && "bg-primary/5",
                index === 0 && "bg-secondary/10"
              )}
            >
              {getRankBadge(index + 1)}
              
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "font-medium truncate",
                  participant.id === currentParticipantId && "text-primary"
                )}>
                  {participant.name}
                  {participant.id === currentParticipantId && (
                    <span className="ml-2 text-xs text-muted-foreground">(Você)</span>
                  )}
                </p>
              </div>
              
              <div className="text-right">
                <p className="text-lg font-bold text-primary">
                  {participant.total_points}
                </p>
                <p className="text-xs text-muted-foreground">pontos</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
