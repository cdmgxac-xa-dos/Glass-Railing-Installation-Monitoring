import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { PunchListItem, PunchListStatus } from '../types'
import { PUNCH_LIST_STATUSES } from '../types'
import { getPunchListForLocation, getPunchListForProject, updatePunchListStatus } from '../services/punchListService'
import { useAppData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import PunchListCard from '../components/PunchListCard'
import StatusBadge from '../components/StatusBadge'

export default function PunchListPage() {
  const { locationId } = useParams()
  const navigate = useNavigate()
  const { selectedProjectCode } = useAppData()
  const { user } = useAuth()
  const [items, setItems] = useState<PunchListItem[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (locationId) {
      getPunchListForLocation(locationId).then(setItems)
    } else if (selectedProjectCode) {
      getPunchListForProject(selectedProjectCode).then(setItems)
    } else {
      navigate('/projects')
    }
  }, [locationId, selectedProjectCode, navigate])

  async function handleStatusChange(id: string, status: PunchListStatus) {
    await updatePunchListStatus(id, status, user?.name ?? 'Field User')
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)))
  }

  return (
    <div className="min-h-screen bg-[#F5F8FC]">
      <PageHeader title="Punch List" subtitle={locationId ?? 'All open items'} />

      <div className="space-y-3 px-4 py-5">
        {items.length === 0 && (
          <p className="py-10 text-center text-sm text-xa-slate">No punch-list items here. Nice and clean.</p>
        )}
        {items.map((item) => (
          <div key={item.id}>
            <PunchListCard
              item={item}
              locationLabel={locationId ? undefined : item.locationId}
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
