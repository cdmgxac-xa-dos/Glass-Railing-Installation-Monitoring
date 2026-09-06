import type { StatusCounts } from '../types'

interface FloorProgressRowProps {
  floorLevel: string
  statusCounts: StatusCounts
  locationCount: number
}

// Compact replacement for the old per-floor donut chart (assessment section
// 12) — a large donut per floor ate too much vertical space on a tall
// building with many floors. One thin progress bar per floor lets a whole
// building be scanned in one screen; per-status breakdown stays available
// on the Work Card / location list, it just isn't repeated here per floor.
export default function FloorProgressRow({ floorLevel, statusCounts, locationCount }: FloorProgressRowProps) {
  const completed = statusCounts.Completed
  const pct = locationCount ? Math.round((completed / locationCount) * 100) : 0

  return (
    <div className="flex items-center gap-3 rounded-xl border border-xa-line bg-white px-3 py-2.5 shadow-card">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-xs">
          <p className="truncate font-bold text-xa-navy">{floorLevel}</p>
          <p className="shrink-0 font-semibold text-xa-slate">
            {completed} / {locationCount} completed
          </p>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-xa-blue transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <p className="w-10 shrink-0 text-right text-xs font-extrabold text-xa-navy">{pct}%</p>
    </div>
  )
}
