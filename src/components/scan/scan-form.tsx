'use client'

import { useState } from 'react'
import { useApi } from '@/lib/hooks/use-api'
import { Spinner } from '@/components/ui/spinner'
import { Panel } from '@/components/ui/panel'

const CONFIG = {
  code: {
    title: 'Code scan',
    sub: 'Scan a GitHub repository for vulnerabilities',
    label: 'GitHub repository',
    placeholder: 'owner/repo',
    hasRef: true,
    btnLabel: 'Scan repository',
  },
  api: {
    title: 'API scan',
    sub: 'Probe endpoints for security misconfigurations',
    label: 'API base URL',
    placeholder: 'https://api.yourapp.com',
    hasRef: false,
    btnLabel: 'Scan API',
  },
  deps: {
    title: 'Dependency scan',
    sub: 'Check npm packages for known CVEs',
    label: 'GitHub repository',
    placeholder: 'owner/repo',
    hasRef: false,
    btnLabel: 'Scan dependencies',
  },
} as const

export function ScanForm({
  mode,
  onResult,
}: {
  mode: 'code' | 'api' | 'deps'
  onResult: (r: any) => void
}) {
  const cfg = CONFIG[mode]
  const api = useApi()
  const [input, setInput] = useState('')
  const [ref, setRef] = useState('main')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    setLoading(true)
    setError('')
    try {
      const body: Record<string, string> = { type: mode, repo: input.trim() }
      if (mode === 'code') body.ref = ref.trim() || 'main'
      const res = await api.post('/api/scans', body)
      onResult(res)
    } catch (err: any) {
      setError(err.message ?? 'Scan failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Panel className="mb-4">
      <div className="p-4">
        <div className="mb-4">
          <div className="text-[11px] text-muted mb-0.5">{cfg.sub}</div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Primary input */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted uppercase tracking-wider">
              {cfg.label}
            </label>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={cfg.placeholder}
              className="bg-bg border border-border rounded-sm px-3 py-2 text-[12px] text-white placeholder-muted/50 focus:outline-none focus:border-border2 transition-colors"
            />
          </div>

          {/* Branch input (code mode only) */}
          {cfg.hasRef && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">
                Branch
              </label>
              <input
                type="text"
                value={ref}
                onChange={e => setRef(e.target.value)}
                placeholder="main"
                className="bg-bg border border-border rounded-sm px-3 py-2 text-[12px] text-white placeholder-muted/50 focus:outline-none focus:border-border2 transition-colors"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red/10 border border-red/25 rounded-sm px-3 py-2 text-[11px] text-red">
              {error}
            </div>
          )}

          {/* Submit */}
          <div>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-red/90 hover:bg-red text-white text-[11px] font-medium px-4 py-1.5 rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && <Spinner size={12} />}
              {cfg.btnLabel}
            </button>
          </div>
        </form>
      </div>
    </Panel>
  )
}
