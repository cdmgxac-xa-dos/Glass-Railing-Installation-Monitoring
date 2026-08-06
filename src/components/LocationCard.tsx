import { ChevronRight, Ruler, Layers, Users, Wrench } from 'lucide-react'
import type { RailingLocation } from '../types'
import StatusBadge from './StatusBadge'

interface LocationCardProps {
  location: RailingLocation
  onClick?: () => void
}

export default function LocationCard({ location, onClick }: LocationCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl border border-xa-line bg-white p-4 text-left shadow-card transition active:scale-[0.99] active:shadow-none"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-xa-navy">{location.id}</span>
            {location.priority === 'High' && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-600">
                High priority
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{location.unitNo}</p>
          <p className="truncate text-xs text-xa-slate">{location.floorLevel} &middot; {location.unitType}</p>
        </div>
        <ChevronRight size={20} className="mt-1 shrink-0 text-slate-300" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-xa-slate">
        <div className="flex items-center gap-1.5">
          <Ruler size={14} className="text-xa-blue" />
          {location.totalLinearMeters.toFixed(1)} LM
        </div>
        <div className="flex items-center gap-1.5">
          <Layers size={14} className="text-xa-blue" />
          {location.totalGlassPanels} panels
        </div>
        <div className="flex items-center gap-1.5">
          <Wrench size={14} className="text-xa-blue" />
          {location.bracketSystem.replace('Bracket System ', 'System ')}
        </div>
        <div className="flex items-center gap-1.5">
          <Users size={14} className="text-xa-blue" />
          {location.assignedTeam}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-xa-line pt-3">
        <StatusBadge value={location.status} size="sm" />
        <span className="text-[11px] font-medium text-slate-400">{location.priority} priority</span>
      </div>
    </button>
  )
}
