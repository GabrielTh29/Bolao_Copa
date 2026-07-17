"use client"

import { useState, useEffect } from "react"
import { Trophy, PartyPopper } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { Match, Participant } from "@/lib/types"

interface WinnerPopupProps {
  leaderboard: (Participant & { total_points: number })[]
  matches: Match[]
}

export function WinnerPopup({ leaderboard, matches }: WinnerPopupProps) {
  // O bolão está concluído quando a final foi finalizada
  const isPoolFinished = matches.some(
    (m) => m.stage === "Final" && m.status === "finished",
  )

  // Vencedor(es): participante(s) com mais pontos (trata empate no topo)
  const topPoints = leaderboard.length > 0 ? leaderboard[0].total_points : 0
  const winners = leaderboard.filter((p) => p.total_points === topPoints && topPoints > 0)

  const winnerNames =
    winners.length === 0
      ? ""
      : winners.length === 1
        ? winners[0].name
        : winners.slice(0, -1).map((w) => w.name).join(", ") +
          " e " +
          winners[winners.length - 1].name

  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Abre automaticamente sempre que o bolão estiver concluído e houver vencedor
    if (isPoolFinished && winnerNames) {
      setOpen(true)
    }
  }, [isPoolFinished, winnerNames])

  if (!isPoolFinished || !winnerNames) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader className="items-center">
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
            <Trophy className="h-8 w-8 text-secondary-foreground" />
          </div>
          <DialogTitle className="flex items-center justify-center gap-2 text-xl text-balance">
            <PartyPopper className="h-5 w-5 text-primary" />
            {winners.length > 1 ? "Temos campeões!" : "Temos um campeão!"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-lg font-bold text-primary text-balance">{winnerNames}</p>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            {"Parabéns "}
            <span className="font-semibold text-foreground">{winnerNames}</span>
            {
              " pelos ótimos chutes!!! Já tá chutando melhor que nossa seleção hein kkkk. Fiquem de olho e continuem torcendo, porque em 2027 tem mais, e agora a Copa vai ser na nossa casa!!!!!!"
            }
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            {"Muito obrigado por terem participado,"}
            <br />
            {"Admin (nós mesmo)"}
          </p>
        </div>

        <Button onClick={() => setOpen(false)} className="w-full">
          Fechar
        </Button>
      </DialogContent>
    </Dialog>
  )
}
