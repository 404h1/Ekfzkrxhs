import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

/*
 * The backend client is always constructible so the app can boot in demo mode
 * even when Supabase secrets are not configured. Route handlers gate real reads
 * and writes through `hasSupabaseConfig`.
 */

export const hasSupabaseConfig =
  url !== 'https://placeholder.supabase.co' &&
  key !== 'placeholder'

// Server-side: use service role key to bypass RLS
export const supabase = createClient(url, key)
