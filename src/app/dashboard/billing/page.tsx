'use client'

import { useEffect, useState } from 'react'
import { useApi } from '@/lib/hooks/use-api'
import { PageHeader } from '@/components/layout/page-header'
import { Panel } from '@/components/ui/panel'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'

export default function BillingPage() {
  const api = useApi()
  const [billing, setBilling] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)

  useEffect(() => {
    api.get('/api/billing').then(setBilling).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleUpgrade = async () => {
    setUpgrading(true)
    try {
      const { url } = await api.post('/api/billing')
      window.location.href = url
    } catch { setUpgrading(false) }
  }

  const handlePortal = async () => {
    const { url } = await api.post('/api/billing/portal')
    window.location.href = url
  }

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh] gap-2 text-muted">
      <Spinner /> Loading...
    </div>
  )

  const plan = billing?.plan || 'free'
  const trialRemaining = billing?.trialScansRemaining ?? 0

  return (
    <div className="max-w-[700px] animate-fade-in flex flex-col gap-5">
      <PageHeader subtitle="BILLING" title="Plan & billing" />

      {/* Current plan */}
      <Panel title="Current plan">
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="font-display font-extrabold text-3xl text-white capitalize">{plan}</span>
            <Badge variant={plan === 'pro' ? 'ok' : plan === 'trial' ? 'medium' : 'low'}>{plan}</Badge>
          </div>

          {plan === 'trial' && (
            <div className="text-xs text-muted mb-4">
              <span className="text-white font-medium">{trialRemaining}</span> scans remaining in your free trial
            </div>
          )}

          {(plan === 'free' || plan === 'trial') && (
            <button onClick={handleUpgrade} disabled={upgrading}
              className="bg-red text-white font-display font-bold text-sm px-6 py-2.5 rounded-sm hover:bg-red-dim transition-colors disabled:opacity-50 flex items-center gap-2">
              {upgrading && <Spinner size={14} />}
              Upgrade to Pro — $19/mo
            </button>
          )}

          {plan === 'pro' && (
            <button onClick={handlePortal}
              className="border border-border2 text-muted text-xs px-4 py-2 rounded-sm hover:border-white hover:text-white transition-all">
              Manage subscription
            </button>
          )}
        </div>
      </Panel>

      {/* Plan comparison */}
      <Panel title="Compare plans">
        <div className="divide-y divide-border">
          {[
            { feature: 'Security score (A-F)', free: true, pro: true },
            { feature: 'Vulnerability count', free: true, pro: true },
            { feature: 'Detailed findings', free: false, pro: true },
            { feature: 'AI risk analysis', free: false, pro: true },
            { feature: 'AI fix prompts', free: false, pro: true },
            { feature: 'Unlimited scans', free: false, pro: true },
            { feature: 'Scan history', free: false, pro: true },
            { feature: 'Slack notifications', free: false, pro: true },
          ].map(row => (
            <div key={row.feature} className="flex items-center px-4 py-2.5 text-[11px]">
              <span className="flex-1 text-text">{row.feature}</span>
              <span className="w-20 text-center">{row.free ? <span className="text-green">✓</span> : <span className="text-muted">—</span>}</span>
              <span className="w-20 text-center">{row.pro ? <span className="text-green">✓</span> : <span className="text-muted">—</span>}</span>
            </div>
          ))}
          <div className="flex items-center px-4 py-2.5 text-[10px] text-muted">
            <span className="flex-1" />
            <span className="w-20 text-center">Free</span>
            <span className="w-20 text-center text-white">Pro $19/mo</span>
          </div>
        </div>
      </Panel>
    </div>
  )
}
