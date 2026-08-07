import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { LocationStatus, OwnerDashboardSummary } from '../types'
import { getOwnerDashboard } from '../services/locationService'
import { useAppData } from '../context/DataContext'
import PageHeader from '../components/PageHeader'
import MetricCard from '../components/MetricCard'
import { CheckCircle2, Clock, ClipboardList, ListTodo, PauseCircle, Circle } from 'lucide-react'
import { STATUS_COLORS } from '../constants/statusColors'

function MiniBarChart({ data }: { data: { label: string; count: number }[] }) {
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DCE4EC" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#4A5A6A' }} interval={0} angle={-35} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10, fill: '#4A5A6A' }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #DCE4EC', fontSize: 12 }}
            cursor={{ fill: '#EAF2FE' }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.label} fill={STATUS_COLORS[d.label as LocationStatus] ?? '#1D6FE0'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function OwnerDashboardPage() {
  const navigate = useNavigate()
  const { selectedProjectCode } = useAppData()
  const [summary, setSummary] = useState<OwnerDashboardSummary | null>(null)

  useEffect(() => {
    if (!selectedProjectCode) {
      navigate('/projects')
      return
    }
    getOwnerDashboard(selectedProjectCode).then(setSummary)
  }, [selectedProjectCode, navigate])

  if (!summary) return <div className="p-6 text-sm text-xa-slate">Loading dashboard…</div>

  return (
    <div className="min-h-screen bg-[#F5F8FC] pb-8">
      <PageHeader title="Owner Dashboard" subtitle="Portfolio-wide progress" />

      <div className="space-y-5 px-4 py-5">
        <div className="rounded-2xl border border-xa-line bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-xa-slate">Overall completion</p>
            <p className="text-2xl font-extrabold text-xa-navy">{summary.overallCompletionPct}%</p>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-xa-blue" style={{ width: `${summary.overallCompletionPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-xa-slate">{summary.totalLocations} total railing locations</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Completed" value={summary.statusCounts.Completed} icon={CheckCircle2} accent="emerald" />
          <MetricCard label="In Progress" value={summary.statusCounts['In Progress']} icon={Clock} accent="blue" />
          <MetricCard label="QC Inspection" value={summary.statusCounts['QC Inspection']} icon={ClipboardList} accent="amber" />
          <MetricCard label="Punch List" value={summary.statusCounts['Punch List']} icon={ListTodo} accent="red" />
          <MetricCard label="On Hold" value={summary.statusCounts['On Hold']} icon={PauseCircle} accent="violet" />
          <MetricCard label="Not Started" value={summary.statusCounts['Not Started']} icon={Circle} accent="slate" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Linear meters installed"
            value={`${summary.installedLinearMeters}/${summary.totalLinearMeters}`}
            suffix="LM"
            accent="navy"
          />
          <MetricCard
            label="Panels installed"
            value={`${summary.installedGlassPanels}/${summary.totalGlassPanels}`}
            accent="navy"
          />
        </div>

        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-xa-slate">By status</p>
          <div className="rounded-2xl border border-xa-line bg-white p-3 shadow-card">
            <MiniBarChart data={summary.byStatus} />
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-xa-slate">By floor</p>
          <div className="rounded-2xl border border-xa-line bg-white p-3 shadow-card">
            <MiniBarChart data={summary.byFloor} />
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-xa-slate">By unit type</p>
          <div className="rounded-2xl border border-xa-line bg-white p-3 shadow-card">
            <MiniBarChart data={summary.byUnitType} />
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-xa-slate">By assigned team</p>
          <div className="rounded-2xl border border-xa-line bg-white p-3 shadow-card">
            <MiniBarChart data={summary.byTeam} />
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-xa-slate">By bracket system</p>
          <div className="rounded-2xl border border-xa-line bg-white p-3 shadow-card">
            <MiniBarChart data={summary.byBracketSystem} />
          </div>
        </section>
      </div>
    </div>
  )
}
