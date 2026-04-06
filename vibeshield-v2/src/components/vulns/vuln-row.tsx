'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Btn } from '@/components/ui/btn'
import { FixPanel } from './fix-panel'

const SEV_DOT: Record<string, string> = {
  critical: 'bg-red',
  high: 'bg-amber',
  medium: 'bg-blue',
  low: 'bg-muted',
}

export function VulnRow({ vuln, onResolve, onIgnore }: {
  vuln: any
  onResolve: (id: string) => void
  onIgnore: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-border">
      {/* Row header */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-surface2/50 transition-colors"
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${SEV_DOT[vuln.severity] ?? 'bg-muted'}`} />
        <div className="flex-1 min-w-0">
          <div className="text-white text-[11px] font-medium truncate">{vuln.title}</div>
          <div className="text-muted text-[10px] font-mono mt-0.5 truncate">{vuln.location}</div>
        </div>
        <Badge variant={vuln.category?.includes('Secret') ? 'high' : 'info'}>
          {vuln.category}
        </Badge>
        <Badge variant={vuln.severity}>{vuln.severity}</Badge>
        <span className="text-muted text-[10px]">{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 animate-fade-in">
          <div className="text-xs text-text mb-3 leading-relaxed">{vuln.description}</div>

          {vuln.status === 'open' && (
            <div className="flex gap-2 mb-3">
              <Btn variant="primary" small onClick={() => onResolve(vuln.id)}>Resolve</Btn>
              <Btn variant="danger" small onClick={() => onIgnore(vuln.id)}>Ignore</Btn>
            </div>
          )}

          <FixPanel vuln={vuln} />
        </div>
      )}
    </div>
  )
}
