import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { StatusCounts } from '../types'
import { STATUS_COLORS, STATUS_ORDER } from '../constants/statusColors'

interface FloorStatusDoughnutProps {
  floorLevel: string
  statusCounts: StatusCounts
  locationCount: number
}

export default function FloorStatusDoughnut({ floorLevel, statusCounts, locationCount }: FloorStatusDoughnutProps) {
  const data = STATUS_ORDER
    .map((status) => ({ status, count: statusCounts[status] }))
    .filter((d) => d.count > 0)

  const completedPct = locationCount ? Math.round((statusCounts.Completed / locationCount) * 100) : 0

  return (
    <div className="rounded-2xl border border-xa-line bg-white p-4 shadow-card">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-bold text-xa-navy">{floorLevel}</p>
        <p className="text-xs text-xa-slate">
          {locationCount} location{locationCount === 1 ? '' : 's'}
        </p>
      </div>

      {data.length === 0 ? (
        <p className="py-6 text-center text-xs text-xa-slate">No locations recorded yet.</p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="relative h-28 w-28 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={34}
                  outerRadius={52}
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                >
                  {data.map((d) => (
                    <Cell key={d.status} fill={STATUS_COLORS[d.status]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [`${value}`, name]}
                  contentStyle={{ borderRadius: 12, border: '1px solid #DCE4EC', fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-base font-extrabold text-xa-navy">{completedPct}%</p>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-xa-slate">Done</p>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-1.5">
            {data.map((d) => (
              <div key={d.status} className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLORS[d.status] }} />
                  <span className="text-xa-slate">{d.status}</span>
                </div>
                <span className="font-semibold text-xa-navy">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
