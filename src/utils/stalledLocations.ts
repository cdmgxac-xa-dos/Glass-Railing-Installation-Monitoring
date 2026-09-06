import type { LocationStatus, RailingLocation } from '../types'

// Shared by the Home screen's "Stalled > 2 Days" Attention Required tile
// and the location list's ?stalled=1 filter — both need to agree on
// exactly what counts as stalled, or the tile and the list it links to
// would silently disagree.
export const STALLED_ACTIVE_STATUSES: LocationStatus[] = ['In Progress', 'QC Inspection', 'Punch List']
export const STALLED_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000

export function isStalled(location: Pick<RailingLocation, 'status' | 'updatedAt'>): boolean {
  return (
    STALLED_ACTIVE_STATUSES.includes(location.status) &&
    Date.now() - new Date(location.updatedAt).getTime() > STALLED_THRESHOLD_MS
  )
}
