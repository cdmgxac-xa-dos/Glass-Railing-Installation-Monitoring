import { ChevronRight } from 'lucide-react'
import type { UnitType } from '../types'

interface UnitTypeRowProps {
  unitType: UnitType
  locationCount: number
  onClick?: () => void
}

export default function UnitTypeRow({ unitType, locationCount, onClick }: UnitTypeRowProps) {
  const disabled = locationCount === 0
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-between rounded-2xl border bg-white p-4 shadow-card transition active:scale-[0.99] ${
        disabled ? 'opacity-40' : 'border-xa-line active:bg-xa-skyblue'
      }`}
    >
      <div className="text-left">
        <p className="text-sm font-bold text-xa-navy">{unitType}</p>
        <p className="text-xs text-xa-slate">
          {locationCount} location{locationCount === 1 ? '' : 's'}
        </p>
      </div>
      <ChevronRight size={20} className="text-slate-300" />
    </button>
  )
}
