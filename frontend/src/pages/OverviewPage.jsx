import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { integrations as intApi } from '../lib/api.js'
import { MetricCard, Panel, Badge, RiskBar, Empty, Spinner, Btn } from '../components/ui/index.jsx'

export default function OverviewPage() {
  const [secrets, setSecrets]   = useState([])
  const [intList, setIntList]   = useState([])
  const [loading, setLoading]   = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      intApi.list().catch(() => ({ data: [] })),
      intApi.openSecrets().catch(() => ({ data: [] })),
    ]).then(([iRes, sRes]) => {
      setIntList(iRes.data || [])
      setSecrets(sRes.data || [])
    }).finally(() => setLoading(false))
  }, [])

  const critical = secrets.filter((s) => s.severity === 'critical').length
  const high     = secrets.filter((s) => s.severity === 'high').length
  const atRisk   = intList.filter((i) => i.score >= 40).length

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '12px', color: 'var(--muted)' }}>
        <Spinner /> Loading...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1100px', animation: 'fadeIn .3s ease' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '2px', marginBottom: '4px' }}>
          SECURITY OVERVIEW
        </div>
        <h1 style={{ fontFamily: 'var(--font-disp)', fontWeight: 800, fontSize: '24px', color: '#fff' }}>
          Dashboard
        </h1>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridColumns: 'repeat(3,1fr)', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '20px' }}>
        <MetricCard
          label="Integrations at risk"
          value={atRisk}
          sub={`${intList.length} total integrations`}
          accentColor={atRisk > 0 ? 'var(--red)' : 'var(--accent)'}
        />
        <MetricCard
          label="Open secrets"
          value={secrets.length}
          sub={`${critical} critical · ${high} high`}
          accentColor={secrets.length > 0 ? 'var(--amber)' : 'var(--accent)'}
        />
        <MetricCard
          label="Incidents (7d)"
          value="—"
          sub="Moderation module coming soon"
          accentColor="var(--muted)"
        />
      </div>

      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

        {/* Integrations risk table */}
        <Panel
          title="Integrations — Risk Score"
          action={
            <Btn onClick={() => navigate('/dashboard/integrations')}>
              View all →
            </Btn>
          }
        >
          {intList.length === 0 ? (
            <Empty message="No integrations yet. Scan a GitHub repo to get started." />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  {['Service','Scopes','Score','Status'].map((h) => (
                    <th key={h} style={{
                      textAlign: 'left', color: 'var(--muted)', fontWeight: 400,
                      fontSize: '11px', padding: '4px 8px 10px',
                      borderBottom: '1px solid var(--border)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {intList.slice(0, 5).map((i) => (
                  <tr key={i.id} style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/dashboard/integrations/${i.type}`)}>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--border)', color: '#fff', fontWeight: 500 }}>
                      {i.type}
                    </td>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                      {(i.scopes || []).slice(0, 2).join(', ') || '—'}
                    </td>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--border)', minWidth: '80px' }}>
                      <RiskBar score={i.score || 0} />
                    </td>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
                      <Badge variant={i.severity || 'ok'}>{i.severity || 'ok'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        {/* Open secrets */}
        <Panel
          title="Open Secrets"
          action={
            <Btn onClick={() => navigate('/dashboard/integrations')}>
              Manage →
            </Btn>
          }
        >
          {secrets.length === 0 ? (
            <Empty message="No exposed secrets detected. Run a scan to check." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {secrets.slice(0, 6).map((s) => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <Badge variant={s.severity}>{s.severity}</Badge>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#fff', fontSize: '12px' }}>{s.secret_type}</div>
                    <div style={{ color: 'var(--muted)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.location}
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', flexShrink: 0 }}>
                    {new Date(s.discovered_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
              {secrets.length > 6 && (
                <div style={{ padding: '8px 0', color: 'var(--muted)', fontSize: '11px', textAlign: 'center' }}>
                  +{secrets.length - 6} more
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>

      {/* Quick scan panel */}
      <Panel title="Quick Scan — Paste text or config">
        <QuickScan onDone={() => {
          intApi.openSecrets().then((r) => setSecrets(r.data || []))
        }} />
      </Panel>
    </div>
  )
}

function QuickScan({ onDone }) {
  const [text, setText]       = useState('')
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)

  const scan = async () => {
    if (!text.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await intApi.scanText(text, 'quick-scan')
      setResult(res)
      if (res.findings > 0) onDone()
    } catch (e) {
      setResult({ error: e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste .env file, config, Terraform, source code… VibeShield will scan for exposed secrets."
        style={{
          width: '100%', height: '120px',
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '12px',
          color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: '12px',
          outline: 'none', resize: 'vertical',
        }}
        onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
        onBlur={(e)  => e.target.style.borderColor = 'var(--border)'}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
        <button
          onClick={scan}
          disabled={loading || !text.trim()}
          style={{
            background: 'var(--accent)', border: 'none',
            borderRadius: 'var(--radius)', padding: '8px 20px',
            color: '#0a0c0f', fontFamily: 'var(--font-disp)',
            fontWeight: 700, fontSize: '13px',
            opacity: (loading || !text.trim()) ? .5 : 1,
            cursor: (loading || !text.trim()) ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Scanning…' : 'Scan →'}
        </button>
        {result && !result.error && (
          <span style={{ fontSize: '12px', color: result.findings > 0 ? 'var(--red)' : 'var(--accent)' }}>
            {result.findings > 0
              ? `⚠ ${result.findings} secret(s) found and saved`
              : '✓ Clean — no secrets detected'}
          </span>
        )}
        {result?.error && (
          <span style={{ fontSize: '12px', color: 'var(--red)' }}>{result.error}</span>
        )}
      </div>
    </div>
  )
}
