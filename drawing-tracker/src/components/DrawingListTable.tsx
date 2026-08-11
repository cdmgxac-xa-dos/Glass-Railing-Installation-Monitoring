import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import type { DrawingItem } from '@/types'

export function DrawingListTable({ items }: { items: DrawingItem[] }) {
  const navigate = useNavigate()
  const today = new Date().toISOString().slice(0, 10)

  if (items.length === 0) {
    return <p className="rounded-xl bg-white p-6 text-center text-sm text-brand-slate shadow-card">No drawings.</p>
  }

  const groups: { category: string; rows: DrawingItem[] }[] = []
  for (const item of items) {
    const cat = item.category || 'Uncategorized'
    let group = groups.find((g) => g.category === cat)
    if (!group) {
      group = { category: cat, rows: [] }
      groups.push(group)
    }
    group.rows.push(item)
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.category}>
          <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-brand-teal">
            {group.category}
          </h3>
          <div className="overflow-hidden rounded-xl border border-brand-line bg-white shadow-card">
            {group.rows.map((item, idx) => {
              const overdue =
                item.target_submission_date &&
                item.target_submission_date < today &&
                !['approved', 'completed'].includes(item.status)
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(`/drawings/${item.id}`)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 ${
                    idx !== group.rows.length - 1 ? 'border-b border-brand-line' : ''
                  }`}
                >
                  <span className="w-14 shrink-0 font-mono text-xs font-semibold text-brand-slate">
                    {item.item_no}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-brand-ink">{item.description}</p>
                    <p className="truncate text-xs text-brand-slate">
                      {item.assigned_draftsman_name ? `Draftsman: ${item.assigned_draftsman_name}` : 'Unassigned'}
                      {item.target_submission_date ? ` · Target: ${item.target_submission_date}` : ''}
                      {overdue ? ' · OVERDUE' : ''}
                    </p>
                  </div>
                  <StatusBadge status={item.status} className="shrink-0" />
                  <ChevronRight size={16} className="shrink-0 text-brand-slate" />
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
