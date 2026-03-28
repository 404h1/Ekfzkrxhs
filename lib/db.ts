import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

export const hasSupabaseConfig =
  url !== 'https://placeholder.supabase.co' &&
  key !== 'placeholder'

// Server-side: use service role key to bypass RLS
export const supabase = createClient(url, key)
