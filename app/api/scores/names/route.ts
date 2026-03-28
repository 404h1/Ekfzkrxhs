import { NextResponse } from 'next/server'
import { hasSupabaseConfig, supabase } from '@/lib/db'

/*
 * Nickname lookup is separated from score writes so the client can generate a
 * lightweight random handle without coupling that UI flow to leaderboard fetches.
 */

// GET: return all distinct names in the DB
export async function GET() {
  if (!hasSupabaseConfig) {
    return NextResponse.json([])
  }

  const { data, error } = await supabase
    .from('scores')
    .select('name')

  if (error) {
    return NextResponse.json([])
  }

  const names = [...new Set((data || []).map((r) => r.name))]
  return NextResponse.json(names)
}
