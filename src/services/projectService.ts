import { isSupabaseConfigured } from '../lib/supabaseClient'
import type { Project } from '../types'
import { MOCK_PROJECTS } from '../data/mockData'
import { getLocationsByProject } from './locationService'

// ---------------------------------------------------------------------------
// Project service — the one Glass Railing service not backed by its own
// gr_-prefixed table, since no real `projects` table exists yet in XA DOS
// (only a placeholder comment in the estimating schema — see
// locationService.ts's PROJECT_NAMES for the same constraint).
//
// DUAL MODE: mock mode returns the three hardcoded mock projects, exactly
// as before. Real mode returns the two real, known project codes with a
// LIVE count of gr_locations per project, rather than a hardcoded number —
// a static count would silently go stale the moment more floors are
// imported (Spinnaker's Excel register is still unfinished past floor 11)
// or the moment TRAT gets its first real location (currently zero), which
// would otherwise leave it permanently un-clickable on this page.
//
// `location` (site address) is intentionally left blank for real projects
// — no verified address exists in available project context, and
// fabricating one for a real client project is worse than leaving it
// blank pending the real value.
// ---------------------------------------------------------------------------

interface RealProjectDef {
  id: string
  code: string
  name: string
}

const REAL_PROJECTS: RealProjectDef[] = [
  { id: 'PRJ-26070002', code: 'PRJ-26070002', name: 'The Spinnaker at Club Laiya' },
  { id: 'PRJ-26070003', code: 'PRJ-26070003', name: 'TRAT' },
]

export async function getProjects(): Promise<Project[]> {
  if (!isSupabaseConfigured) {
    return MOCK_PROJECTS
  }

  return Promise.all(
    REAL_PROJECTS.map(async (p) => {
      const locations = await getLocationsByProject(p.code)
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        location: '', // TBD — no verified address available yet
        totalLocations: locations.length,
      }
    }),
  )
}

export async function getProjectByCode(code: string): Promise<Project | undefined> {
  const projects = await getProjects()
  return projects.find((p) => p.code === code)
}
