'use client'

import { useState } from 'react'
import { useApi } from '@/lib/hooks/use-api'
import { Panel } from '@/components/ui/panel'
import { Spinner } from '@/components/ui/spinner'

export function QuickTextScan() {
  const api = useApi()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [count, setCount] = useState<number | null>(null)

  const handleScan = async () => {
    if (!text.trim()) return
    setLoading(true)
    setError('')
    setCount(null)
    try {
      // For text scans: repo is a placeholder filename, ref carries the content
      const res = await api.post('/api/scans', {
        type: 'text',
        repo: 'pasted',
        ref: text.trim(),
      })
      const findings: any[] =
        res.findings ?? res.data?.findings ?? []
      setCount(findings.length)
    } catch (err: any) {
      setError(err.message ?? 'Scan failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Panel title="Quick text scan" className="mb-4">
      <div className="p-4 flex flex-col gap-3">
        <div className="text-[11px] text-muted">
          Paste code or configuration to scan for secrets and misconfigurations.
        </div>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste code, config, or any text…"
          rows={6}
          className="bg-bg border border-border rounded-sm px-3 py-2 text-[11px] text-white placeholder-muted/50 font-mono resize-y focus:outline-none focus:border-border2 transition-colors w-full"
        />

        {error && (
          <div className="bg-red/10 border border-red/25 rounded-sm px-3 py-2 text-[11px] text-red">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleScan}
            disabled={loading || !text.trim()}
            className="bg-red/90 hover:bg-red text-white text-[11px] font-medium px-4 py-1.5 rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && <Spinner size={12} />}
            Scan
          </button>

          {count !== null && !loading && (
            <span className={`text-[11px] ${count === 0 ? 'text-green' : 'text-amber'}`}>
              {count === 0
                ? 'No findings — clean.'
                : `${count} finding${count !== 1 ? 's' : ''} detected.`}
            </span>
          )}
        </div>
      </div>
    </Panel>
  )
}
