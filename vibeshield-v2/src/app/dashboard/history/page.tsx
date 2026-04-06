'use client'

import { useEffect, useState } from 'react'
import { useApi } from '@/lib/hooks/use-api'
import { PageHeader } from '@/components/layout/page-header'
import { Panel } from '@/components/ui/panel'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Empty } from '@/components/ui/empty'

const TYPE_VARIANT: Record<string, 'info' | 'high' | 'critical' | 'low'> = {
  code: 'info',
  api: 'high',
  deps: 'critical',
  text: 'low',
}

const SCORE_VARIANT: Record<string, 'ok' | 'low' | 'medium' | 'high' | 'critical'> = {
  A: 'ok',
  B: 'low',
  C: 'medium',
  D: 'high',
  F: 'critical',
}

function formatTime(ts: string): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toISOString().slice(0, 10)
}

export default function HistoryPage() {
  const api = useApi()
  const [scans, setScans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/api/scans?limit=50')
      .then(r => setScans(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="max-w-[900px] animate-fade-in flex flex-col gap-5">
      <PageHeader subtitle="SCANNER" title="Scan history" />

      <Panel title="Recent scans">
        {loading ? (
          <div className="flex items-center justify-center py-10 gap-2 text-muted text-[12px]">
            <Spinner /> Loading…
          </div>
        ) : scans.length === 0 ? (
          <Empty message="No scans yet. Run a scan to see results here." />
        ) : (
          <div className="divide-y divide-border">
            {scans.map((scan: any) => {
              const type: string = scan.type ?? 'code'
              const status: string = (scan.status ?? 'complete').toLowerCase()
              const score: string | undefined = scan.score
              const findingsCount: number =
                scan.progress?.findings ?? 0
              const target: string =
                scan.repo ?? scan.target ?? scan.url ?? '—'
              const ts: string = scan.created_at ?? scan.started_at ?? ''

              return (
                <div
                  key={scan.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface/50 transition-colors"
                >
                  {/* Type badge */}
                  <Badge variant={TYPE_VARIANT[type] ?? 'info'}>
                    {type}
                  </Badge>

                  {/* Target */}
                  <span className="flex-1 text-[12px] text-white font-mono truncate min-w-0">
                    {target}
                  </span>

                  {/* Findings count */}
                  <span className="text-[11px] text-muted whitespace-nowrap">
                    {findingsCount} {findingsCount === 1 ? 'finding' : 'findings'}
                  </span>

                  {/* Status indicator */}
                  <span className="flex items-center gap-1.5 text-[10px] whitespace-nowrap">
                    {['queued', 'fetching', 'scanning', 'analyzing'].includes(status) ? (
                      <>
                        <Spinner size={10} />
                        <span className="text-muted">Running</span>
                      </>
                    ) : status === 'failed' ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-red flex-shrink-0" />
                        <span className="text-red">Failed</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-green flex-shrink-0" />
                        <span className="text-green">Complete</span>
                      </>
                    )}
                  </span>

                  {/* Score badge */}
                  {score && (
                    <Badge variant={SCORE_VARIANT[score] ?? 'info'}>
                      {score}
                    </Badge>
                  )}

                  {/* Timestamp */}
                  {ts && (
                    <span className="text-[10px] text-muted whitespace-nowrap">
                      {formatTime(ts)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </div>
  )
}
