import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { LocationStatus, RailingLocation } from '../types'
import { LOCATION_STATUSES } from '../types'
import { getLocationById, updateLocationStatus } from '../services/locationService'
import { getCompletionBlockers } from '../services/statusTransitionService'
import { addTimelineEvent } from '../services/timelineService'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'

// Required whenever a location moves to On Hold — delay analysis (which
// the assessment calls out as the whole point of this field) depends on
// every hold having a reason, not a bare status flip. Kept as a fixed list
// (plus a free-text catch-all) rather than open text so the reasons stay
// reportable/groupable.
const ON_HOLD_REASONS = [
  'Area not released',
  'Material unavailable',
  'GC obstruction',
  'Design issue',
  'Access unavailable',
  'Manpower issue',
  'Client hold',
  'Other',
]

export default function UpdateStatusPage() {
  const { locationId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [location, setLocation] = useState<RailingLocation | null>(null)
  const [selected, setSelected] = useState<LocationStatus | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [holdReason, setHoldReason] = useState('')
  const [holdRemark, setHoldRemark] = useState('')

  useEffect(() => {
    getLocationById(locationId).then((l) => {
      setLocation(l ?? null)
      setSelected(l?.status ?? null)
    })
  }, [locationId])

  async function handleSave() {
    if (!selected || !location) return
    setError('')
    if (selected !== location.status) {
      if (selected === 'Completed') {
        setChecking(true)
        let blockers: string[]
        try {
          blockers = await getCompletionBlockers(locationId)
        } catch (err) {
          setChecking(false)
          setError(err instanceof Error ? err.message : 'Could not verify completion requirements. Try again.')
          return
        }
        setChecking(false)
        if (blockers.length > 0) {
          setError(`Can't mark Completed — ${blockers.join('; ')}.`)
          return
        }
      }

      if (selected === 'On Hold' && !holdReason) {
        setError('Select a reason for putting this location on hold.')
        return
      }

      const previousStatus = location.status
      await updateLocationStatus(locationId, selected)
      const now = new Date()
      const holdRemarks =
        selected === 'On Hold'
          ? `Reason: ${holdReason}${holdRemark ? ` — ${holdRemark}` : ''}`
          : `Previously: ${previousStatus}`
      await addTimelineEvent({
        locationId,
        date: now.toISOString().slice(0, 10),
        time: now.toTimeString().slice(0, 5),
        user: user?.name ?? 'Field User',
        action: `Status changed to ${selected}`,
        remarks: holdRemarks,
      })
    }
    setSaved(true)
    setTimeout(() => navigate(`/locations/${locationId}`), 700)
  }

  if (!location) return <div className="p-6 text-sm text-xa-slate">Loading…</div>

  return (
    <div className="min-h-screen bg-[#F5F7F8]">
      <PageHeader title="Update Status" subtitle={location.reference ?? locationId} />
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

        {selected === 'On Hold' && selected !== location.status && (
          <div className="space-y-3 rounded-2xl border border-xa-line bg-white p-4 shadow-card">
            <p className="text-xs font-bold uppercase tracking-wide text-xa-slate">Reason for hold (required)</p>
            <div className="flex flex-wrap gap-2">
              {ON_HOLD_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setHoldReason(reason)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    holdReason === reason ? 'border-xa-blue bg-xa-skyblue text-xa-blue' : 'border-xa-line text-xa-slate'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            <textarea
              value={holdRemark}
              onChange={(e) => setHoldRemark(e.target.value)}
              placeholder="Optional remark"
              rows={2}
              className="w-full rounded-xl border border-xa-line px-3 py-2 text-sm outline-none focus:border-xa-blue"
            />
          </div>
        )}

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}

        <button
          onClick={handleSave}
          disabled={checking}
          className="w-full rounded-2xl bg-xa-navy py-4 text-base font-bold text-white shadow-pop active:scale-[0.98] disabled:opacity-60"
        >
          {saved ? 'Saved ✓' : checking ? 'Checking…' : 'Save Status'}
        </button>
      </div>
    </div>
  )
}
