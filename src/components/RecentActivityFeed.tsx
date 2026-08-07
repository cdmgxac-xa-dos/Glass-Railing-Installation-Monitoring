import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Camera,
  ClipboardCheck,
  Map,
  MapPin,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react'
import type { ActivityEntry, ActivityType } from '../types'
import { getRecentActivity, RECENT_ACTIVITY_WINDOW_DAYS } from '../services/activityService'
import { formatExactTimestamp, formatRelativeTime } from '../utils/relativeTime'

// ---------------------------------------------------------------------------
// Dashboard activity feed.
//
// Self-fetching rather than fed by the page: a failure here must not take
// down the Overall Progress block above it, so it owns its own
// loading/error/empty states instead of sharing the page's.
//
// Each row shows BOTH a relative time ('12 minutes ago') and the exact
// timestamp. The exact value is rendered as visible secondary text, not only
// a title tooltip — the primary client is a phone in the field, where there
// is no hover.
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<ActivityType, LucideIcon> = {
  status_change: RefreshCw,
  qc_inspection: ClipboardCheck,
  punch_list: AlertTriangle,
  photo_upload: Camera,
  pin_placed: MapPin,
  floor_plan_uploaded: Map,
}

const TYPE_ACCENTS: Record<ActivityType, string> = {
  status_change: 'text-xa-blue bg-blue-50',
  qc_inspection: 'text-amber-700 bg-amber-50',
  punch_list: 'text-red-700 bg-red-50',
  photo_upload: 'text-emerald-700 bg-emerald-50',
  pin_placed: 'text-violet-700 bg-violet-50',
  floor_plan_uploaded: 'text-slate-600 bg-slate-100',
}

// unit_no is free text and inconsistent between datasets — real gr_locations
// rows are bare numbers ('601'), mock rows and some real ones already carry a
// label ('Unit 1201', 'Lobby Bay 1', 'Roof Deck Bay 12'). Prefix 'Unit' only
// when the value is a bare number, so nothing ever reads 'Unit Unit 1201'.
function unitLabel(unitNo: string): string {
  return /^\d/.test(unitNo) ? `Unit ${unitNo}` : unitNo
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const Icon = TYPE_ICONS[entry.type]
  const exact = formatExactTimestamp(entry.timestamp)

  return (
    <li className="flex gap-3 px-4 py-3">
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TYPE_ACCENTS[entry.type]}`}
      >
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-xa-navy">{entry.description}</p>
        {entry.locationTagId && (
          <p className="truncate text-xs text-xa-slate">
            {entry.locationTagId}
            {entry.locationUnitNo && ` · ${unitLabel(entry.locationUnitNo)}`}
          </p>
        )}
        <p className="mt-0.5 text-[11px] text-slate-400" title={exact}>
          {formatRelativeTime(entry.timestamp)} · {exact}
        </p>
      </div>
    </li>
  )
}

export default function RecentActivityFeed({ projectCode }: { projectCode: string }) {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setEntries(null)
    setError(null)

    getRecentActivity(projectCode)
      .then((result) => {
        if (!cancelled) setEntries(result)
      })
      .catch((err: unknown) => {
        console.error('Failed to load recent activity:', err)
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load recent activity.')
      })

    return () => {
      cancelled = true
    }
  }, [projectCode])

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-xa-slate">Recent activity</p>
        <p className="text-[11px] text-slate-400">Last {RECENT_ACTIVITY_WINDOW_DAYS} days</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-xa-line bg-white shadow-card">
        {error ? (
          <p className="px-4 py-6 text-center text-sm text-xa-slate">{error}</p>
        ) : !entries ? (
          <p className="px-4 py-6 text-center text-sm text-xa-slate">Loading activity…</p>
        ) : entries.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-xa-slate">No recent activity</p>
        ) : (
          <ul className="divide-y divide-xa-line">
            {entries.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
