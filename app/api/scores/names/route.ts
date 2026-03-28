import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

// GET: return all distinct names in the DB
export async function GET() {
  const { data, error } = await supabase
    .from('scores')
    .select('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const names = [...new Set((data || []).map((r) => r.name))]
  return NextResponse.json(names)
}
