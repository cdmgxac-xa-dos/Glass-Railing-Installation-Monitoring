import type { TimelineEvent } from '../types'

interface TimelineItemProps {
  event: TimelineEvent
  isLast?: boolean
}

const ACTION_DOT: Record<string, string> = {
  'QC Failed': 'bg-red-500',
  'Punch List Created': 'bg-red-500',
  'QC Passed': 'bg-emerald-500',
  Completed: 'bg-emerald-500',
  Rectified: 'bg-amber-500',
}

export default function TimelineItem({ event, isLast }: TimelineItemProps) {
  const dotColor = ACTION_DOT[event.action] ?? 'bg-xa-blue'
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${dotColor}`} />
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
