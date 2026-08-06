import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import type { AssignedTeam, Priority, PunchListItem, PunchListStatus } from '../types'
import { MOCK_PUNCH_LIST } from '../data/mockData'
import { getLocationById, getLocationsByProject, updateLocationStatus } from './locationService'
import { addTimelineEvent } from './timelineService'

// ---------------------------------------------------------------------------
// Punch-list service — backed by gr_punch_items.
//
// DUAL MODE: mock mode keeps the original sequential in-memory sync logic
// (syncLocationStatusFromPunchList). Real mode delegates status-update +
// location-sync cascade to the update_punch_list_status() Postgres
// function — one atomic transaction instead of an UPDATE followed by a
// separate re-evaluation SELECT/UPDATE pair over the network. See
// supabase/qc_punchlist_rpc.sql.
// ---------------------------------------------------------------------------

interface GrPunchItemRow {
  id: string
  location_id: string
  issue_description: string
  category: string
  priority: Priority
  assigned_team: AssignedTeam
  status: PunchListStatus
  date_found: string
  target_completion_date: string | null
  rectification_notes: string | null
  qc_verification: string | null
}

function mapRow(row: GrPunchItemRow): PunchListItem {
  return {
    id: row.id,
    locationId: row.location_id,
    issueDescription: row.issue_description,
    category: row.category,
    priority: row.priority,
    assignedTeam: row.assigned_team,
    status: row.status,
    dateFound: row.date_found,
    targetCompletionDate: row.target_completion_date ?? '',
    rectificationNotes: row.rectification_notes ?? '',
    qcVerification: row.qc_verification ?? '',
  }
}

// Mock-only in-memory store.
const mockStore: PunchListItem[] = [...MOCK_PUNCH_LIST]
let mockCounter = mockStore.length + 1

// Only locations already in the punch-list flow are eligible for automatic
// transitions in mock mode — mirrors the same guard inside
// update_punch_list_status() in real mode.
const PUNCH_LIST_FLOW_STATUSES = ['Punch List', 'QC Inspection'] as const

export async function getPunchListForProject(projectCode: string): Promise<PunchListItem[]> {
  if (!isSupabaseConfigured) {
    const results: PunchListItem[] = []
    for (const item of mockStore) {
      const loc = await getLocationById(item.locationId)
      if (loc?.projectCode === projectCode) results.push(item)
    }
    return results
  }

  // Real mode: one query for the project's location IDs, one query for
  // their punch items — not N sequential getLocationById() round-trips
  // per item, which the mock's loop-based filter would otherwise become.
  const locations = await getLocationsByProject(projectCode)
  if (locations.length === 0) return []

  const { data, error } = await supabase!
    .from('gr_punch_items')
    .select('*')
    .in(
      'location_id',
      locations.map((l) => l.id),
    )
    .order('date_found')

  if (error) throw error
  return (data as GrPunchItemRow[]).map(mapRow)
}

export async function getPunchListForLocation(locationId: string): Promise<PunchListItem[]> {
  if (!isSupabaseConfigured) {
    return mockStore.filter((p) => p.locationId === locationId)
  }

  const { data, error } = await supabase!
    .from('gr_punch_items')
    .select('*')
    .eq('location_id', locationId)
    .order('date_found')

  if (error) throw error
  return (data as GrPunchItemRow[]).map(mapRow)
}

// Direct punch-item creation, independent of the QC-failure cascade (which
// in real mode creates its punch item internally inside
// submit_qc_inspection()). Kept for any manual/non-QC punch-item entry
// path, and to preserve the original signature for existing callers.
export async function addPunchListItem(input: {
  locationId: string
  issueDescription: string
  category: string
  priority: Priority
}): Promise<PunchListItem> {
  if (!isSupabaseConfigured) {
    const loc = await getLocationById(input.locationId)
    const item: PunchListItem = {
      id: `PL-${(mockCounter++).toString().padStart(3, '0')}`,
      locationId: input.locationId,
      issueDescription: input.issueDescription,
      category: input.category,
      priority: input.priority,
      assignedTeam: (loc?.assignedTeam ?? 'Team A') as AssignedTeam,
      status: 'Open',
      dateFound: new Date().toISOString().slice(0, 10),
      targetCompletionDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      rectificationNotes: '',
      qcVerification: '',
    }
    mockStore.push(item)
    return item
  }

  const loc = await getLocationById(input.locationId)
  const targetDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data, error } = await supabase!
    .from('gr_punch_items')
    .insert({
      location_id: input.locationId,
      issue_description: input.issueDescription,
      category: input.category,
      priority: input.priority,
      assigned_team: loc?.assignedTeam ?? 'Team A',
      status: 'Open',
      date_found: new Date().toISOString().slice(0, 10),
      target_completion_date: targetDate,
    })
    .select('*')
    .single()

  if (error) throw error
  return mapRow(data as GrPunchItemRow)
}

export async function updatePunchListStatus(id: string, status: PunchListStatus, updatedBy: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const item = mockStore.find((p) => p.id === id)
    if (!item) return
    item.status = status
    await syncLocationStatusFromPunchList(item.locationId, updatedBy)
    return
  }

  const { error } = await supabase!.rpc('update_punch_list_status', {
    p_punch_item_id: id,
    p_status: status,
    p_updated_by: updatedBy,
  })

  if (error) throw error
}

// Mock-only: real mode's equivalent logic lives inside the
// update_punch_list_status() Postgres function.
async function syncLocationStatusFromPunchList(locationId: string, updatedBy: string): Promise<void> {
  const loc = await getLocationById(locationId)
  if (!loc || !PUNCH_LIST_FLOW_STATUSES.includes(loc.status as (typeof PUNCH_LIST_FLOW_STATUSES)[number])) return

  const items = mockStore.filter((p) => p.locationId === locationId)
  if (items.length === 0) return

  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const time = now.toTimeString().slice(0, 5)

  const allClosed = items.every((i) => i.status === 'Closed')
  const allAtLeastForVerification = items.every((i) => i.status === 'For Verification' || i.status === 'Closed')

  if (allClosed) {
    if (loc.status !== 'Completed') {
      await updateLocationStatus(locationId, 'Completed')
      await addTimelineEvent({ locationId, date, time, user: updatedBy, action: 'All Punch Items Closed', remarks: '' })
      await addTimelineEvent({ locationId, date, time, user: updatedBy, action: 'Completed', remarks: '' })
    }
  } else if (allAtLeastForVerification) {
    if (loc.status !== 'QC Inspection') {
      await updateLocationStatus(locationId, 'QC Inspection')
      await addTimelineEvent({ locationId, date, time, user: updatedBy, action: 'Rectified', remarks: '' })
    }
  } else if (loc.status === 'QC Inspection') {
    await updateLocationStatus(locationId, 'Punch List')
    await addTimelineEvent({ locationId, date, time, user: updatedBy, action: 'Punch Item Reopened', remarks: '' })
  }
}
