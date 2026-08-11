import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, AlertTriangle } from 'lucide-react'
import { StatCard } from '@/components/StatCard'
import { StatusBadge } from '@/components/StatusBadge'
import { computeStats, listDrawingItems } from '@/services/drawingService'
import type { DrawingItem } from '@/types'
import { DRAWING_STATUSES } from '@/types'

export function XADashboardPage() {
  const [items, setItems] = useState<DrawingItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listDrawingItems()
      .then(setItems)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-brand-slate" />
      </div>
    )
  }

  const stats = computeStats(items)
  const today = new Date().toISOString().slice(0, 10)
  const overdueItems = items
    .filter((i) => i.target_submission_date && i.target_submission_date < today && !['approved', 'completed'].includes(i.status))
    .slice(0, 8)

  const progressPct = stats.total > 0 ? Math.round(((stats.approved + stats.completed) / stats.total) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-brand-ink">XA Dashboard</h1>
        <p className="text-sm text-brand-slate">CP19 — Panel Boards, Breakers, Meter Center & Switch Gear</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Drawings" value={stats.total} />
        <StatCard label="Approved / Completed" value={`${stats.approved + stats.completed} (${progressPct}%)`} tone="good" />
        <StatCard label="Revision Required" value={stats.revisionRequired} tone={stats.revisionRequired ? 'warn' : 'default'} />
        <StatCard label="Overdue" value={stats.overdue} tone={stats.overdue ? 'bad' : 'default'} />
      </div>

      <div className="rounded-xl border border-brand-line bg-white p-4 shadow-card">
        <h2 className="mb-3 text-sm font-bold text-brand-ink">Status Breakdown</h2>
        <div className="flex flex-wrap gap-2">
          {DRAWING_STATUSES.map((s) => (
            <div key={s} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
              <StatusBadge status={s} />
              <span className="text-sm font-semibold text-brand-ink">{stats.byStatus[s]}</span>
            </div>
          ))}
        </div>
      </div>

      {overdueItems.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-red-700">
            <AlertTriangle size={15} /> Overdue Drawings
          </h2>
          <div className="space-y-1.5">
            {overdueItems.map((item) => (
              <Link
                key={item.id}
                to={`/drawings/${item.id}`}
                className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm hover:bg-red-100/50"
              >
                <span>
                  <span className="font-mono text-xs text-brand-slate">{item.item_no}</span>{' '}
                  <span className="font-medium text-brand-ink">{item.description}</span>
                </span>
                <span className="text-xs text-red-600">Target was {item.target_submission_date}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Link to="/register" className="text-sm font-semibold text-brand-teal hover:underline">
          View full drawing register →
        </Link>
      </div>
    </div>
  )
}
