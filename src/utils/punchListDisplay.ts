import type { PunchListItem } from '../types'

// Real-mode punch items key off gr_punch_items.id, a raw Supabase UUID —
// fine as a stable key for updates, but not something a PIC or QC inspector
// should ever see on screen. Builds a human-readable "<location>-P##" label
// per item (e.g. "GR-026-P02"), numbered per-location in the order items
// were returned (services order by date_found), with no schema change
// required. Mock-mode items already carry readable "PL-###" ids, but this
// keeps display consistent across both modes.
export function buildPunchDisplayIds(
  items: PunchListItem[],
  referenceForLocation: (locationId: string) => string,
): Record<string, string> {
  const counters: Record<string, number> = {}
  const displayIds: Record<string, string> = {}

  for (const item of items) {
    const ordinal = (counters[item.locationId] ?? 0) + 1
    counters[item.locationId] = ordinal
    displayIds[item.id] = `${referenceForLocation(item.locationId)}-P${ordinal.toString().padStart(2, '0')}`
  }

  return displayIds
}
