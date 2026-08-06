import type { LocationStatus, PunchListStatus, Priority, QCResult } from '../types'

type BadgeValue = LocationStatus | PunchListStatus | Priority | QCResult

const STATUS_STYLES: Record<string, string> = {
  'Not Started': 'bg-slate-100 text-slate-600 border-slate-200',
  'In Progress': 'bg-blue-50 text-xa-blue border-blue-200',
  'QC Inspection': 'bg-amber-50 text-amber-700 border-amber-200',
  'Punch List': 'bg-red-50 text-red-700 border-red-200',
  'On Hold': 'bg-violet-50 text-violet-700 border-violet-200',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  // Punch list statuses
  Open: 'bg-red-50 text-red-700 border-red-200',
  Assigned: 'bg-amber-50 text-amber-700 border-amber-200',
  'In Rectification': 'bg-blue-50 text-xa-blue border-blue-200',
  'For Verification': 'bg-violet-50 text-violet-700 border-violet-200',
  Closed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  // Priority
  High: 'bg-red-50 text-red-700 border-red-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Low: 'bg-slate-100 text-slate-600 border-slate-200',
  // QC result
  Passed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Failed: 'bg-red-50 text-red-700 border-red-200',
}

const DOT_STYLES: Record<string, string> = {
  'Not Started': 'bg-slate-400',
  'In Progress': 'bg-xa-blue',
  'QC Inspection': 'bg-amber-500',
  'Punch List': 'bg-red-500',
  'On Hold': 'bg-violet-500',
  Completed: 'bg-emerald-500',
  Open: 'bg-red-500',
  Assigned: 'bg-amber-500',
  'In Rectification': 'bg-xa-blue',
  'For Verification': 'bg-violet-500',
  Closed: 'bg-emerald-500',
  High: 'bg-red-500',
  Medium: 'bg-amber-500',
  Low: 'bg-slate-400',
  Passed: 'bg-emerald-500',
  Failed: 'bg-red-500',
}

interface StatusBadgeProps {
  value: BadgeValue
  size?: 'sm' | 'md'
  withDot?: boolean
}

export default function StatusBadge({ value, size = 'md', withDot = true }: StatusBadgeProps) {
  const styles = STATUS_STYLES[value] ?? 'bg-slate-100 text-slate-600 border-slate-200'
  const dot = DOT_STYLES[value] ?? 'bg-slate-400'
  const sizeClasses = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap ${sizeClasses} ${styles}`}
    >
      {withDot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
      {value}
    </span>
  )
}
