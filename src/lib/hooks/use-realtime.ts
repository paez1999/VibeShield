'use client'

import { useEffect, useState, useRef } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase/client'

interface ScanProgress {
  status: string
  progress: { total: number; scanned: number; findings: number }
  score: string | null
  summary: Record<string, number> | null
  error: string | null
}

export function useScanProgress(scanId: string | null): ScanProgress | null {
  const [data, setData] = useState<ScanProgress | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!scanId) return

    const supabase = createSupabaseBrowser()

    // Try Supabase Realtime first
    const channel = supabase
      .channel(`scan:${scanId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'scans',
        filter: `id=eq.${scanId}`,
      }, (payload: any) => {
        const row = payload.new
        setData({
          status: row.status,
          progress: row.progress ?? { total: 0, scanned: 0, findings: 0 },
          score: row.score,
          summary: row.summary,
          error: row.error,
        })
      })
      .subscribe((status: string) => {
        // If Realtime subscription fails, fall back to polling
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          startPolling(scanId, supabase)
        }
      })

    // Also do an initial fetch to get current state
    supabase.from('scans').select('status, progress, score, summary, error')
      .eq('id', scanId).single()
      .then(({ data: row }) => {
        if (row) {
          setData({
            status: row.status,
            progress: row.progress ?? { total: 0, scanned: 0, findings: 0 },
            score: row.score,
            summary: row.summary,
            error: row.error,
          })
        }
      })

    function startPolling(id: string, sb: any) {
      if (pollingRef.current) return // already polling
      pollingRef.current = setInterval(async () => {
        const { data: row } = await sb.from('scans').select('status, progress, score, summary, error')
          .eq('id', id).single()
        if (row) {
          setData({
            status: row.status,
            progress: row.progress ?? { total: 0, scanned: 0, findings: 0 },
            score: row.score,
            summary: row.summary,
            error: row.error,
          })
          // Stop polling when scan is complete or failed
          if (row.status === 'complete' || row.status === 'failed') {
            clearInterval(pollingRef.current!)
            pollingRef.current = null
          }
        }
      }, 3000)
    }

    return () => {
      supabase.removeChannel(channel)
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [scanId])

  return data
}
