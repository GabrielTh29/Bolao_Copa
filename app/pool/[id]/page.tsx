import { createClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
import { PoolDashboard } from "@/components/pool-dashboard"
import { getSession } from "@/lib/session"

interface PoolPageProps {
  params: Promise<{ id: string }>
}

export default async function PoolPage({ params }: PoolPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Busca sessao do servidor
  const session = await getSession()
  
  // Se nao tiver sessao ou a sessao for de outro pool, busca o pool para redirecionar
  const { data: pool, error: poolError } = await supabase
    .from("pools")
    .select("*")
    .eq("id", id)
    .single()

  if (poolError || !pool) {
    notFound()
  }

  // Verifica se a sessao e valida para este pool
  if (!session || session.poolId !== id) {
    redirect(`/join/${pool.invite_code}`)
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
