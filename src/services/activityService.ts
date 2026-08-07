import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import type { ActivityEntry, PhotoCategory, RailingLocation } from '../types'
import { getLocationsByProject } from './locationService'
import { getQCRecordsForProject } from './qcService'
import { getPunchListForProject } from './punchListService'
import { getPhotosForLocation } from './photoService'

// ---------------------------------------------------------------------------
// Recent activity service — powers the Dashboard's activity feed.
//
// NO DEDICATED EVENTS TABLE. gr_activity_logs exists in schema.sql but
// nothing writes to it (timelineService.ts is still mock-only, in-memory),
// so it would be an empty feed. Instead this service does a query-time
// aggregation across the timestamp columns the app already maintains:
//
//   gr_locations.updated_at      -> status changes
//   gr_qc_inspections.inspected_at -> QC inspections
//   gr_punch_items.created_at    -> punch items raised
//   gr_photos.uploaded_at        -> photo uploads
//   gr_location_pins.updated_at  -> pin placed / moved
//   gr_floor_plans.updated_at    -> floor plan uploaded / replaced
//
// All column names verified against supabase/schema.sql. gr_floor_plans and
// gr_location_pins keep updated_at fresh via the set_updated_at() trigger
// (schema.sql:416-419, 436-439); gr_locations.updated_at is set explicitly
// by locationService.updateLocationStatus(). gr_punch_items has an
// updated_at column but NO trigger on it and the update_punch_list_status()
// RPC's handling of it isn't visible from this repo, so punch activity is
// keyed off created_at only — an entry appears when the item is raised, not
// on every status change. Don't switch it to updated_at without confirming
// the RPC maintains it.
//
// WINDOW vs LIMIT: both. A fixed 7-day window is applied server-side (a
// cheap .gte() on each already-indexed timestamp column), then the merged
// result is capped at `limit`. The window was chosen over a pure limit
// because every source has to be queried and merged anyway — without it,
// each source would need its own "top N" and the merge could still discard
// most of what it fetched. It also makes the empty state genuinely
// reachable on a quiet project.
//
// PROJECT SCOPING: every source is constrained to the project. gr_locations
// and gr_floor_plans filter on project_code directly; the four
// location-keyed tables filter with .in('location_id', <this project's
// location ids>). Nothing is fetched unscoped and filtered afterwards, so a
// second project's rows can never reach the feed.
//
// DUAL MODE, same as every other service here: real Supabase queries when
// configured, the existing project-scoped mock helpers otherwise.
// ---------------------------------------------------------------------------

const ACTIVITY_WINDOW_DAYS = 7

function windowStartIso(): string {
  return new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

// Every timestamp comparison in this file goes through epoch millis, never
// string ordering. Sources don't agree on ISO spelling — JS toISOString()
// produces '…T08:00:00.000Z' while Postgres timestamptz comes back as
// '…T08:00:00.123456+00:00' — so lexicographic compare would mis-order
// entries from different tables that land in the same second.
function ms(iso: string): number {
  return new Date(iso).getTime()
}

// Location display fields (Tag ID + unit no) are attached to each entry from
// the already-fetched location list rather than joined per source query.
type LocationLookup = Map<string, RailingLocation>

function locationFields(lookup: LocationLookup, locationId: string) {
  const loc = lookup.get(locationId)
  return { locationTagId: loc?.id ?? locationId, locationUnitNo: loc?.unitNo }
}

// --- gr_locations: status changes -------------------------------------------

// gr_locations has no status history — only the current status and the row's
// updated_at. So this reports "changed to <current status>" as of the last
// write. A non-status edit (e.g. remarks) also bumps updated_at and would
// surface here with the unchanged status; acceptable for a feed, and the
// only writer today is updateLocationStatus().
function statusChangeEntries(locations: RailingLocation[], since: string): ActivityEntry[] {
  const sinceMs = ms(since)
  return locations
    .filter((l) => ms(l.updatedAt) >= sinceMs)
    .map((l) => ({
      id: `gr_locations-${l.id}-${l.updatedAt}`,
      type: 'status_change' as const,
      description: `Status changed to ${l.status}`,
      locationTagId: l.id,
      locationUnitNo: l.unitNo,
      timestamp: l.updatedAt,
    }))
}

// --- gr_qc_inspections ------------------------------------------------------

interface QcActivityRow {
  id: string
  location_id: string
  result: 'Passed' | 'Failed' | null
  inspected_at: string
}

function qcDescription(result: 'Passed' | 'Failed' | null): string {
  if (result === 'Passed') return 'QC inspection passed'
  if (result === 'Failed') return 'QC inspection failed'
  return 'QC inspection recorded'
}

async function qcEntries(
  projectCode: string,
  locationIds: string[],
  lookup: LocationLookup,
  since: string,
): Promise<ActivityEntry[]> {
  let rows: QcActivityRow[]

  if (!isSupabaseConfigured) {
    rows = (await getQCRecordsForProject(projectCode)).map((r) => ({
      id: r.id,
      location_id: r.locationId,
      result: r.result,
      inspected_at: r.inspectedAt,
    }))
  } else {
    const { data, error } = await supabase!
      .from('gr_qc_inspections')
      .select('id, location_id, result, inspected_at')
      .in('location_id', locationIds)
      .gte('inspected_at', since)
      .order('inspected_at', { ascending: false })

    if (error) throw error
    rows = data as QcActivityRow[]
  }

  // Mock mode has no server-side .gte(), so the window is applied here for
  // both modes — cheap, and keeps the two paths returning the same set.
  return rows
    .filter((r) => ms(r.inspected_at) >= ms(since))
    .map((r) => ({
      id: `gr_qc_inspections-${r.id}-${r.inspected_at}`,
      type: 'qc_inspection' as const,
      description: qcDescription(r.result),
      ...locationFields(lookup, r.location_id),
      timestamp: r.inspected_at,
    }))
}

// --- gr_punch_items ---------------------------------------------------------

interface PunchActivityRow {
  id: string
  location_id: string
  category: string
  created_at: string
}

async function punchListEntries(
  projectCode: string,
  locationIds: string[],
  lookup: LocationLookup,
  since: string,
): Promise<ActivityEntry[]> {
  let rows: PunchActivityRow[]

  if (!isSupabaseConfigured) {
    // PunchListItem (the mock shape) exposes only dateFound, a date with no
    // time component — so mock mode shows midnight-local for punch entries.
    // Real mode reads the real created_at timestamptz below.
    rows = (await getPunchListForProject(projectCode)).map((p) => ({
      id: p.id,
      location_id: p.locationId,
      category: p.category,
      created_at: new Date(`${p.dateFound}T00:00:00`).toISOString(),
    }))
  } else {
    const { data, error } = await supabase!
      .from('gr_punch_items')
      .select('id, location_id, category, created_at')
      .in('location_id', locationIds)
      .gte('created_at', since)
      .order('created_at', { ascending: false })

    if (error) throw error
    rows = data as PunchActivityRow[]
  }

  return rows
    .filter((r) => ms(r.created_at) >= ms(since))
    .map((r) => ({
      id: `gr_punch_items-${r.id}-${r.created_at}`,
      type: 'punch_list' as const,
      description: `Punch list item raised — ${r.category}`,
      ...locationFields(lookup, r.location_id),
      timestamp: r.created_at,
    }))
}

// --- gr_photos --------------------------------------------------------------

interface PhotoActivityRow {
  id: string
  location_id: string
  category: PhotoCategory
  uploaded_at: string
}

async function photoEntries(
  locations: RailingLocation[],
  locationIds: string[],
  lookup: LocationLookup,
  since: string,
): Promise<ActivityEntry[]> {
  let rows: PhotoActivityRow[]

  if (!isSupabaseConfigured) {
    // Mock mode only: getPhotosForLocation() is an in-memory array filter, so
    // looping it is free. Never do this in real mode — it'd be one round-trip
    // per location, each minting a signed Storage URL the feed doesn't need.
    const collected: PhotoActivityRow[] = []
    for (const loc of locations) {
      for (const p of await getPhotosForLocation(loc.id)) {
        collected.push({ id: p.id, location_id: p.locationId, category: p.category, uploaded_at: p.uploadedAt })
      }
    }
    rows = collected
  } else {
    const { data, error } = await supabase!
      .from('gr_photos')
      .select('id, location_id, category, uploaded_at')
      .in('location_id', locationIds)
      .gte('uploaded_at', since)
      .order('uploaded_at', { ascending: false })

    if (error) throw error
    rows = data as PhotoActivityRow[]
  }

  return rows
    .filter((r) => ms(r.uploaded_at) >= ms(since))
    .map((r) => ({
      id: `gr_photos-${r.id}-${r.uploaded_at}`,
      type: 'photo_upload' as const,
      description: `${r.category} photo uploaded`,
      ...locationFields(lookup, r.location_id),
      timestamp: r.uploaded_at,
    }))
}

// --- gr_location_pins / gr_floor_plans --------------------------------------
//
// Real mode only. Both mock stores in floorPlanService.ts are module-private
// and start empty on every reload, so there is nothing to read in mock mode —
// returning [] is the honest answer rather than plumbing accessors through
// for data that can't exist.

interface PinActivityRow {
  id: string
  location_id: string
  created_at: string
  updated_at: string
}

async function pinEntries(
  locationIds: string[],
  lookup: LocationLookup,
  since: string,
): Promise<ActivityEntry[]> {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase!
    .from('gr_location_pins')
    .select('id, location_id, created_at, updated_at')
    .in('location_id', locationIds)
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })

  if (error) throw error

  return (data as PinActivityRow[]).map((r) => ({
    id: `gr_location_pins-${r.id}-${r.updated_at}`,
    type: 'pin_placed' as const,
    description: r.created_at === r.updated_at ? 'Pin placed on floor plan' : 'Pin moved on floor plan',
    ...locationFields(lookup, r.location_id),
    timestamp: r.updated_at,
  }))
}

interface FloorPlanActivityRow {
  id: string
  floor_level: string
  created_at: string
  updated_at: string
}

async function floorPlanEntries(projectCode: string, since: string): Promise<ActivityEntry[]> {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase!
    .from('gr_floor_plans')
    .select('id, floor_level, created_at, updated_at')
    .eq('project_code', projectCode)
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })

  if (error) throw error

  // Floor plans are per project+floor, not per location — these entries
  // deliberately carry no locationTagId/locationUnitNo.
  return (data as FloorPlanActivityRow[]).map((r) => ({
    id: `gr_floor_plans-${r.id}-${r.updated_at}`,
    type: 'floor_plan_uploaded' as const,
    description:
      r.created_at === r.updated_at
        ? `Floor plan uploaded — ${r.floor_level}`
        : `Floor plan replaced — ${r.floor_level}`,
    timestamp: r.updated_at,
  }))
}

// --- public API -------------------------------------------------------------

export const RECENT_ACTIVITY_WINDOW_DAYS = ACTIVITY_WINDOW_DAYS

export async function getRecentActivity(projectCode: string, limit = 30): Promise<ActivityEntry[]> {
  const since = windowStartIso()

  // One fetch of the project's locations serves three purposes: the status
  // -change source, the id list that scopes every location-keyed query, and
  // the Tag ID / unit number lookup for display.
  const locations = await getLocationsByProject(projectCode)
  if (locations.length === 0) return []

  const locationIds = locations.map((l) => l.id)
  const lookup: LocationLookup = new Map(locations.map((l) => [l.id, l]))

  const [qc, punch, photos, pins, floorPlans] = await Promise.all([
    qcEntries(projectCode, locationIds, lookup, since),
    punchListEntries(projectCode, locationIds, lookup, since),
    photoEntries(locations, locationIds, lookup, since),
    pinEntries(locationIds, lookup, since),
    floorPlanEntries(projectCode, since),
  ])

  return [...statusChangeEntries(locations, since), ...qc, ...punch, ...photos, ...pins, ...floorPlans]
    .sort((a, b) => ms(b.timestamp) - ms(a.timestamp))
    .slice(0, limit)
}
