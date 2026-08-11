import { useEffect, useMemo, useState } from 'react'
import { FileText, Loader2, Search, ExternalLink } from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import { StatCard } from '@/components/StatCard'
import {
  fetchClientApprovedPdfs,
  fetchClientDrawings,
  fetchClientTimeline,
  getPublicSignedUrl,
  type ClientDrawingRow,
  type ClientPdfRow,
  type ClientTimelineRow,
} from '@/services/clientDashboardService'
import type { DrawingStatus } from '@/types'
import { DRAWING_STATUSES, STATUS_LABELS } from '@/types'

export function ClientDashboardPage() {
  const [drawings, setDrawings] = useState<ClientDrawingRow[]>([])
  const [pdfs, setPdfs] = useState<ClientPdfRow[]>([])
  const [timeline, setTimeline] = useState<ClientTimelineRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<DrawingStatus | 'all'>('all')

  useEffect(() => {
    Promise.all([fetchClientDrawings(), fetchClientApprovedPdfs(), fetchClientTimeline()])
      .then(([d, p, t]) => {
        setDrawings(d)
        setPdfs(p)
        setTimeline(t)
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return drawings.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false
      if (!query.trim()) return true
      const q = query.toLowerCase()
      return (
        d.item_no.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        (d.category ?? '').toLowerCase().includes(q)
      )
    })
  }, [drawings, query, statusFilter])

  const pdfByItem = useMemo(() => new Map(pdfs.map((p) => [p.drawing_item_id, p])), [pdfs])

  const total = drawings.length
  const approvedOrCompleted = drawings.filter((d) => ['approved', 'completed'].includes(d.status)).length
  const revisionRequired = drawings.filter((d) => d.status === 'revision_required').length
  const today = new Date().toISOString().slice(0, 10)
  const overdue = drawings.filter(
    (d) => d.target_submission_date && d.target_submission_date < today && !['approved', 'completed'].includes(d.status)
  ).length
  const progressPct = total > 0 ? Math.round((approvedOrCompleted / total) * 100) : 0

  async function openPdf(path: string) {
    const url = await getPublicSignedUrl(path)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-brand-slate" />
      </div>
    )
  }

  const groups: { category: string; rows: ClientDrawingRow[] }[] = []
  for (const item of filtered) {
    const cat = item.category || 'Uncategorized'
    let g = groups.find((x) => x.category === cat)
    if (!g) {
      g = { category: cat, rows: [] }
      groups.push(g)
    }
    g.rows.push(item)
  }

  return (
    <div className="min-h-screen bg-[#F4F8F8]">
      <header className="border-b border-brand-line bg-brand-ink text-white">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
              <FileText size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold">Shop Drawing Transparency Dashboard</h1>
              <p className="text-sm text-white/70">The Spinnaker at Club Laiya — CP19 Contract Package</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Drawings" value={total} />
          <StatCard label="Overall Progress" value={`${progressPct}%`} tone="good" />
          <StatCard label="Revision Required" value={revisionRequired} tone={revisionRequired ? 'warn' : 'default'} />
          <StatCard label="Overdue" value={overdue} tone={overdue ? 'bad' : 'default'} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-brand-line bg-white px-3 py-2">
            <Search size={15} className="text-brand-slate" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search item no, description, category…"
              className="flex-1 text-sm outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as DrawingStatus | 'all')}
            className="rounded-lg border border-brand-line bg-white px-3 py-2 text-sm"
          >
            <option value="all">All statuses</option>
            {DRAWING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.category}>
              <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-brand-teal">
                {group.category}
              </h3>
              <div className="overflow-hidden rounded-xl border border-brand-line bg-white shadow-card">
                {group.rows.map((d, idx) => {
                  const pdf = pdfByItem.get(d.id)
                  return (
                    <div
                      key={d.id}
                      className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
                        idx !== group.rows.length - 1 ? 'border-b border-brand-line' : ''
                      }`}
                    >
                      <span className="w-14 shrink-0 font-mono text-xs font-semibold text-brand-slate">
                        {d.item_no}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-brand-ink">{d.description}</p>
                        <p className="truncate text-xs text-brand-slate">
                          {d.target_submission_date ? `Target: ${d.target_submission_date}` : ''}
                          {d.submission_date ? ` · Submitted: ${d.submission_date}` : ''}
                          {d.approval_date ? ` · Approved: ${d.approval_date}` : ''}
                        </p>
                      </div>
                      <StatusBadge status={d.status} className="shrink-0" />
                      {pdf && (
                        <button
                          onClick={() => openPdf(pdf.storage_path)}
                          className="flex shrink-0 items-center gap-1 rounded-lg border border-brand-teal px-2.5 py-1 text-xs font-semibold text-brand-teal hover:bg-brand-tint"
                        >
                          <ExternalLink size={12} /> Approved PDF
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-brand-line bg-white p-4 shadow-card">
          <h2 className="mb-3 text-sm font-bold text-brand-ink">Recent Timeline</h2>
          <ul className="space-y-2">
            {timeline.slice(0, 30).map((t, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 border-b border-brand-line pb-2 text-sm last:border-0">
                <span className="text-brand-ink">
                  {ACTION_LABEL[t.action] ?? t.action}
                  {t.comments && <span className="text-brand-slate"> — {t.comments}</span>}
                </span>
                <span className="shrink-0 text-xs text-brand-slate">
                  {new Date(t.date).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  )
}

const ACTION_LABEL: Record<string, string> = {
  created: 'Drawing item added to register',
  assigned: 'Assigned to draftsman',
  started_drafting: 'Drafting started',
  uploaded_pdf: 'Drawing PDF uploaded',
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
  marked_completed: 'Marked completed',
  edited: 'Drawing details updated',
}
