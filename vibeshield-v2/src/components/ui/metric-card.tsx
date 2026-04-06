'use client'

export function MetricCard({ label, value, sub, color = 'text-white' }: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="text-[10px] text-muted tracking-widest uppercase mb-2">{label}</div>
      <div className={`font-display text-3xl font-extrabold leading-none ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted mt-1.5">{sub}</div>}
    </div>
  )
}
