import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import type { Priority, QCInspectionRecord, QCResult } from '../types'
import { MOCK_QC_RECORDS } from '../data/mockData'
import { addPunchListItem } from './punchListService'
import { getLocationById, getLocationsByProject, updateLocationStatus } from './locationService'
import { addTimelineEvent } from './timelineService'

// ---------------------------------------------------------------------------
// QC inspection service — backed by gr_qc_inspections.
//
// DUAL MODE: mock mode replicates the original sequential cascade
// in-memory (can't partially fail, single synchronous operation). Real
// mode delegates the entire cascade (QC record + punch item + location
// status + timeline entries) to the submit_qc_inspection() Postgres
// function — a single atomic transaction, closing the partial-failure gap
// that sequential client-side calls would have had over a real network.
// See supabase/qc_punchlist_rpc.sql.
// ---------------------------------------------------------------------------

interface GrQcInspectionRow {
  id: string
  location_id: string
  result: QCResult | null
  item_results: Record<string, boolean>
  issue_description: string | null
  priority: Priority | null
  photo_attached: boolean | null
  inspected_by: string | null
  inspected_at: string
}

function mapRow(row: GrQcInspectionRow): QCInspectionRecord {
  return {
    id: row.id,
    locationId: row.location_id,
    result: row.result,
    itemResults: row.item_results ?? {},
    issueDescription: row.issue_description ?? undefined,
    priority: row.priority ?? undefined,
    photoAttached: row.photo_attached ?? undefined,
    inspectedBy: row.inspected_by ?? '',
    inspectedAt: row.inspected_at,
  }
}

// Mock-only in-memory store.
const mockStore: QCInspectionRecord[] = [...MOCK_QC_RECORDS]
let mockCounter = mockStore.length + 1

export async function getQCRecordsForLocation(locationId: string): Promise<QCInspectionRecord[]> {
  if (!isSupabaseConfigured) {
    return mockStore.filter((r) => r.locationId === locationId)
  }

  const { data, error } = await supabase!
    .from('gr_qc_inspections')
    .select('*')
    .eq('location_id', locationId)
    .order('inspected_at')

  if (error) throw error
  return (data as GrQcInspectionRow[]).map(mapRow)
}

// Project-scoped fetch for the Reports feature. Mirrors
// punchListService.ts's getPunchListForProject() — one .in() query in real
// mode rather than N sequential getLocationById() round-trips per record.
export async function getQCRecordsForProject(projectCode: string): Promise<QCInspectionRecord[]> {
  if (!isSupabaseConfigured) {
    const results: QCInspectionRecord[] = []
    for (const record of mockStore) {
      const loc = await getLocationById(record.locationId)
      if (loc?.projectCode === projectCode) results.push(record)
    }
    return results
  }

  const locations = await getLocationsByProject(projectCode)
  if (locations.length === 0) return []

  const { data, error } = await supabase!
    .from('gr_qc_inspections')
    .select('*')
    .in(
      'location_id',
      locations.map((l) => l.id),
    )
    .order('inspected_at')

  if (error) throw error
  return (data as GrQcInspectionRow[]).map(mapRow)
}

export async function submitQCInspection(input: {
  locationId: string
  itemResults: Record<string, boolean>
  result: QCResult
  issueDescription?: string
  priority?: Priority
  photoAttached?: boolean
  inspectedBy: string
}): Promise<QCInspectionRecord> {
  if (!isSupabaseConfigured) {
    const record: QCInspectionRecord = {
      id: `QC-${(mockCounter++).toString().padStart(3, '0')}`,
      locationId: input.locationId,
      result: input.result,
      itemResults: input.itemResults,
      issueDescription: input.issueDescription,
      priority: input.priority,
      photoAttached: input.photoAttached,
      inspectedBy: input.inspectedBy,
      inspectedAt: new Date().toISOString(),
    }
    mockStore.push(record)

    const now = new Date()
    const date = now.toISOString().slice(0, 10)
    const time = now.toTimeString().slice(0, 5)

    if (input.result === 'Failed' && input.issueDescription && input.priority) {
      await addPunchListItem({
        locationId: input.locationId,
        issueDescription: input.issueDescription,
        category: 'QC Failure',
        priority: input.priority,
      })
      await updateLocationStatus(input.locationId, 'Punch List')
      await addTimelineEvent({
        locationId: input.locationId,
        date,
        time,
        user: input.inspectedBy,
        action: 'QC Failed',
        remarks: input.issueDescription,
      })
      await addTimelineEvent({
        locationId: input.locationId,
        date,
        time,
        user: input.inspectedBy,
        action: 'Punch List Created',
        remarks: input.issueDescription,
      })
    } else if (input.result === 'Passed') {
      await updateLocationStatus(input.locationId, 'Completed')
      await addTimelineEvent({
        locationId: input.locationId,
        date,
        time,
        user: input.inspectedBy,
        action: 'QC Passed',
        remarks: '',
      })
      await addTimelineEvent({
        locationId: input.locationId,
        date,
        time,
        user: input.inspectedBy,
        action: 'Completed',
        remarks: '',
      })
    }

    return record
  }

  // Real mode: the whole cascade is one atomic RPC call, not five
  // sequential client-side writes.
  const { data, error } = await supabase!.rpc('submit_qc_inspection', {
    p_location_id: input.locationId,
    p_item_results: input.itemResults,
    p_result: input.result,
    p_issue_description: input.issueDescription ?? null,
    p_priority: input.priority ?? null,
    p_photo_attached: input.photoAttached ?? false,
    p_inspected_by: input.inspectedBy,
  })

  if (error) throw error
  return mapRow(data as GrQcInspectionRow)
}
