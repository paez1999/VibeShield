'use client'

import { useEffect, useState, useCallback } from 'react'
import { useApi } from '@/lib/hooks/use-api'
import { PageHeader } from '@/components/layout/page-header'
import { Panel } from '@/components/ui/panel'
import { Spinner } from '@/components/ui/spinner'
import { Empty } from '@/components/ui/empty'
import { VulnFilters } from '@/components/vulns/vuln-filters'
import { VulnRow } from '@/components/vulns/vuln-row'

const SEV_COLOR: Record<string, string> = {
  critical: 'text-red',
  high: 'text-amber',
  medium: 'text-blue',
  low: 'text-muted',
}

const SEV_BORDER: Record<string, string> = {
  critical: '#f04444',
  high: '#f5a623',
  medium: '#4f8ef7',
  low: '#4a5168',
}

export default function VulnsPage() {
  const api = useApi()
  const [vulns, setVulns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('open')
  const [severity, setSeverity] = useState('')
  const [category, setCategory] = useState('')
  const [counts, setCounts] = useState({ critical: 0, high: 0, medium: 0, low: 0 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status !== 'all') params.set('status', status)
      if (severity) params.set('severity', severity)
      if (category) params.set('category', category)
      params.set('limit', '100')

      const res = await api.get(`/api/vulns?${params}`)
      setVulns(res.data || [])

      // Get counts for summary cards
      const summary = await api.get('/api/vulns/summary')
      setCounts(summary)
    } catch {} finally {
      setLoading(false)
    }
  }, [status, severity, category])

  useEffect(() => { load() }, [load])

  const handleResolve = async (id: string) => {
    await api.patch(`/api/vulns/${id}/resolve`)
    load()
  }

  const handleIgnore = async (id: string) => {
    await api.patch(`/api/vulns/${id}/ignore`)
    load()
  }

  return (
    <div className="max-w-[1000px] animate-fade-in flex flex-col gap-5">
      <PageHeader subtitle="VULNERABILITIES" title="All findings" />

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-2.5">
        {(['critical', 'high', 'medium', 'low'] as const).map(s => (
          <div
            key={s}
            onClick={() => setSeverity(severity === s ? '' : s)}
            className="bg-surface rounded-lg p-3 cursor-pointer transition-colors border"
            style={{ borderColor: severity === s ? SEV_BORDER[s] : undefined }}
          >
            <div className={`font-display text-[26px] font-extrabold ${SEV_COLOR[s]}`}>{counts[s] ?? 0}</div>
            <div className="text-[10px] text-muted uppercase tracking-widest mt-1">{s}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <VulnFilters
        status={status} severity={severity} category={category}
        onStatusChange={setStatus} onSeverityChange={setSeverity} onCategoryChange={setCategory}
      />

      {/* Vuln list */}
      <Panel>
        {loading ? (
          <div className="flex items-center justify-center py-10 gap-2 text-muted">
            <Spinner /> Loading...
          </div>
        ) : vulns.length === 0 ? (
          <Empty message="No vulnerabilities match your filters." />
        ) : (
          vulns.map(v => (
            <VulnRow key={v.id} vuln={v} onResolve={handleResolve} onIgnore={handleIgnore} />
          ))
        )}
      </Panel>
    </div>
  )
}
