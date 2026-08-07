import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock, PauseCircle, ClipboardList, ListTodo, Ruler, Layers, Circle, AlertTriangle } from 'lucide-react'
import type { ProjectDashboardSummary } from '../types'
import { getProjectDashboard } from '../services/locationService'
import { useAppData } from '../context/DataContext'
import MetricCard from '../components/MetricCard'
import PageHeader from '../components/PageHeader'
import FloorStatusDoughnut from '../components/FloorStatusDoughnut'

export default function ProjectDashboardPage() {
  const navigate = useNavigate()
  const { selectedProjectCode } = useAppData()
  const [summary, setSummary] = useState<ProjectDashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!selectedProjectCode) {
      navigate('/projects')
      return
    }
    setSummary(null)
    setError(null)
    getProjectDashboard(selectedProjectCode)
      .then(setSummary)
      .catch((err: unknown) => {
        console.error('Failed to load project dashboard:', err)
        setError(err instanceof Error ? err.message : 'Failed to load dashboard.')
      })
  }, [selectedProjectCode, navigate, reloadKey])

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

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-xa-slate">Locations by status</p>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Completed" value={summary.statusCounts.Completed} icon={CheckCircle2} accent="emerald" />
            <MetricCard label="In Progress" value={summary.statusCounts['In Progress']} icon={Clock} accent="blue" />
            <MetricCard label="On Hold" value={summary.statusCounts['On Hold']} icon={PauseCircle} accent="violet" />
            <MetricCard label="Not Started" value={summary.statusCounts['Not Started']} icon={Circle} accent="slate" />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-xa-slate">Accomplishment by floor</p>
          <div className="space-y-3">
            {summary.byFloorStatus.map((floor) => (
              <FloorStatusDoughnut
                key={floor.floorLevel}
                floorLevel={floor.floorLevel}
                statusCounts={floor.statusCounts}
                locationCount={floor.locationCount}
              />
            ))}
          </div>
        </div>

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
