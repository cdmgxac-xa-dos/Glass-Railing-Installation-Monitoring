import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import type { ProjectDashboardSummary } from '../types'
import { getProjectDashboard } from '../services/locationService'
import { useAppData } from '../context/DataContext'
import PageHeader from '../components/PageHeader'
import RecentActivityFeed from '../components/RecentActivityFeed'

// ---------------------------------------------------------------------------
// Dashboard tab (/dashboard).
//
// Previously this route rendered ProjectDashboardPage — the exact same
// component as Home (/project), so the two tabs were identical. They're now
// split: Home keeps the full breakdown (Locations by status, Accomplishment
// by floor, Today, QC pending), and Dashboard is Overall progress plus the
// recent activity feed. The Overall progress block below is a deliberate
// copy of Home's, unchanged — Home is not to be modified.
// ---------------------------------------------------------------------------

export default function DashboardPage() {
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
      <PageHeader title={summary.projectName} subtitle="Dashboard" showBack={false} />

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

        {selectedProjectCode && <RecentActivityFeed projectCode={selectedProjectCode} />}
      </div>
    </div>
  )
}
