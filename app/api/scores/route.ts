import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

// GET: top scores sorted by survival_time DESC
export async function GET() {
  const { data, error } = await supabase
    .from('scores')
    .select('name, survival_time, route, ending, created_at')
    .order('survival_time', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
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
