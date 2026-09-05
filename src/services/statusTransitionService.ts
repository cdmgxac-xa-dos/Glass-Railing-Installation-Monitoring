import { getChecklist } from './checklistService'
import { getQCRecordsForLocation } from './qcService'
import { getPunchListForLocation } from './punchListService'

// Shared by every manual status-change surface (Update Status screen,
// Production Board). Completed is the one status that other screens
// (dashboards, reports, progress percentages) treat as ground truth, so a
// manual transition into it must clear the same bar the automatic QC-pass
// and punch-list-closure cascades already enforce — see assessment section
// 22/23. Returns a plain-English blocker per unmet condition; an empty
// array means the transition is allowed.
export async function getCompletionBlockers(locationId: string): Promise<string[]> {
  const [checklist, qcRecords, punchItems] = await Promise.all([
    getChecklist(locationId),
    getQCRecordsForLocation(locationId),
    getPunchListForLocation(locationId),
  ])

  const blockers: string[] = []

  if (!Object.values(checklist).every((entry) => entry.isCompleted)) {
    blockers.push('the installation checklist is not fully complete')
  }

  const sortedQcRecords = [...qcRecords].sort((a, b) => a.inspectedAt.localeCompare(b.inspectedAt))
  const latestQc = sortedQcRecords[sortedQcRecords.length - 1]
  if (latestQc?.result !== 'Passed') {
    blockers.push('QC inspection has not passed')
  }

  const openPunchCount = punchItems.filter((p) => p.status !== 'Closed').length
  if (openPunchCount > 0) {
    blockers.push(`${openPunchCount} punch item${openPunchCount === 1 ? '' : 's'} still open`)
  }

  return blockers
}
