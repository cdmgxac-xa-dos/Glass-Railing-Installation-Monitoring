import { CalendarClock } from 'lucide-react'
import type { PunchListItem } from '../types'
import StatusBadge from './StatusBadge'

interface PunchListCardProps {
  item: PunchListItem
  // Human-readable punch ID for display (e.g. "GR-026-P02"). Falls back to
  // item.id only if no display ID was computed — never show the raw
  // database UUID that real-mode punch items carry as their id.
  displayId?: string
  locationLabel?: string
  onClick?: () => void
}

export default function PunchListCard({ item, displayId, locationLabel, onClick }: PunchListCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl border border-xa-line bg-white p-4 text-left shadow-card active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-xa-slate">
            {displayId ?? item.id} {locationLabel ? `· ${locationLabel}` : ''}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{item.issueDescription}</p>
        </div>
        <StatusBadge value={item.priority} size="sm" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge value={item.status} size="sm" />
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
          {item.category}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
          {item.assignedTeam}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-xa-slate">
        <CalendarClock size={13} />
        Found {item.dateFound} &middot; Target {item.targetCompletionDate}
      </div>
    </button>
  )
}
