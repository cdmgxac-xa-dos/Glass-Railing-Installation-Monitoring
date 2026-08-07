import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { MOCK_LOCATIONS } from '../data/mockData'
import type {
  FloorSummary,
  LocationStatus,
  OwnerDashboardSummary,
  ProjectDashboardSummary,
  RailingLocation,
  StatusCounts,
  UnitType,
  UnitTypeSummary,
} from '../types'
import { LOCATION_STATUSES } from '../types'

// ---------------------------------------------------------------------------
// Location service — all reads/writes to railing location records go
// through here.
//
// DUAL MODE: when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are configured
// (see src/lib/supabaseClient.ts), every function below queries the real
// gr_locations table. When they're unset — e.g. a fresh clone with no
// .env.local yet — every function falls back to the in-memory mock array,
// exactly as this service worked before Supabase wiring. No page needs to
// know or care which mode is active.
//
// RLS is live on gr_locations in real mode, enforced via
// has_module_access('field_ops', ...) — see supabase/schema.sql. If a real
// query returns fewer rows than expected, or an update silently affects
// zero rows, the first suspect is RLS on the calling session, not this
// file's logic.
// ---------------------------------------------------------------------------

// No real `projects` table exists yet in XA DOS (only a placeholder
// comment in the estimating schema), so gr_locations.project_code is a
// plain text column with nothing to join against. This lookup exists only
// to preserve the RailingLocation.projectName field the UI already
// expects; swap it for a real join once a `projects` table exists.
const PROJECT_NAMES: Record<string, string> = {
  'PRJ-26070002': 'The Spinnaker at Club Laiya',
  'PRJ-26070003': 'TRAT',
}

function projectNameFor(projectCode: string): string {
  return PROJECT_NAMES[projectCode] ?? projectCode
}

// Raw shape of a gr_locations row as returned by Supabase (snake_case).
interface GrLocationRow {
  id: string
  project_code: string
  floor_level: string
  unit_no: string
  unit_type: RailingLocation['unitType']
  total_linear_meters: number
  total_glass_panels: number
  bracket_system: RailingLocation['bracketSystem']
  priority: RailingLocation['priority']
  assigned_team: RailingLocation['assignedTeam']
  status: LocationStatus
  remarks: string | null
  updated_at: string
}

function mapRow(row: GrLocationRow): RailingLocation {
  return {
    id: row.id,
    projectCode: row.project_code,
    projectName: projectNameFor(row.project_code),
    floorLevel: row.floor_level,
    unitNo: row.unit_no,
    unitType: row.unit_type,
    totalLinearMeters: row.total_linear_meters,
    totalGlassPanels: row.total_glass_panels,
    bracketSystem: row.bracket_system,
    priority: row.priority,
    assignedTeam: row.assigned_team,
    status: row.status,
    remarks: row.remarks ?? '',
    updatedAt: row.updated_at,
  }
}

// In-memory mutable store, used only in mock mode, so status updates
// persist for the session (mock only — resets on reload). Untouched when
// Supabase is configured.
const mockStore: RailingLocation[] = [...MOCK_LOCATIONS]

// Floor labels are real, project-specific building nomenclature
// (e.g. '7th Floor', '8th Floor' for Spinnaker) rather than a fixed set —
// different projects may use entirely different conventions ('GF',
// 'Mezzanine', 'Penthouse', etc.). Rather than maintaining a hardcoded
// FLOOR_ORDER list per project, floors are discovered from the actual
// data and sorted naturally by extracting the leading number. Labels with
// no leading number (e.g. 'Roof Deck', 'Ground Floor') sort after all
// numbered floors, in the order they're first encountered.
function naturalFloorSort(floors: string[]): string[] {
  const withNum: { label: string; num: number }[] = []
  const withoutNum: string[] = []
  floors.forEach((f) => {
    const match = f.match(/\d+/)
    if (match) {
      withNum.push({ label: f, num: parseInt(match[0], 10) })
    } else {
      withoutNum.push(f)
    }
  })
  withNum.sort((a, b) => a.num - b.num)
  return [...withNum.map((f) => f.label), ...withoutNum]
}

function emptyStatusCounts(): Record<LocationStatus, number> {
  return {
    'Not Started': 0,
    'In Progress': 0,
    'QC Inspection': 0,
    'Punch List': 0,
    'On Hold': 0,
    Completed: 0,
  }
}

export async function getLocationsByProject(projectCode: string): Promise<RailingLocation[]> {
  if (!isSupabaseConfigured) {
    return mockStore.filter((l) => l.projectCode === projectCode)
  }
  const { data, error } = await supabase!
    .from('gr_locations')
    .select('*')
    .eq('project_code', projectCode)
    .order('id')

  if (error) throw error
  return (data as GrLocationRow[]).map(mapRow)
}

export async function getLocationById(id: string): Promise<RailingLocation | undefined> {
  if (!isSupabaseConfigured) {
    return mockStore.find((l) => l.id === id)
  }
  const { data, error } = await supabase!.from('gr_locations').select('*').eq('id', id).maybeSingle()

  if (error) throw error
  return data ? mapRow(data as GrLocationRow) : undefined
}

export async function updateLocationStatus(id: string, status: LocationStatus): Promise<void> {
  if (!isSupabaseConfigured) {
    const loc = mockStore.find((l) => l.id === id)
    if (loc) {
      loc.status = status
      loc.updatedAt = new Date().toISOString()
    }
    return
  }
  const { error } = await supabase!
    .from('gr_locations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

export async function getFloorsForProject(projectCode: string): Promise<FloorSummary[]> {
  const locations = await getLocationsByProject(projectCode)
  const counts = new Map<string, number>()
  locations.forEach((l) => counts.set(l.floorLevel, (counts.get(l.floorLevel) ?? 0) + 1))
  return naturalFloorSort(Array.from(counts.keys())).map((floor) => ({
    floorLevel: floor,
    locationCount: counts.get(floor) ?? 0,
  }))
}

export async function getUnitTypesForFloor(projectCode: string, floorLevel: string): Promise<UnitTypeSummary[]> {
  let locations: RailingLocation[]
  if (!isSupabaseConfigured) {
    locations = mockStore.filter((l) => l.projectCode === projectCode && l.floorLevel === floorLevel)
  } else {
    const { data, error } = await supabase!
      .from('gr_locations')
      .select('*')
      .eq('project_code', projectCode)
      .eq('floor_level', floorLevel)

    if (error) throw error
    locations = (data as GrLocationRow[]).map(mapRow)
  }

  const counts = new Map<UnitType, number>()
  locations.forEach((l) => counts.set(l.unitType, (counts.get(l.unitType) ?? 0) + 1))
  // unit_type is free text in gr_locations (real values like 'Studio Unit',
  // '1 BR', 'Beachfront' don't match any fixed enum) — discover from data
  // rather than mapping over the static UNIT_TYPES list.
  return Array.from(counts.keys()).map((ut) => ({ unitType: ut, locationCount: counts.get(ut) ?? 0 }))
}

export async function getLocations(filters: {
  projectCode: string
  floorLevel?: string
  unitType?: UnitType
}): Promise<RailingLocation[]> {
  if (!isSupabaseConfigured) {
    return mockStore.filter(
      (l) =>
        l.projectCode === filters.projectCode &&
        (!filters.floorLevel || l.floorLevel === filters.floorLevel) &&
        (!filters.unitType || l.unitType === filters.unitType),
    )
  }

  let query = supabase!.from('gr_locations').select('*').eq('project_code', filters.projectCode)
  if (filters.floorLevel) query = query.eq('floor_level', filters.floorLevel)
  if (filters.unitType) query = query.eq('unit_type', filters.unitType)

  const { data, error } = await query.order('id')
  if (error) throw error
  return (data as GrLocationRow[]).map(mapRow)
}

// Every distinct unit type currently in use for a project — real, free-text
// values (not the static UNIT_TYPES enum). Used to populate filter
// dropdowns (e.g. LocationCardsPage) against actual data instead of a
// fixed six-value list that real values like 'Studio Unit' or '1 BR' don't
// match. Works in both mock and real mode via getLocationsByProject.
export async function getUnitTypesInUse(projectCode: string): Promise<UnitType[]> {
  const locations = await getLocationsByProject(projectCode)
  return Array.from(new Set(locations.map((l) => l.unitType))).sort()
}

export async function getProjectDashboard(projectCode: string): Promise<ProjectDashboardSummary> {
  const locations = await getLocationsByProject(projectCode)
  const statusCounts = emptyStatusCounts()
  locations.forEach((l) => {
    statusCounts[l.status] += 1
  })
  const completed = statusCounts.Completed
  const overallProgressPct = locations.length ? Math.round((completed / locations.length) * 100) : 0

  // "Today" figures are still a deterministic slice, same as the original
  // mock-only version — gr_locations doesn't currently record per-day
  // deltas. Replace with a real query against gr_activity_logs
  // (occurred_on = current_date) once daily-accomplishment reporting is
  // built.
  const workedToday = locations.filter((l) => l.status === 'In Progress').slice(0, 4)

  // Per-floor status breakdown, feeds the dashboard's floor doughnuts.
  const floorMap = new Map<string, StatusCounts>()
  locations.forEach((l) => {
    const counts = floorMap.get(l.floorLevel) ?? emptyStatusCounts()
    counts[l.status] += 1
    floorMap.set(l.floorLevel, counts)
  })
  const byFloorStatus = naturalFloorSort(Array.from(floorMap.keys())).map((floorLevel) => {
    const counts = floorMap.get(floorLevel)!
    const locationCount = Object.values(counts).reduce((a, b) => a + b, 0)
    return { floorLevel, statusCounts: counts, locationCount }
  })

  return {
    projectName: locations[0]?.projectName ?? projectNameFor(projectCode),
    overallProgressPct,
    statusCounts,
    locationsWorkedToday: workedToday.length,
    linearMetersInstalledToday:
      Math.round(workedToday.reduce((sum, l) => sum + l.totalLinearMeters * 0.3, 0) * 10) / 10,
    panelsInstalledToday: Math.round(workedToday.reduce((sum, l) => sum + l.totalGlassPanels * 0.3, 0)),
    qcPending: statusCounts['QC Inspection'],
    byFloorStatus,
  }
}

export async function getOwnerDashboard(projectCode: string): Promise<OwnerDashboardSummary> {
  const locations = await getLocationsByProject(projectCode)
  const statusCounts = emptyStatusCounts()
  locations.forEach((l) => {
    statusCounts[l.status] += 1
  })

  const totalLinearMeters = round1(locations.reduce((s, l) => s + l.totalLinearMeters, 0))
  const installedLinearMeters = round1(
    locations.filter((l) => l.status === 'Completed').reduce((s, l) => s + l.totalLinearMeters, 0),
  )
  const totalGlassPanels = locations.reduce((s, l) => s + l.totalGlassPanels, 0)
  const installedGlassPanels = locations
    .filter((l) => l.status === 'Completed')
    .reduce((s, l) => s + l.totalGlassPanels, 0)

  const groupCount = <T extends string>(getKey: (l: RailingLocation) => T, order?: T[]) => {
    const map = new Map<string, number>()
    locations.forEach((l) => {
      const k = getKey(l)
      map.set(k, (map.get(k) ?? 0) + 1)
    })
    const keys = order ?? Array.from(map.keys())
    return keys.map((label) => ({ label, count: map.get(label) ?? 0 }))
  }

  return {
    totalLocations: locations.length,
    statusCounts,
    overallCompletionPct: locations.length ? Math.round((statusCounts.Completed / locations.length) * 100) : 0,
    totalLinearMeters,
    installedLinearMeters,
    totalGlassPanels,
    installedGlassPanels,
    byFloor: groupCount((l) => l.floorLevel, naturalFloorSort(Array.from(new Set(locations.map((l) => l.floorLevel))))),
    byUnitType: groupCount((l) => l.unitType, Array.from(new Set(locations.map((l) => l.unitType)))),
    byTeam: groupCount((l) => l.assignedTeam),
    byBracketSystem: groupCount((l) => l.bracketSystem),
    byStatus: groupCount((l) => l.status, LOCATION_STATUSES),
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
