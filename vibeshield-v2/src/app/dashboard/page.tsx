'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApi } from '@/lib/hooks/use-api'
import { PageHeader } from '@/components/layout/page-header'
import { MetricCard } from '@/components/ui/metric-card'
import { Panel } from '@/components/ui/panel'
import { Badge } from '@/components/ui/badge'
import { ScoreBar } from '@/components/ui/score-bar'
import { Spinner } from '@/components/ui/spinner'
import { Empty } from '@/components/ui/empty'

function scoreFromSummary(s: { critical: number; high: number; medium: number; low: number }) {
  const weighted = s.critical * 10 + s.high * 5 + s.medium * 2 + s.low * 0.5
  if (weighted === 0) return { score: 100, grade: 'A' }
  if (weighted <= 5) return { score: 80, grade: 'B' }
  if (weighted <= 15) return { score: 55, grade: 'C' }
  if (weighted <= 30) return { score: 30, grade: 'D' }
  return { score: 10, grade: 'F' }
}

export default function DashboardPage() {
  const api = useApi()
  const router = useRouter()
  const [summary, setSummary] = useState({ critical: 0, high: 0, medium: 0, low: 0, info: 0 })
  const [scans, setScans] = useState<any[]>([])
  const [vulns, setVulns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [scanInput, setScanInput] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<any>(null)

  useEffect(() => {
    Promise.all([
      api.get('/api/vulns/summary').then(setSummary).catch(() => {}),
      api.get('/api/scans?limit=5').then(r => setScans(r.data || [])).catch(() => {}),
      api.get('/api/vulns?status=open&limit=5').then(r => setVulns(r.data || [])).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const { score, grade } = scoreFromSummary(summary)
  const scoreColor = score < 40 ? 'text-red' : score < 70 ? 'text-amber' : 'text-green'

  const handleQuickScan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scanInput.trim()) return
    setScanning(true)
    setScanResult(null)
    try {
      const input = scanInput.trim()
      const isUrl = input.startsWith('http')
      const isRepo = /^[\w.-]+\/[\w.-]+$/.test(input)
      let res
      if (isUrl) res = await api.post('/api/scans', { type: 'api', repo: input })
      else if (isRepo) res = await api.post('/api/scans', { type: 'code', repo: input, ref: 'main' })
      else res = await api.post('/api/scans', { type: 'text', repo: 'pasted', ref: input })
      setScanResult(res)
    } catch (err: any) {
      setScanResult({ error: err.message })
    } finally {
      setScanning(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh] gap-2 text-muted">
      <Spinner /> Loading...
    </div>
  )

  return (
    <div className="max-w-[1100px] animate-fade-in flex flex-col gap-5">
      <PageHeader
        subtitle="SECURITY OVERVIEW"
        title="Dashboard"
        action={
          <button
            onClick={() => router.push('/dashboard/scan/code')}
            className="bg-red border-none rounded-sm text-white font-mono text-[11px] px-4 py-2 flex items-center gap-1.5 tracking-wider"
          >
            Run scan
          </button>
        }
      />

      {/* Score + Metrics */}
      <div className="grid grid-cols-[200px_1fr] gap-3.5">
        {/* Score card */}
        <div className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-3">
          <div className="text-[10px] text-muted tracking-widest">SECURITY SCORE</div>
          <div className={`font-display text-[52px] font-extrabold leading-none ${scoreColor}`}>{grade}</div>
          <ScoreBar score={score} />
          <div className={`flex items-center gap-1.5 text-[11px] ${scoreColor}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${score < 40 ? 'bg-red' : score < 70 ? 'bg-amber' : 'bg-green'} animate-pulse`} />
            {score < 40 ? 'Critical risk' : score < 70 ? 'Needs attention' : 'Good posture'}
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-5 gap-2.5">
          <MetricCard label="Critical" value={summary.critical} sub="Fix immediately" color={summary.critical > 0 ? 'text-red' : 'text-muted'} />
          <MetricCard label="High" value={summary.high} sub="Fix soon" color={summary.high > 0 ? 'text-amber' : 'text-muted'} />
          <MetricCard label="Medium" value={summary.medium} sub="Review" color={summary.medium > 0 ? 'text-blue' : 'text-muted'} />
          <MetricCard label="Low" value={summary.low} sub="Low priority" color="text-muted" />
          <MetricCard label="Scans" value={scans.length} sub="Total scans" color="text-white" />
        </div>
      </div>

      {/* Quick scan */}
      <Panel title="Quick scan">
        <form onSubmit={handleQuickScan} className="p-4 flex gap-2.5">
          <input
            value={scanInput}
            onChange={e => setScanInput(e.target.value)}
            placeholder="owner/repo, https://api.example.com, or paste code..."
            className="flex-1 bg-bg border border-border rounded-sm px-3 py-2 text-white font-mono text-xs outline-none focus:border-red transition-colors"
          />
          <button
            type="submit"
            disabled={scanning || !scanInput.trim()}
            className="bg-red rounded-sm px-4 py-2 text-white font-mono text-xs disabled:opacity-50 flex items-center gap-2"
          >
            {scanning && <Spinner size={12} />}
            {scanning ? 'Scanning...' : 'Scan'}
          </button>
        </form>
        {scanResult?.error && (
          <div className="mx-4 mb-4 p-2.5 bg-red/10 border border-red/20 rounded-sm text-red text-xs">
            {scanResult.error}
          </div>
        )}
      </Panel>

      {/* Recent vulns */}
      <Panel title="Recent vulnerabilities" action={vulns.length > 0 ? <button onClick={() => router.push('/dashboard/vulns')} className="text-red hover:underline text-[11px]">View all</button> : undefined}>
        {vulns.length === 0 ? (
          <Empty message="No vulnerabilities found. Run a scan to get started." />
        ) : (
          vulns.map((v: any) => (
            <div key={v.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border text-[11px]">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                v.severity === 'critical' ? 'bg-red' : v.severity === 'high' ? 'bg-amber' : v.severity === 'medium' ? 'bg-blue' : 'bg-muted'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium truncate">{v.title}</div>
                <div className="text-muted text-[10px] font-mono mt-0.5 truncate">{v.location}</div>
              </div>
              <Badge variant={v.severity}>{v.severity}</Badge>
            </div>
          ))
        )}
      </Panel>
    </div>
  )
}
