import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import type { ChecklistState, ChecklistStageKey } from '../types'
import { CHECKLIST_STAGES } from '../types'
import { buildInitialChecklist } from '../data/mockData'
import { getLocationById } from './locationService'

// ---------------------------------------------------------------------------
// Checklist service — reads/writes the 10-stage installation checklist per
// location, backed by gr_installation_updates (one row per location+stage
// that's actually been touched; unique(location_id, stage)).
//
// DUAL MODE, same pattern as locationService.ts: mock in-memory store when
// Supabase isn't configured, real queries when it is.
//
// IMPORTANT BEHAVIORAL DIFFERENCE between modes: the mock store lazily
// seeds a location's first checklist read with buildInitialChecklist(),
// which fabricates plausible in-progress state from the location's status
// (mock-only convenience data). Real mode does NOT do this — a location
// with zero gr_installation_updates rows genuinely has an untouched
// checklist, so getChecklist() returns all 10 stages as incomplete/empty.
// Carrying the mock's fake-progress seeding into real mode would silently
// misrepresent actual field data.
// ---------------------------------------------------------------------------

interface GrInstallationUpdateRow {
  id: string
  location_id: string
  stage: ChecklistStageKey
  is_completed: boolean
  updated_at: string | null
  updated_by: string | null
  remark: string | null
}

function emptyChecklist(): ChecklistState {
  const state = {} as ChecklistState
  CHECKLIST_STAGES.forEach(({ key }) => {
    state[key] = {
      stage: key,
      isCompleted: false,
      updatedAt: null,
      updatedBy: null,
      remark: '',
    }
  })
  return state
}

// Mock-only in-memory per-location checklist store.
const mockChecklistStore = new Map<string, ChecklistState>()

export async function getChecklist(locationId: string): Promise<ChecklistState> {
  if (!isSupabaseConfigured) {
    if (!mockChecklistStore.has(locationId)) {
      const location = await getLocationById(locationId)
      if (location) {
        mockChecklistStore.set(locationId, buildInitialChecklist(location))
      }
    }
    return mockChecklistStore.get(locationId) ?? emptyChecklist()
  }

  const { data, error } = await supabase!
    .from('gr_installation_updates')
    .select('*')
    .eq('location_id', locationId)

  if (error) throw error

  const state = emptyChecklist()
  ;(data as GrInstallationUpdateRow[]).forEach((row) => {
    state[row.stage] = {
      stage: row.stage,
      isCompleted: row.is_completed,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
      remark: row.remark ?? '',
    }
  })
  return state
}

export async function updateChecklistStage(
  locationId: string,
  stage: ChecklistStageKey,
  updates: { isCompleted?: boolean; remark?: string; updatedBy: string },
): Promise<ChecklistState> {
  if (!isSupabaseConfigured) {
    const current = await getChecklist(locationId)
    current[stage] = {
      stage,
      isCompleted: updates.isCompleted ?? current[stage].isCompleted,
      updatedAt: new Date().toISOString(),
      updatedBy: updates.updatedBy,
      remark: updates.remark ?? current[stage].remark,
    }
    mockChecklistStore.set(locationId, { ...current })
    return current
  }

  // Fetch current state first so omitted fields (isCompleted/remark) keep
  // their existing value rather than being clobbered — same "only touch
  // what's actually passed" semantics as the mock version. Toggling
  // completion and saving a remark are separate calls; neither should
  // overwrite the other.
  const current = await getChecklist(locationId)
  const isCompleted = updates.isCompleted ?? current[stage].isCompleted
  const remark = updates.remark ?? current[stage].remark

  const { error } = await supabase!.from('gr_installation_updates').upsert(
    {
      location_id: locationId,
      stage,
      is_completed: isCompleted,
      updated_at: new Date().toISOString(),
      updated_by: updates.updatedBy,
      remark,
    },
    { onConflict: 'location_id,stage' },
  )

  if (error) throw error

  // Re-fetch the full 10-stage state to return, matching the mock's
  // contract of always returning the complete ChecklistState after a
  // mutation, not just the single changed entry.
  return getChecklist(locationId)
}
