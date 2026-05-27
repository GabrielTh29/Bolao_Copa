"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Trophy, Users, ArrowLeft, Loader2, Lock } from "lucide-react"
import Link from "next/link"

interface Pool {
  id: string
  name: string
  admin_name: string
  invite_code: string
}

export default function JoinPoolPage() {
  const router = useRouter()
  const params = useParams()
  const code = params.code as string

  const [pool, setPool] = useState<Pool | null>(null)
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    async function fetchPool() {
      try {
        const response = await fetch(`/api/pools?invite_code=${code}`)
        if (response.ok) {
          const data = await response.json()
          setPool(data)
        } else {
          setError("Bolao nao encontrado")
        }
      } catch {
        setError("Erro ao buscar bolao")
      } finally {
        setLoading(false)
      }
    }

    fetchPool()
  }, [code])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pool || !name.trim() || !password.trim()) return

    setJoining(true)
    setError("")

    try {
      const response = await fetch(`/api/pools/${pool.id}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), password: password }),
      })

      if (response.ok) {
        const participant = await response.json()
        
        // Create session with HTTP-only cookie
        const sessionResponse = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participantId: participant.id,
            participantName: participant.name,
            poolId: pool.id,
            password: password,
          }),
        })
        
        if (!sessionResponse.ok) {
          setError("Erro ao criar sessao")
          return
        }
        
        router.push(`/pool/${pool.id}`)
      } else {
        const data = await response.json()
        setError(data.error || "Erro ao entrar no bolao")
      }
    } catch {
      setError("Erro ao entrar no bolao")
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!pool) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Bolao nao encontrado</CardTitle>
            <CardDescription>O codigo de convite e invalido ou o bolao nao existe mais.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para a pagina inicial
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Trophy className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Copa Bolao</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-md">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Entrar no Bolao</CardTitle>
              <CardDescription>
                Voce foi convidado para participar do bolao <strong>{pool.name}</strong> criado por{" "}
                <strong>{pool.admin_name}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleJoin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Seu nome</Label>
                  <Input
                    id="name"
                    placeholder="Digite seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Sua Senha
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Crie ou digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <span className="text-xs text-muted-foreground">
                    Novo usuario? Crie uma senha. Ja tem conta? Digite sua senha.
                  </span>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button type="submit" className="w-full" disabled={joining || !name.trim() || !password.trim()}>
                  {joining ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    "Entrar no Bolao"
                  )}
                </Button>
              </form>

              <div className="mt-4 pt-4 border-t">
                <Link href="/">
                  <Button variant="ghost" className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar para a pagina inicial
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
