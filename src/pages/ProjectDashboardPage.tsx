import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  Clock,
  PauseCircle,
  ClipboardList,
  ListTodo,
  Ruler,
  Layers,
  Circle,
  AlertTriangle,
  Hourglass,
} from 'lucide-react'
import type { ProjectDashboardSummary } from '../types'
import { getProjectDashboard, getLocationsByProject } from '../services/locationService'
import { getPunchListForProject } from '../services/punchListService'
import { useAppData } from '../context/DataContext'
import MetricCard from '../components/MetricCard'
import PageHeader from '../components/PageHeader'
import FloorProgressRow from '../components/FloorProgressRow'

const STALLED_ACTIVE_STATUSES = ['In Progress', 'QC Inspection', 'Punch List']
const STALLED_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000

interface AttentionCounts {
  onHold: number
  overduePunch: number
  stalled: number
}

export default function ProjectDashboardPage() {
  const navigate = useNavigate()
  const { selectedProjectCode, selectedScope } = useAppData()
  const [summary, setSummary] = useState<ProjectDashboardSummary | null>(null)
  const [attention, setAttention] = useState<AttentionCounts | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!selectedProjectCode) {
      navigate('/projects')
      return
    }
    setSummary(null)
    setError(null)
    getProjectDashboard(selectedProjectCode, selectedScope ?? undefined)
      .then(setSummary)
      .catch((err: unknown) => {
        console.error('Failed to load project dashboard:', err)
        setError(err instanceof Error ? err.message : 'Failed to load dashboard.')
      })
  }, [selectedProjectCode, selectedScope, navigate, reloadKey])

  // Separate effect/state from the main summary — a failure here (e.g. no
  // punch items table access) shouldn't block the rest of the dashboard
  // from rendering.
  useEffect(() => {
    if (!selectedProjectCode || !summary) return
    const today = new Date().toISOString().slice(0, 10)
    Promise.all([getLocationsByProject(selectedProjectCode, selectedScope ?? undefined), getPunchListForProject(selectedProjectCode)])
      .then(([locations, punchItems]) => {
        const stalled = locations.filter(
          (l) =>
            STALLED_ACTIVE_STATUSES.includes(l.status) &&
            Date.now() - new Date(l.updatedAt).getTime() > STALLED_THRESHOLD_MS,
        ).length
        const overduePunch = punchItems.filter(
          (p) => p.status !== 'Closed' && p.targetCompletionDate && p.targetCompletionDate < today,
        ).length
        setAttention({ onHold: summary.statusCounts['On Hold'], overduePunch, stalled })
      })
      .catch((err: unknown) => console.error('Failed to load attention-required counts:', err))
  }, [selectedProjectCode, selectedScope, summary])

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F5F8FC] p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="text-sm font-semibold text-xa-navy">Couldn't load the dashboard</p>
        <p className="max-w-xs text-xs text-xa-slate">{error}</p>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          className="mt-2 rounded-xl bg-xa-navy px-4 py-2 text-sm font-bold text-white active:scale-[0.98]"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!summary) return <div className="p-6 text-sm text-xa-slate">Loading dashboard…</div>

  return (
    <div className="min-h-screen bg-[#F5F8FC]">
      <PageHeader title={summary.projectName} subtitle="Project dashboard" showBack={false} />

      <div className="space-y-5 px-4 py-5">
        <div className="rounded-2xl border border-xa-line bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-xa-slate">Overall progress</p>
            <p className="text-2xl font-extrabold text-xa-navy">{summary.overallProgressPct}%</p>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-xa-blue transition-all"
              style={{ width: `${summary.overallProgressPct}%` }}
            />
          </div>
        </div>

        {attention && (attention.onHold > 0 || summary.qcPending > 0 || attention.overduePunch > 0 || attention.stalled > 0) && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-xa-slate">Attention required</p>
            <div className="grid grid-cols-2 gap-3">
              {attention.onHold > 0 && (
                <button onClick={() => navigate(`/locations?status=${encodeURIComponent('On Hold')}`)} className="text-left">
                  <MetricCard label="On Hold" value={attention.onHold} icon={PauseCircle} accent="violet" />
                </button>
              )}
              {summary.qcPending > 0 && (
                <button
                  onClick={() => navigate(`/locations?status=${encodeURIComponent('QC Inspection')}`)}
                  className="text-left"
                >
                  <MetricCard label="Awaiting QC" value={summary.qcPending} icon={ClipboardList} accent="amber" />
                </button>
              )}
              {attention.overduePunch > 0 && (
                <button onClick={() => navigate('/punch-list?overdue=1')} className="text-left">
                  <MetricCard label="Overdue Punch" value={attention.overduePunch} icon={AlertTriangle} accent="red" />
                </button>
              )}
              {attention.stalled > 0 && (
                <button onClick={() => navigate('/locations?stalled=1')} className="text-left">
                  <MetricCard label="Stalled > 2 Days" value={attention.stalled} icon={Hourglass} accent="slate" />
                </button>
              )}
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-xa-slate">Locations by status</p>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Completed" value={summary.statusCounts.Completed} icon={CheckCircle2} accent="emerald" />
            <MetricCard label="In Progress" value={summary.statusCounts['In Progress']} icon={Clock} accent="blue" />
            <MetricCard label="On Hold" value={summary.statusCounts['On Hold']} icon={PauseCircle} accent="violet" />
            <MetricCard label="Not Started" value={summary.statusCounts['Not Started']} icon={Circle} accent="slate" />
          </div>
        </div>

        {/* Only renders once a project actually has more than one
            installation scope's worth of data — every project today is
            Railings-only, so this stays invisible until Doors & Windows
            locations are actually loaded somewhere. */}
        {summary.byScope.length > 1 && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-xa-slate">By scope</p>
            <div className="space-y-3">
              {summary.byScope.map((s) => (
                <div key={s.scope} className="rounded-2xl border border-xa-line bg-white p-4 shadow-card">
                  <div className="flex items-center justify-between text-sm">
                    <p className="font-semibold text-xa-navy">{s.scopeName}</p>
                    <p className="font-extrabold text-xa-navy">{s.progressPct}%</p>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-xa-blue transition-all" style={{ width: `${s.progressPct}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-xa-slate">
                    {s.completedLocations}/{s.totalLocations} locations completed
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-xa-slate">Accomplishment by floor</p>
          <div className="space-y-2">
            {summary.byFloorStatus.map((floor) => (
              <FloorProgressRow
                key={floor.floorLevel}
                floorLevel={floor.floorLevel}
                statusCounts={floor.statusCounts}
                locationCount={floor.locationCount}
              />
            ))}
          </div>
        </div>

        {summary.byScope.length > 1 && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-xa-slate">By floor &amp; scope</p>
            <div className="space-y-2">
              {Array.from(new Set(summary.byFloorScope.map((f) => f.floorLevel))).map((floorLevel) => (
                <div key={floorLevel} className="rounded-2xl border border-xa-line bg-white p-3 shadow-card">
                  <p className="mb-1.5 text-sm font-bold text-xa-navy">{floorLevel}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {summary.byFloorScope
                      .filter((f) => f.floorLevel === floorLevel)
                      .map((f) => (
                        <p key={f.scope} className="text-xs text-xa-slate">
                          <span className="font-semibold text-xa-navy">{f.scopeName}</span> {f.progressPct}%
                        </p>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-xa-slate">Today</p>
          <div className="grid grid-cols-3 gap-3">
            <MetricCard label="Locations worked" value={summary.locationsWorkedToday} icon={ListTodo} accent="navy" />
            <MetricCard label="Linear meters" value={summary.linearMetersInstalledToday} icon={Ruler} accent="blue" />
            <MetricCard label="Panels installed" value={summary.panelsInstalledToday} icon={Layers} accent="blue" />
          </div>
        </div>

        <MetricCard label="QC pending" value={summary.qcPending} icon={ClipboardList} accent="amber" />

        <button
          onClick={() => navigate('/floors')}
          className="w-full rounded-2xl bg-xa-navy py-4 text-base font-bold text-white shadow-pop active:scale-[0.98]"
        >
          Select Floor
        </button>
      </div>
    </div>
  )
}
