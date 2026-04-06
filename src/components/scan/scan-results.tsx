'use client'

import { Badge } from '@/components/ui/badge'
import { Panel } from '@/components/ui/panel'

const SEV_DOT: Record<string, string> = {
  critical: 'bg-red',
  high: 'bg-amber',
  medium: 'bg-blue',
  low: 'bg-muted',
}

const SEV_VARIANT: Record<string, 'critical' | 'high' | 'medium' | 'low' | 'info'> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
}

export function ScanResults({ result }: { result: any }) {
  if (!result) return null

  const findings: any[] = result.findings ?? result.data?.findings ?? []
  const filesScanned: number = result.files_scanned ?? result.data?.files_scanned ?? 0
  const critical = findings.filter(f => f.severity === 'critical').length
  const high = findings.filter(f => f.severity === 'high').length

  return (
    <Panel title="Scan results" className="mt-4 animate-fade-in">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-px bg-border">
        {[
          { label: 'Files scanned', value: filesScanned },
          { label: 'Total findings', value: findings.length },
          { label: 'Critical', value: critical },
          { label: 'High', value: high },
        ].map(stat => (
          <div key={stat.label} className="bg-surface px-4 py-3">
            <div className="font-display text-[22px] font-extrabold text-white">
              {stat.value}
            </div>
            <div className="text-[10px] text-muted uppercase tracking-widest mt-0.5">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Findings list */}
      {findings.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-6 text-green text-[12px]">
          <span className="inline-block w-2 h-2 rounded-full bg-green" />
          Clean scan — no findings detected.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {findings.map((f: any, i: number) => {
            const sev = (f.severity ?? 'low').toLowerCase()
            return (
              <div key={f.id ?? i} className="flex items-start gap-3 px-4 py-3">
                <span
                  className={`mt-1 flex-shrink-0 w-2 h-2 rounded-full ${SEV_DOT[sev] ?? 'bg-muted'}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] text-white font-medium truncate">
                      {f.title ?? f.message ?? f.check_id ?? 'Finding'}
                    </span>
                    <Badge variant={SEV_VARIANT[sev] ?? 'info'}>{sev}</Badge>
                    {f.category && (
                      <Badge variant="info">{f.category}</Badge>
                    )}
                  </div>
                  {(f.location ?? f.file ?? f.path) && (
                    <div className="text-[10px] text-muted mt-0.5 font-mono truncate">
                      {f.location ?? f.file ?? f.path}
                      {f.line != null ? `:${f.line}` : ''}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}
