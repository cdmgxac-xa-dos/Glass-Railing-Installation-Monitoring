import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { LocationStatus, RailingLocation } from '../types'
import { LOCATION_STATUSES } from '../types'
import { getLocationById, updateLocationStatus } from '../services/locationService'
import { addTimelineEvent } from '../services/timelineService'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'

export default function UpdateStatusPage() {
  const { locationId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [location, setLocation] = useState<RailingLocation | null>(null)
  const [selected, setSelected] = useState<LocationStatus | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getLocationById(locationId).then((l) => {
      setLocation(l ?? null)
      setSelected(l?.status ?? null)
    })
  }, [locationId])

  async function handleSave() {
    if (!selected || !location) return
    if (selected !== location.status) {
      const previousStatus = location.status
      await updateLocationStatus(locationId, selected)
      const now = new Date()
      await addTimelineEvent({
        locationId,
        date: now.toISOString().slice(0, 10),
        time: now.toTimeString().slice(0, 5),
        user: user?.name ?? 'Field User',
        action: `Status changed to ${selected}`,
        remarks: `Previously: ${previousStatus}`,
      })
    }
    setSaved(true)
    setTimeout(() => navigate(`/locations/${locationId}`), 700)
  }

  if (!location) return <div className="p-6 text-sm text-xa-slate">Loading…</div>

  return (
    <div className="min-h-screen bg-[#F5F8FC]">
      <PageHeader title="Update Status" subtitle={locationId} />
      <div className="space-y-3 px-4 py-5">
        <p className="text-xs font-bold uppercase tracking-wide text-xa-slate">Current status</p>
        <StatusBadge value={location.status} />

        <p className="pt-3 text-xs font-bold uppercase tracking-wide text-xa-slate">Set new status</p>
        <div className="space-y-2">
          {LOCATION_STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => setSelected(status)}
              className={`flex w-full items-center justify-between rounded-2xl border-2 bg-white px-4 py-3.5 text-left transition ${
                selected === status ? 'border-xa-blue bg-xa-skyblue' : 'border-xa-line'
              }`}
            >
              <StatusBadge value={status} />
              {selected === status && <span className="text-xs font-bold text-xa-blue">Selected</span>}
            </button>
          ))}
        </div>

        <button
          onClick={handleSave}
          className="w-full rounded-2xl bg-xa-navy py-4 text-base font-bold text-white shadow-pop active:scale-[0.98]"
        >
          {saved ? 'Saved ✓' : 'Save Status'}
        </button>
      </div>
    </div>
  )
}
