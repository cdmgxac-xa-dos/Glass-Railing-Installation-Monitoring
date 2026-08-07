import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import type { Project } from '../types'
import { MOCK_PROJECTS } from '../data/mockData'
import { getLocationsByProject } from './locationService'

// ---------------------------------------------------------------------------
// Project service — backed by the real, shared `projects` table (via the
// gr_get_visible_projects() RPC, see
// xa-dos-glass-railing/supabase/02_project_scoping_rls.sql) rather than a
// hardcoded list. The RPC already filters to only the project(s) the
// current user is rostered on for project-scoped roles (PIC, Safety
// Officer, QC, Installer, Warehouseman); global roles (Owner, Project
// Manager, etc.) see every active project, same as before.
//
// DUAL MODE: mock mode still returns the three hardcoded mock projects,
// unchanged, for local/offline development.
// ---------------------------------------------------------------------------

export async function getProjects(): Promise<Project[]> {
  if (!isSupabaseConfigured || !supabase) {
    return MOCK_PROJECTS
  }

  const { data, error } = await supabase.rpc('gr_get_visible_projects')
  if (error) throw error

  const rows = (data ?? []) as { id: string; project_code: string; name: string | null; site_location: string | null }[]

  return Promise.all(
    rows.map(async (p) => {
      const locations = await getLocationsByProject(p.project_code)
      return {
        id: p.id,
        code: p.project_code,
        name: p.name ?? p.project_code,
        location: p.site_location ?? '',
        totalLocations: locations.length,
      }
    }),
  )
}

export async function getProjectByCode(code: string): Promise<Project | undefined> {
  const projects = await getProjects()
  return projects.find((p) => p.code === code)
}
