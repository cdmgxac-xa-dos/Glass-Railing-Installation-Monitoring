import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { PunchListItem, PunchListStatus } from '../types'
import { PUNCH_LIST_STATUSES } from '../types'
import { getPunchListForLocation, getPunchListForProject, updatePunchListStatus } from '../services/punchListService'
import { getLocationsByProject } from '../services/locationService'
import { useAppData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { useLocationReference } from '../hooks/useLocationReference'
import { buildPunchDisplayIds } from '../utils/punchListDisplay'
import PageHeader from '../components/PageHeader'
import PunchListCard from '../components/PunchListCard'
import StatusBadge from '../components/StatusBadge'

export default function PunchListPage() {
  const { locationId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { selectedProjectCode } = useAppData()
  const { user } = useAuth()
  const reference = useLocationReference(locationId ?? '')
  const [items, setItems] = useState<PunchListItem[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [overdueOnly, setOverdueOnly] = useState(searchParams.get('overdue') === '1')
  // locationId -> reference, only needed for the all-locations view where
  // each card shows which location it belongs to.
  const [referenceByLocation, setReferenceByLocation] = useState<Record<string, string>>({})

  useEffect(() => {
    if (locationId) {
      getPunchListForLocation(locationId).then(setItems)
    } else if (selectedProjectCode) {
      getPunchListForProject(selectedProjectCode).then(setItems)
      getLocationsByProject(selectedProjectCode).then((locations) => {
        setReferenceByLocation(Object.fromEntries(locations.map((l) => [l.id, l.reference ?? l.id])))
      })
    } else {
      navigate('/projects')
    }
  }, [locationId, selectedProjectCode, navigate])

  async function handleStatusChange(id: string, status: PunchListStatus) {
    await updatePunchListStatus(id, status, user?.name ?? 'Field User')
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)))
  }

  const displayIds = useMemo(
    () =>
      buildPunchDisplayIds(items, (locId) =>
        locationId ? reference : (referenceByLocation[locId] ?? locId),
      ),
    [items, locationId, reference, referenceByLocation],
  )

  const today = new Date().toISOString().slice(0, 10)
  const visibleItems = useMemo(
    () =>
      overdueOnly
        ? items.filter((item) => item.status !== 'Closed' && item.targetCompletionDate && item.targetCompletionDate < today)
        : items,
    [items, overdueOnly, today],
  )

  return (
    <div className="min-h-screen bg-[#F5F8FC]">
      <PageHeader title="Punch List" subtitle={locationId ? reference : 'All open items'} />

      {!locationId && (
        <div className="px-4 pt-4">
          <button
            onClick={() => setOverdueOnly((v) => !v)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
              overdueOnly ? 'border-xa-blue bg-xa-skyblue text-xa-blue' : 'border-xa-line bg-white text-xa-slate'
            }`}
          >
            Overdue only
          </button>
        </div>
      )}

      <div className="space-y-3 px-4 py-5">
        {visibleItems.length === 0 && (
          <p className="py-10 text-center text-sm text-xa-slate">
            {overdueOnly ? 'No overdue punch items.' : 'No punch-list items here. Nice and clean.'}
          </p>
        )}
        {visibleItems.map((item) => (
          <div key={item.id}>
            <PunchListCard
              item={item}
              displayId={displayIds[item.id]}
              locationLabel={locationId ? undefined : (referenceByLocation[item.locationId] ?? item.locationId)}
              onClick={() => setExpanded((cur) => (cur === item.id ? null : item.id))}
            />
            {expanded === item.id && (
              <div className="mt-2 rounded-2xl border border-xa-line bg-white p-4 shadow-card">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-xa-slate">Update status</p>
                <div className="flex flex-wrap gap-2">
                  {PUNCH_LIST_STATUSES.map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(item.id, status)}
                      className={item.status === status ? 'opacity-100' : 'opacity-40'}
                    >
                      <StatusBadge value={status} size="sm" />
                    </button>
                  ))}
                </div>
                {item.rectificationNotes && (
                  <p className="mt-3 text-xs text-xa-slate">Notes: {item.rectificationNotes}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
