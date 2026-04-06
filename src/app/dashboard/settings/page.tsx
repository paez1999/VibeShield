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
  const [slackUrl, setSlackUrl] = useState('')
  const [ghToken, setGhToken] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    api.get('/api/org').then((data: any) => {
      setOrg(data)
      setSlackUrl(data?.slack_webhook_url || '')
      setGhToken(data?.github_token ? '••••••••' : '')
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const saveField = async (field: string, value: string) => {
    setSaving(field)
    try {
      await api.patch('/api/org', { [field]: value })
      const updated = await api.get('/api/org')
      setOrg(updated)
    } catch {} finally {
      setSaving(null)
    }
  }

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

      <Panel title="GitHub integration">
        <div className="p-4 space-y-3">
          <div>
            <div className="text-[10px] text-muted tracking-widest uppercase mb-1">Personal Access Token</div>
            <div className="text-[10px] text-muted mb-2">Required for scanning private repos and higher rate limits</div>
            <div className="flex gap-2">
              <input
                type="password"
                value={ghToken}
                onChange={e => setGhToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx"
                className="flex-1 bg-bg border border-border rounded px-3 py-1.5 text-xs text-text font-mono placeholder:text-muted/50 focus:border-red focus:outline-none"
              />
              <button
                onClick={() => saveField('github_token', ghToken)}
                disabled={saving === 'github_token'}
                className="px-3 py-1.5 bg-red/10 text-red text-[11px] font-medium rounded hover:bg-red/20 transition-colors disabled:opacity-50"
              >
                {saving === 'github_token' ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Slack notifications">
        <div className="p-4 space-y-3">
          <div>
            <div className="text-[10px] text-muted tracking-widest uppercase mb-1">Webhook URL</div>
            <div className="text-[10px] text-muted mb-2">Receive alerts when critical or high severity findings are detected</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={slackUrl}
                onChange={e => setSlackUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="flex-1 bg-bg border border-border rounded px-3 py-1.5 text-xs text-text font-mono placeholder:text-muted/50 focus:border-red focus:outline-none"
              />
              <button
                onClick={() => saveField('slack_webhook_url', slackUrl)}
                disabled={saving === 'slack_webhook_url'}
                className="px-3 py-1.5 bg-red/10 text-red text-[11px] font-medium rounded hover:bg-red/20 transition-colors disabled:opacity-50"
              >
                {saving === 'slack_webhook_url' ? 'Saving...' : 'Save'}
              </button>
            </div>
            {org?.slack_webhook_url && (
              <div className="flex items-center gap-1.5 mt-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-[10px] text-green-400">Connected</span>
              </div>
            )}
          </div>
        </div>
      </Panel>
    </div>
  )
}
