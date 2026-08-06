import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  accent?: 'navy' | 'blue' | 'amber' | 'red' | 'emerald' | 'violet' | 'slate'
  suffix?: string
}

const ACCENT_CLASSES: Record<string, string> = {
  navy: 'text-xa-navy bg-xa-skyblue',
  blue: 'text-xa-blue bg-blue-50',
  amber: 'text-amber-700 bg-amber-50',
  red: 'text-red-700 bg-red-50',
  emerald: 'text-emerald-700 bg-emerald-50',
  violet: 'text-violet-700 bg-violet-50',
  slate: 'text-slate-600 bg-slate-100',
}

export default function MetricCard({ label, value, icon: Icon, accent = 'navy', suffix }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-xa-line bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-xa-slate">{label}</p>
        {Icon && (
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${ACCENT_CLASSES[accent]}`}>
            <Icon size={16} />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-extrabold text-xa-navy">
        {value}
        {suffix && <span className="ml-1 text-sm font-semibold text-xa-slate">{suffix}</span>}
      </p>
    </div>
  )
}
