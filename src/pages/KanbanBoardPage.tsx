import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { LocationStatus, RailingLocation } from '../types'
import { LOCATION_STATUSES } from '../types'
import { getLocations, updateLocationStatus } from '../services/locationService'
import { useAppData } from '../context/DataContext'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'

export default function KanbanBoardPage() {
  const navigate = useNavigate()
  const { selectedProjectCode } = useAppData()
  const [locations, setLocations] = useState<RailingLocation[]>([])
  const [activeColumn, setActiveColumn] = useState<LocationStatus>('Not Started')

  useEffect(() => {
    if (!selectedProjectCode) {
      navigate('/projects')
      return
    }
    getLocations({ projectCode: selectedProjectCode }).then(setLocations)
  }, [selectedProjectCode, navigate])

  const columns: LocationStatus[] = LOCATION_STATUSES.filter((s) => s !== 'On Hold') // production flow columns per spec
  const activeIndex = columns.indexOf(activeColumn)

  async function moveCard(location: RailingLocation, direction: -1 | 1) {
    const currentIndex = columns.indexOf(location.status as LocationStatus)
    const nextIndex = currentIndex + direction
    if (nextIndex < 0 || nextIndex >= columns.length) return
    const nextStatus = columns[nextIndex]
    await updateLocationStatus(location.id, nextStatus)
    setLocations((prev) => prev.map((l) => (l.id === location.id ? { ...l, status: nextStatus } : l)))
  }

  const cardsInColumn = locations.filter((l) => l.status === activeColumn)

  return (
    <div className="min-h-screen bg-[#F5F8FC]">
      <PageHeader title="Production Board" subtitle="Optional view · Kanban" />

      <div className="border-b border-xa-line bg-white px-4 py-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {columns.map((col) => (
            <button
              key={col}
              onClick={() => setActiveColumn(col)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${
                activeColumn === col ? 'border-xa-blue bg-xa-skyblue text-xa-blue' : 'border-xa-line text-xa-slate'
              }`}
            >
              {col} ({locations.filter((l) => l.status === col).length})
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        {cardsInColumn.length === 0 && <p className="py-10 text-center text-sm text-xa-slate">No cards in this column.</p>}
        {cardsInColumn.map((location) => (
          <div key={location.id} className="rounded-2xl border border-xa-line bg-white p-4 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-extrabold text-xa-navy">{location.id}</p>
                <p className="text-xs text-xa-slate">{location.floorLevel} &middot; {location.unitNo}</p>
              </div>
              <StatusBadge value={location.status} size="sm" />
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-xa-line pt-3">
              <button
                onClick={() => moveCard(location, -1)}
                disabled={activeIndex === 0}
                className="flex items-center gap-1 rounded-lg border border-xa-line px-2.5 py-1.5 text-xs font-bold text-xa-slate disabled:opacity-30"
              >
                <ChevronLeft size={14} /> Back
              </button>
              <button
                onClick={() => navigate(`/locations/${location.id}`)}
                className="text-xs font-bold text-xa-blue"
              >
                Open card
              </button>
              <button
                onClick={() => moveCard(location, 1)}
                disabled={activeIndex === columns.length - 1}
                className="flex items-center gap-1 rounded-lg border border-xa-line px-2.5 py-1.5 text-xs font-bold text-xa-slate disabled:opacity-30"
              >
                Advance <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
