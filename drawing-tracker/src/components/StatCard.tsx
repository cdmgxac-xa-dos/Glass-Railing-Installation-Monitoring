export function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string | number
  tone?: 'default' | 'good' | 'warn' | 'bad'
}) {
  const toneClass = {
    default: 'text-brand-ink',
    good: 'text-green-600',
    warn: 'text-amber-600',
    bad: 'text-red-600',
  }[tone]

  return (
    <div className="rounded-xl border border-brand-line bg-white p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-slate">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  )
}
