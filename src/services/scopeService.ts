import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { getLocationsByProject } from './locationService'

// ---------------------------------------------------------------------------
// Scope service — which installation scopes (Railings, Doors & Windows, ...)
// actually have data on a given project. Backs ScopeSelectionPage's decision
// to show a picker at all: today every project has data for exactly one
// scope (RAILING), so this always resolves to a single entry and the picker
// auto-continues without the user seeing it. See
// supabase/05_scope_foundation.sql for the installation_scopes /
// gr_locations.scope columns this reads.
// ---------------------------------------------------------------------------

export interface ScopeSummary {
  code: string
  name: string
  locationCount: number
}

export async function getScopesForProject(projectCode: string): Promise<ScopeSummary[]> {
  if (!isSupabaseConfigured) {
    // Mock data predates the scope column and is all railings, so mock mode
    // always reports a single Railing scope — matches real-mode behavior on
    // every project today.
    const locations = await getLocationsByProject(projectCode)
    return locations.length ? [{ code: 'RAILING', name: 'Glass Railings', locationCount: locations.length }] : []
  }

  const { data, error } = await supabase!.from('gr_locations').select('scope').eq('project_code', projectCode)

  if (error) throw error

  const counts = new Map<string, number>()
  ;(data as { scope: string }[]).forEach((row) => {
    counts.set(row.scope, (counts.get(row.scope) ?? 0) + 1)
  })

  if (counts.size === 0) return []

  const { data: scopeRows, error: scopeError } = await supabase!
    .from('installation_scopes')
    .select('code, name')
    .in('code', Array.from(counts.keys()))
    .order('sort_order')

  if (scopeError) throw scopeError

  return (scopeRows as { code: string; name: string }[]).map((s) => ({
    code: s.code,
    name: s.name,
    locationCount: counts.get(s.code) ?? 0,
  }))
}
