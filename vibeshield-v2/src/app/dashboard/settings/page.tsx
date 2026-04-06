'use client'

import { useEffect, useState } from 'react'
import { useApi } from '@/lib/hooks/use-api'
import { useAuth } from '@/lib/hooks/use-auth'
import { PageHeader } from '@/components/layout/page-header'
import { Panel } from '@/components/ui/panel'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'

export default function SettingsPage() {
  const api = useApi()
  const { user } = useAuth()
  const [org, setOrg] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/org').then(setOrg).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh] gap-2 text-muted">
      <Spinner /> Loading...
    </div>
  )

  return (
    <div className="max-w-[700px] animate-fade-in flex flex-col gap-5">
      <PageHeader subtitle="CONFIG" title="Settings" />

      <Panel title="Organization">
        <div className="p-4 space-y-3">
          <div>
            <div className="text-[10px] text-muted tracking-widest uppercase mb-1">Org name</div>
            <div className="text-white text-sm font-medium">{org?.name || 'My Org'}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted tracking-widest uppercase mb-1">Plan</div>
            <Badge variant={org?.plan === 'pro' ? 'ok' : 'info'}>{org?.plan || 'free'}</Badge>
          </div>
          <div>
            <div className="text-[10px] text-muted tracking-widest uppercase mb-1">Account</div>
            <div className="text-text text-xs font-mono">{user?.email || '—'}</div>
          </div>
        </div>
      </Panel>

      <Panel title="Connected services">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white text-[11px] font-medium">GitHub</div>
              <div className="text-muted text-[10px]">Used for repository scanning</div>
            </div>
            <Badge variant="ok">Connected</Badge>
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white text-[11px] font-medium">Slack notifications</div>
              <div className="text-muted text-[10px]">Alerts on critical/high findings</div>
            </div>
            <Badge variant="low">Not configured</Badge>
          </div>
        </div>
      </Panel>
    </div>
  )
}
