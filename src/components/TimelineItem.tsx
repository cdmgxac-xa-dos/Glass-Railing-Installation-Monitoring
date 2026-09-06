import { Hammer, Search, CircleAlert, CircleCheck, ArrowRightLeft, Activity, type LucideIcon } from 'lucide-react'
import type { TimelineEvent } from '../types'

interface TimelineItemProps {
  event: TimelineEvent
  isLast?: boolean
}

const ACTION_DOT: Record<string, string> = {
  'QC Failed': 'bg-red-500',
  'Punch List Created': 'bg-red-500',
  'Punch Item Reopened': 'bg-red-500',
  'QC Passed': 'bg-emerald-500',
  Completed: 'bg-emerald-500',
  'All Punch Items Closed': 'bg-emerald-500',
  Rectified: 'bg-amber-500',
}

// Small per-event-type icons (assessment section 32) — kept restrained to
// a handful of categories rather than one icon per exact action string:
// install steps, QC, punch, completion, and a generic status change.
const ACTION_ICON: Record<string, LucideIcon> = {
  'Area Released': Hammer,
  'Bracket Installed': Hammer,
  'Glass Installed': Hammer,
  'QC Inspection Requested': Search,
  'QC Failed': Search,
  'QC Passed': Search,
  'Punch List Created': CircleAlert,
  'Punch Item Reopened': CircleAlert,
  'All Punch Items Closed': CircleAlert,
  Rectified: CircleAlert,
  Completed: CircleCheck,
}

function iconFor(action: string): LucideIcon {
  if (ACTION_ICON[action]) return ACTION_ICON[action]
  if (action.startsWith('Status changed to')) return ArrowRightLeft
  return Activity
}

export default function TimelineItem({ event, isLast }: TimelineItemProps) {
  const dotColor = ACTION_DOT[event.action] ?? 'bg-xa-blue'
  const Icon = iconFor(event.action)
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${dotColor}`}>
          <Icon size={12} strokeWidth={2.5} />
        </span>
        {!isLast && <span className="w-px flex-1 bg-xa-line" />}
      </div>
      <div className="min-w-0 flex-1 pb-5">
        <p className="text-sm font-bold text-slate-800">{event.action}</p>
        <p className="mt-0.5 text-xs text-xa-slate">
          {event.date} &middot; {event.time} &middot; {event.user}
        </p>
        {event.remarks && <p className="mt-1 text-xs text-slate-600">{event.remarks}</p>}
      </div>
    </div>
  )
}
