interface FloorButtonProps {
  floorLevel: string
  locationCount: number
  onClick?: () => void
}

export default function FloorButton({ floorLevel, locationCount, onClick }: FloorButtonProps) {
  const hasLocations = locationCount > 0
  return (
    <button
      onClick={onClick}
      disabled={!hasLocations}
      className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-4 text-center shadow-card transition active:scale-[0.97] ${
        hasLocations
          ? 'border-xa-line bg-white active:bg-xa-skyblue'
          : 'border-dashed border-slate-200 bg-slate-50 opacity-50'
      }`}
    >
      <span className="text-lg font-extrabold text-xa-navy">{floorLevel}</span>
      <span className="text-[11px] font-medium text-xa-slate">
        {hasLocations ? `${locationCount} location${locationCount === 1 ? '' : 's'}` : 'No records'}
      </span>
    </button>
  )
}
