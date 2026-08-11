import { STATUS_LABELS, type DrawingStatus } from '@/types'

const DOT: Record<DrawingStatus, string> = {
  not_started: 'bg-status-notstarted',
  assigned: 'bg-status-assigned',
  drafting: 'bg-status-drafting',
  internal_review: 'bg-status-internalreview',
  submitted_to_daaa: 'bg-status-submitted',
  daaa_review: 'bg-status-daaareview',
  gpi_review: 'bg-status-gpireview',
  approved: 'bg-status-approved',
  revision_required: 'bg-status-revision',
  completed: 'bg-status-completed',
}

const TEXT: Record<DrawingStatus, string> = {
  not_started: 'text-slate-600 bg-slate-100',
  assigned: 'text-sky-700 bg-sky-100',
  drafting: 'text-indigo-700 bg-indigo-100',
  internal_review: 'text-amber-700 bg-amber-100',
  submitted_to_daaa: 'text-violet-700 bg-violet-100',
  daaa_review: 'text-purple-700 bg-purple-100',
  gpi_review: 'text-pink-700 bg-pink-100',
  approved: 'text-green-700 bg-green-100',
  revision_required: 'text-red-700 bg-red-100',
  completed: 'text-teal-800 bg-teal-100',
}

export function StatusBadge({ status, className = '' }: { status: DrawingStatus; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${TEXT[status]} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} />
      {STATUS_LABELS[status]}
    </span>
  )
}
