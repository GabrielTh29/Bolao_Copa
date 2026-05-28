import { createClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
import { PoolDashboard } from "@/components/pool-dashboard"
import { getSession } from "@/lib/session"
import type { SessionData } from "@/lib/session"

interface PoolPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ pid?: string; pname?: string }>
}

export default async function PoolPage({ params, searchParams }: PoolPageProps) {
  const { id } = await params
  const { pid, pname } = await searchParams
  const supabase = await createClient()

  // Busca o pool primeiro
  const { data: pool, error: poolError } = await supabase
    .from("pools")
    .select("*")
    .eq("id", id)
    .single()

  if (poolError || !pool) {
    notFound()
  }

  // Prioriza dados da URL (vindo da criacao/entrada do bolao)
  let session: SessionData | null = null
  
  if (pid && pname) {
    // Participante vindo da página de criar/entrar - usa dados da URL diretamente
    session = {
      participantId: pid,
      participantName: decodeURIComponent(pname),
      poolId: id,
    }
  } else {
    // Tenta buscar sessão existente dos cookies
    session = await getSession()
    
    // Se não tem sessão ou é de outro pool, redireciona para join
    if (!session || session.poolId !== id) {
      redirect(`/join/${pool.invite_code}`)
    }
  }

  const { data: participants } = await supabase
    .from("participants")
    .select("*")
    .eq("pool_id", id)
    .order("created_at", { ascending: true })

  const { data: matches } = await supabase
    .from("matches")
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(*),
      away_team:teams!matches_away_team_id_fkey(*)
    `)
    .order("match_date", { ascending: true })

  return (
    <PoolDashboard 
      pool={pool} 
      initialParticipants={participants || []} 
      initialMatches={matches || []}
      session={session}
    />
  )
}
