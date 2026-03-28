import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

// GET: top scores — max survival_time per name, sorted DESC
export async function GET() {
  // Fetch all scores, then aggregate max per name on server
  const { data, error } = await supabase
    .from('scores')
    .select('name, survival_time, created_at')
    .order('survival_time', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Keep only the best score per name
  const bestMap = new Map<string, { name: string; survival_time: number; created_at: string }>()
  for (const row of data || []) {
    const existing = bestMap.get(row.name)
    if (!existing || row.survival_time > existing.survival_time) {
      bestMap.set(row.name, row)
    }
  }

  const ranked = Array.from(bestMap.values())
    .sort((a, b) => b.survival_time - a.survival_time)
    .slice(0, 50)

  return NextResponse.json(ranked)
}

// POST: save a new score
export async function POST(req: NextRequest) {
  const body = await req.json()
  const name = (body.name || '???').slice(0, 20)
  const survivalTime = parseFloat(body.survival_time)
  const route = (body.route || '').slice(0, 30)
  const ending = (body.ending || '').slice(0, 30)

  if (isNaN(survivalTime) || survivalTime < 0 || survivalTime > 999) {
    return NextResponse.json({ error: 'Invalid survival_time' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('scores')
    .insert({ name, survival_time: survivalTime, route, ending })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}
