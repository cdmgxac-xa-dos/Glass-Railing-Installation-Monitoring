import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { AssignedTeam, LocationStatus, RailingLocation } from '../types'
import { ASSIGNED_TEAMS, LOCATION_STATUSES } from '../types'
import { getLocations, updateLocationStatus } from '../services/locationService'
import { getCompletionBlockers } from '../services/statusTransitionService'
import { useAppData } from '../context/DataContext'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'

// Cards actually rendered per column at once — a large project can have
// hundreds of locations sitting in a single status; rendering all of them
// unconditionally would make the board sluggish to scroll on a phone.
// "Show more" grows this in place rather than paging, so the column counts
// in the chip row above always describe the true total, not just what's
// on screen.
const CARDS_PER_PAGE = 30

export default function KanbanBoardPage() {
  const navigate = useNavigate()
  const { selectedProjectCode } = useAppData()
  const [locations, setLocations] = useState<RailingLocation[]>([])
  const [activeColumn, setActiveColumn] = useState<LocationStatus>('Not Started')
  const [blockedCardId, setBlockedCardId] = useState<string | null>(null)
  const [blockedReason, setBlockedReason] = useState('')
  const [floorFilter, setFloorFilter] = useState<string | 'All'>('All')
  const [teamFilter, setTeamFilter] = useState<AssignedTeam | 'All'>('All')
  const [visibleCount, setVisibleCount] = useState(CARDS_PER_PAGE)

  useEffect(() => {
    if (!selectedProjectCode) {
      navigate('/projects')
      return
    }
    getLocations({ projectCode: selectedProjectCode }).then(setLocations)
  }, [selectedProjectCode, navigate])

  const floorsInUse = useMemo(
    () => Array.from(new Set(locations.map((l) => l.floorLevel))).sort(),
    [locations],
  )

  const filteredLocations = useMemo(
    () =>
      locations
        .filter((l) => (floorFilter === 'All' ? true : l.floorLevel === floorFilter))
        .filter((l) => (teamFilter === 'All' ? true : l.assignedTeam === teamFilter)),
    [locations, floorFilter, teamFilter],
  )

  // Resets the "show more" window whenever the filters or active column
  // change — otherwise switching columns could silently keep an unrelated
  // page size from a much bigger column.
  useEffect(() => {
    setVisibleCount(CARDS_PER_PAGE)
  }, [activeColumn, floorFilter, teamFilter])

  const columns: LocationStatus[] = LOCATION_STATUSES.filter((s) => s !== 'On Hold') // production flow columns per spec
  const activeIndex = columns.indexOf(activeColumn)

  async function moveCard(location: RailingLocation, direction: -1 | 1) {
    const currentIndex = columns.indexOf(location.status as LocationStatus)
    const nextIndex = currentIndex + direction
    if (nextIndex < 0 || nextIndex >= columns.length) return
    const nextStatus = columns[nextIndex]

    setBlockedCardId(null)
    if (nextStatus === 'Completed') {
      const blockers = await getCompletionBlockers(location.id)
      if (blockers.length > 0) {
        setBlockedCardId(location.id)
        setBlockedReason(`Can't advance to Completed — ${blockers.join('; ')}.`)
        return
      }
    }

    await updateLocationStatus(location.id, nextStatus)
    setLocations((prev) => prev.map((l) => (l.id === location.id ? { ...l, status: nextStatus } : l)))
  }

  const cardsInColumn = filteredLocations.filter((l) => l.status === activeColumn)
  const visibleCards = cardsInColumn.slice(0, visibleCount)

  return (
    <div className="min-h-screen bg-[#F5F8FC]">
      <PageHeader title="Production Board" subtitle="Optional view" />

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
              {col} ({filteredLocations.filter((l) => l.status === col).length})
            </button>
          ))}
        </div>

        <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
          <select
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
            className="shrink-0 rounded-full border border-xa-line bg-white px-3 py-1.5 text-xs font-bold text-xa-slate outline-none"
          >
            <option value="All">All floors</option>
            {floorsInUse.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value as AssignedTeam | 'All')}
            className="shrink-0 rounded-full border border-xa-line bg-white px-3 py-1.5 text-xs font-bold text-xa-slate outline-none"
          >
            <option value="All">All teams</option>
            {ASSIGNED_TEAMS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        {cardsInColumn.length === 0 && <p className="py-10 text-center text-sm text-xa-slate">No cards in this column.</p>}
        {visibleCards.map((location) => (
          <div key={location.id} className="rounded-2xl border border-xa-line bg-white p-4 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-extrabold text-xa-navy">{location.reference ?? location.id}</p>
                <p className="text-xs text-xa-slate">
                  {location.floorLevel} &middot; {location.unitNo ?? location.windowTag ?? '—'}
                </p>
              </div>
              <StatusBadge value={location.status} size="sm" />
            </div>

            {blockedCardId === location.id && (
              <p className="mt-2 text-xs font-medium text-red-600">{blockedReason}</p>
            )}

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
        {cardsInColumn.length > visibleCards.length && (
          <button
            onClick={() => setVisibleCount((v) => v + CARDS_PER_PAGE)}
            className="w-full rounded-2xl border border-xa-line bg-white py-3 text-sm font-bold text-xa-blue active:bg-xa-skyblue"
          >
            Show more ({cardsInColumn.length - visibleCards.length} remaining)
          </button>
        )}
      </div>
    </div>
  )
}
