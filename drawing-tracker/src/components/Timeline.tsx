import { useState } from 'react'
import { MessageSquare, Loader2 } from 'lucide-react'
import type { ReviewHistoryEntry } from '@/types'

const ACTION_LABEL: Record<string, string> = {
  created: 'Drawing item created',
  assigned: 'Assigned to draftsman',
  started_drafting: 'Draftsman started drafting',
  uploaded_pdf: 'PDF uploaded',
  marked_complete: 'Draftsman marked complete',
  returned_to_draftsman: 'Returned to draftsman',
  submitted_to_daaa: 'Submitted to DAAA',
  daaa_started_review: 'DAAA started review',
  daaa_approved: 'DAAA approved — forwarded to GPI',
  daaa_revision_requested: 'DAAA requested revision',
  gpi_started_review: 'GPI started final review',
  gpi_approved: 'GPI approved — final approved drawing',
  gpi_revision_requested: 'GPI requested revision',
  gpi_rejected: 'GPI rejected submission',
  revision_reassigned: 'Revision reassigned to draftsman',
  marked_completed: 'Marked completed by XA',
  edited: 'Drawing details edited',
  deleted: 'Drawing item deleted',
  remark_added: 'Remark added',
}

const ACTION_COLOR: Record<string, string> = {
  daaa_approved: 'bg-green-500',
  gpi_approved: 'bg-green-600',
  daaa_revision_requested: 'bg-red-500',
  gpi_revision_requested: 'bg-red-500',
  gpi_rejected: 'bg-red-600',
  remark_added: 'bg-slate-400',
}

function fmt(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function Timeline({
  entries,
  onAddComment,
}: {
  entries: ReviewHistoryEntry[]
  onAddComment?: (text: string) => Promise<void>
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!text.trim() || !onAddComment) return
    setBusy(true)
    try {
      await onAddComment(text.trim())
      setText('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <ol className="space-y-4">
        {entries.length === 0 && <p className="text-sm text-brand-slate">No history yet.</p>}
        {entries
          .slice()
          .reverse()
          .map((e) => (
            <li key={e.id} className="flex gap-3">
              <div className="flex flex-col items-center pt-1">
                <span className={`h-2.5 w-2.5 rounded-full ${ACTION_COLOR[e.action] ?? 'bg-brand-teal'}`} />
                <span className="mt-1 w-px flex-1 bg-brand-line" />
              </div>
              <div className="flex-1 pb-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-sm font-semibold text-brand-ink">{ACTION_LABEL[e.action] ?? e.action}</p>
                  <p className="text-xs text-brand-slate">{fmt(e.date)}</p>
                </div>
                <p className="text-xs text-brand-slate">
                  {e.user_name ?? 'System'}
                  {e.role ? ` · ${e.role.toUpperCase()}` : ''}
                </p>
                {e.comments && (
                  <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-brand-ink">
                    {e.comments}
                  </p>
                )}
              </div>
            </li>
          ))}
      </ol>

      {onAddComment && (
        <div className="mt-4 flex items-start gap-2 border-t border-brand-line pt-4">
          <MessageSquare size={16} className="mt-2.5 shrink-0 text-brand-slate" />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a remark…"
            rows={2}
            className="flex-1 resize-none rounded-lg border border-brand-line px-3 py-2 text-sm outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
          />
          <button
            onClick={submit}
            disabled={busy || !text.trim()}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-brand-ink px-3 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Post
          </button>
        </div>
      )}
    </div>
  )
}
