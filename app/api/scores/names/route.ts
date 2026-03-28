import { NextResponse } from 'next/server'
import { hasSupabaseConfig, supabase } from '@/lib/db'

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
