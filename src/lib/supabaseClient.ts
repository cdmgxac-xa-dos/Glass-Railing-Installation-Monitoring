import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Supabase client configuration.
//
// This app currently runs entirely on mock data (see src/data/mockData.ts
// and src/services/*). This client is wired up so that when the services
// are switched over to real queries, no other part of the app needs to
// change — pages only ever talk to the service layer.
//
// Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in a .env.local file
// (see .env.example) to connect to the real XA DOS Supabase project.
// ---------------------------------------------------------------------------

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// During mock-data development the env vars may be unset. We avoid throwing
// so the app can still run fully on mock data; real queries would fail
// loudly and obviously if attempted without configuration.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
