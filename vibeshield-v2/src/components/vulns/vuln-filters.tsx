'use client'

const STATUSES = ['open', 'resolved', 'ignored', 'all'] as const
const SEVERITIES = ['All', 'critical', 'high', 'medium', 'low'] as const
const CATEGORIES = ['All', 'SQL Injection', 'XSS', 'Path Traversal', 'Command Injection', 'SSRF', 'Weak crypto', 'Broken auth', 'Secret Exposure', 'Missing headers', 'IDOR', 'Code vulnerability']

interface VulnFiltersProps {
  status: string
  severity: string
  category: string
  onStatusChange: (s: string) => void
  onSeverityChange: (s: string) => void
  onCategoryChange: (c: string) => void
}

export function VulnFilters({ status, severity, category, onStatusChange, onSeverityChange, onCategoryChange }: VulnFiltersProps) {
  return (
    <div className="flex gap-2.5 flex-wrap items-center">
      {/* Status tabs */}
      <div className="flex gap-1">
        {STATUSES.map(s => (
          <button key={s} onClick={() => onStatusChange(s)}
            className={`rounded-sm text-[11px] px-3 py-1 border transition-all ${
              status === s ? 'bg-surface2 border-border2 text-white' : 'bg-transparent border-border text-muted'
            }`}
          >{s}</button>
        ))}
      </div>

      {/* Severity pills */}
      <div className="flex gap-1">
        {SEVERITIES.map(s => (
          <button key={s} onClick={() => onSeverityChange(s === 'All' ? '' : s)}
            className={`rounded-sm text-[10px] px-2.5 py-1 border transition-all ${
              (severity === '' && s === 'All') || severity === s ? 'bg-surface2 border-border2 text-white' : 'bg-transparent border-border text-muted'
            }`}
          >{s}</button>
        ))}
      </div>

      {/* Category dropdown */}
      <select value={category} onChange={e => onCategoryChange(e.target.value === 'All' ? '' : e.target.value)}
        className="bg-surface border border-border rounded-sm text-text text-[11px] px-2.5 py-1 outline-none"
      >
        {CATEGORIES.map(c => <option key={c} value={c === 'All' ? '' : c}>{c}</option>)}
      </select>
    </div>
  )
}
