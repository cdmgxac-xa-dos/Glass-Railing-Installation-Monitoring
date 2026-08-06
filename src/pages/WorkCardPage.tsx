import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Camera,
  ClipboardCheck,
  ListChecks,
  ListTodo,
  MessageSquare,
  History,
  RefreshCcw,
  Ruler,
  Layers,
  Wrench,
  Users,
} from 'lucide-react'
import type { RailingLocation } from '../types'
import { getLocationById } from '../services/locationService'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'

const ACTIONS = [
  { key: 'installation', label: 'Installation', icon: ListChecks, path: 'checklist' },
  { key: 'photos', label: 'Photos', icon: Camera, path: 'photos' },
  { key: 'qc', label: 'QC Inspection', icon: ClipboardCheck, path: 'qc' },
  { key: 'punch', label: 'Punch List', icon: ListTodo, path: 'punch-list' },
  { key: 'notes', label: 'Notes & Comments', icon: MessageSquare, path: 'notes' },
  { key: 'timeline', label: 'Timeline', icon: History, path: 'timeline' },
]

export default function WorkCardPage() {
  const { locationId = '' } = useParams()
  const navigate = useNavigate()
  const [location, setLocation] = useState<RailingLocation | null>(null)

  useEffect(() => {
    getLocationById(locationId).then((l) => setLocation(l ?? null))
  }, [locationId])

  if (!location) return <div className="p-6 text-sm text-xa-slate">Loading location…</div>

  return (
    <div className="min-h-screen bg-[#F5F8FC]">
      <PageHeader title={location.id} subtitle={`${location.floorLevel} · ${location.unitNo}`} />

      <div className="space-y-5 px-4 py-5">
        <div className="rounded-2xl border border-xa-line bg-white p-4 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-extrabold text-xa-navy">{location.unitNo}</p>
            <StatusBadge value={location.status} />
          </div>
          <p className="mt-0.5 text-xs text-xa-slate">{location.unitType} &middot; {location.floorLevel}</p>

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-xa-slate">
            <div className="flex items-center gap-1.5">
              <Ruler size={14} className="text-xa-blue" /> {location.totalLinearMeters.toFixed(1)} linear meters
            </div>
            <div className="flex items-center gap-1.5">
              <Layers size={14} className="text-xa-blue" /> {location.totalGlassPanels} glass panels
            </div>
            <div className="flex items-center gap-1.5">
              <Wrench size={14} className="text-xa-blue" /> {location.bracketSystem}
            </div>
            <div className="flex items-center gap-1.5">
              <Users size={14} className="text-xa-blue" /> {location.assignedTeam}
            </div>
          </div>

          {location.remarks && location.remarks !== 'None' && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              {location.remarks}
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-xa-slate">Work actions</p>
          <div className="grid grid-cols-2 gap-3">
            {ACTIONS.map(({ key, label, icon: Icon, path }) => (
              <button
                key={key}
                onClick={() => navigate(`/locations/${location.id}/${path}`)}
                className="flex flex-col items-start gap-3 rounded-2xl border border-xa-line bg-white p-4 text-left shadow-card active:scale-[0.98] active:bg-xa-skyblue"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-xa-skyblue text-xa-blue">
                  <Icon size={20} />
                </span>
                <span className="text-sm font-bold text-xa-navy">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => navigate(`/locations/${location.id}/status`)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-xa-navy py-4 text-base font-bold text-white shadow-pop active:scale-[0.98]"
        >
          <RefreshCcw size={18} /> Update Status
        </button>
      </div>
    </div>
  )
}
