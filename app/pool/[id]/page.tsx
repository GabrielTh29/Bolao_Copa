import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { PoolDashboard } from "@/components/pool-dashboard"

interface PoolPageProps {
  params: Promise<{ id: string }>
}

export default async function PoolPage({ params }: PoolPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: pool, error: poolError } = await supabase
    .from("pools")
    .select("*")
    .eq("id", id)
    .single()

  if (poolError || !pool) {
    notFound()
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
    />
  )
}
