import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// This is a standalone Supabase project — separate from the XA-DOS Field
// Monitoring app's project. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
// in .env.local (see .env.example) after running the SQL in supabase/.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.'
    )
  }
  return supabase
}
