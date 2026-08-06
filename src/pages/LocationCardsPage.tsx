import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import type { AssignedTeam, LocationStatus, RailingLocation, UnitType } from '../types'
import { ASSIGNED_TEAMS, LOCATION_STATUSES } from '../types'
import { getLocations, getUnitTypesInUse } from '../services/locationService'
import { useAppData } from '../context/DataContext'
import PageHeader from '../components/PageHeader'
import LocationCard from '../components/LocationCard'

type SortOption = 'priority' | 'id' | 'status' | 'linearMeters'

export default function LocationCardsPage() {
  const navigate = useNavigate()
  const { selectedProjectCode, selectedFloor, selectedUnitType } = useAppData()
  const [locations, setLocations] = useState<RailingLocation[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LocationStatus | 'All'>('All')
  const [teamFilter, setTeamFilter] = useState<AssignedTeam | 'All'>('All')
  const [unitTypeFilter, setUnitTypeFilter] = useState<UnitType | 'All'>((selectedUnitType as UnitType) || 'All')
  const [sortBy, setSortBy] = useState<SortOption>('priority')
  const [showFilters, setShowFilters] = useState(false)
  const [unitTypesInUse, setUnitTypesInUse] = useState<UnitType[]>([])

  useEffect(() => {
    if (!selectedProjectCode) {
      navigate('/projects')
      return
    }
    getLocations({
      projectCode: selectedProjectCode,
      floorLevel: selectedFloor ?? undefined,
    }).then(setLocations)
    getUnitTypesInUse(selectedProjectCode).then(setUnitTypesInUse)
  }, [selectedProjectCode, selectedFloor, navigate])

  const filtered = useMemo(() => {
    const priorityRank = { High: 0, Medium: 1, Low: 2 }
    const statusRank = Object.fromEntries(LOCATION_STATUSES.map((s, i) => [s, i]))

    return locations
      .filter((l) => (statusFilter === 'All' ? true : l.status === statusFilter))
      .filter((l) => (teamFilter === 'All' ? true : l.assignedTeam === teamFilter))
      .filter((l) => (unitTypeFilter === 'All' ? true : l.unitType === unitTypeFilter))
      .filter((l) => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        return l.id.toLowerCase().includes(q) || l.unitNo.toLowerCase().includes(q)
      })
      .sort((a, b) => {
        if (sortBy === 'priority') return priorityRank[a.priority] - priorityRank[b.priority]
        if (sortBy === 'status') return statusRank[a.status] - statusRank[b.status]
        if (sortBy === 'linearMeters') return b.totalLinearMeters - a.totalLinearMeters
        return a.id.localeCompare(b.id)
      })
  }, [locations, statusFilter, teamFilter, unitTypeFilter, search, sortBy])

  const activeFilterCount = [statusFilter, teamFilter, unitTypeFilter].filter((f) => f !== 'All').length

  return (
    <div className="min-h-screen bg-[#F5F8FC]">
      <PageHeader
        title="Railing Locations"
        subtitle={selectedFloor ? `Floor ${selectedFloor}` : 'All floors'}
      />

      <div className="sticky top-[57px] z-10 space-y-2 border-b border-xa-line bg-[#F5F8FC] px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl border border-xa-line bg-white px-3 py-2.5">
          <Search size={16} className="text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID or unit no."
            className="w-full text-sm outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')}>
              <X size={14} className="text-slate-400" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
              activeFilterCount > 0 ? 'border-xa-blue bg-xa-skyblue text-xa-blue' : 'border-xa-line bg-white text-xa-slate'
            }`}
          >
            <SlidersHorizontal size={13} />
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="shrink-0 rounded-full border border-xa-line bg-white px-3 py-1.5 text-xs font-bold text-xa-slate outline-none"
          >
            <option value="priority">Sort: Priority</option>
            <option value="status">Sort: Status</option>
            <option value="id">Sort: Location ID</option>
            <option value="linearMeters">Sort: Linear meters</option>
          </select>
        </div>

        {showFilters && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as LocationStatus | 'All')}
              className="rounded-lg border border-xa-line bg-white px-2 py-2 text-xs font-semibold outline-none"
            >
              <option value="All">All statuses</option>
              {LOCATION_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value as AssignedTeam | 'All')}
              className="rounded-lg border border-xa-line bg-white px-2 py-2 text-xs font-semibold outline-none"
            >
              <option value="All">All teams</option>
              {ASSIGNED_TEAMS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={unitTypeFilter}
              onChange={(e) => setUnitTypeFilter(e.target.value as UnitType | 'All')}
              className="rounded-lg border border-xa-line bg-white px-2 py-2 text-xs font-semibold outline-none"
            >
              <option value="All">All unit types</option>
              {unitTypesInUse.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="space-y-3 px-4 py-4">
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-xa-slate">No locations match your filters.</p>
        )}
        {filtered.map((location) => (
          <LocationCard key={location.id} location={location} onClick={() => navigate(`/locations/${location.id}`)} />
        ))}
      </div>
    </div>
  )
}
