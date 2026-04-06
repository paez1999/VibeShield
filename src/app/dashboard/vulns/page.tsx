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
  const [selected, setSelected] = useState<Set<string>>(new Set())

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

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === vulns.length) setSelected(new Set())
    else setSelected(new Set(vulns.map((v: any) => v.id)))
  }

  const handleBulk = async (action: 'resolve' | 'ignore') => {
    if (selected.size === 0) return
    await api.post('/api/vulns/bulk', { ids: [...selected], action })
    setSelected(new Set())
    load()
  }

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

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-surface border border-border rounded-lg px-4 py-2.5">
          <span className="text-[11px] text-white font-medium">{selected.size} selected</span>
          <div className="flex-1" />
          <button onClick={() => handleBulk('resolve')} className="text-[11px] text-green-400 hover:text-green-300 font-medium">Resolve all</button>
          <button onClick={() => handleBulk('ignore')} className="text-[11px] text-muted hover:text-text font-medium">Ignore all</button>
          <button onClick={() => setSelected(new Set())} className="text-[11px] text-muted hover:text-red">Clear</button>
        </div>
      )}

      {/* Vuln list */}
      <Panel>
        {loading ? (
          <div className="flex items-center justify-center py-10 gap-2 text-muted">
            <Spinner /> Loading...
          </div>
        ) : vulns.length === 0 ? (
          <Empty message="No vulnerabilities match your filters." />
        ) : (
          <>
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
              <input type="checkbox" checked={vulns.length > 0 && selected.size === vulns.length} onChange={toggleAll}
                className="accent-red w-3.5 h-3.5" />
              <span className="text-[10px] text-muted">Select all</span>
            </div>
            {vulns.map(v => (
              <div key={v.id} className="flex items-start gap-2">
                <div className="pt-3 pl-3">
                  <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggleOne(v.id)}
                    className="accent-red w-3.5 h-3.5" />
                </div>
                <div className="flex-1">
                  <VulnRow vuln={v} onResolve={handleResolve} onIgnore={handleIgnore} />
                </div>
              </div>
            ))}
          </>
        )}
      </Panel>
    </div>
  )
}
