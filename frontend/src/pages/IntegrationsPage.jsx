import { useEffect, useState } from 'react'
import { integrations as intApi } from '../lib/api.js'
import { Panel, Badge, RiskBar, Empty, Spinner, Btn } from '../components/ui/index.jsx'

export default function IntegrationsPage() {
  const [intList, setIntList]   = useState([])
  const [secrets, setSecrets]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('integrations') // 'integrations' | 'secrets' | 'scan'

  const reload = () => {
    setLoading(true)
    Promise.all([
      intApi.list().catch(() => ({ data: [] })),
      intApi.openSecrets().catch(() => ({ data: [] })),
    ]).then(([iRes, sRes]) => {
      setIntList(iRes.data || [])
      setSecrets(sRes.data || [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [])

  const handleRemediate = async (id) => {
    await intApi.remediate(id)
    setSecrets((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div style={{ maxWidth: '1100px', animation: 'fadeIn .3s ease' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '2px', marginBottom: '4px' }}>
          MODULE 1
        </div>
        <h1 style={{ fontFamily: 'var(--font-disp)', fontWeight: 800, fontSize: '24px', color: '#fff' }}>
          Integration Auditor
        </h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
        {[
          { key: 'integrations', label: `Integrations (${intList.length})` },
          { key: 'secrets',      label: `Open Secrets (${secrets.length})` },
          { key: 'scan',         label: 'GitHub Scan' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '10px 18px', background: 'transparent', border: 'none',
              color: tab === key ? 'var(--accent)' : 'var(--muted)',
              borderBottom: tab === key ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: '-1px', fontSize: '12px', fontFamily: 'var(--font-mono)',
              letterSpacing: '.5px', cursor: 'pointer', transition: 'all .15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--muted)', padding: '40px 0' }}>
          <Spinner /> Loading...
        </div>
      ) : (
        <>
          {tab === 'integrations' && (
            <IntegrationsTab intList={intList} onRotate={reload} />
          )}
          {tab === 'secrets' && (
            <SecretsTab secrets={secrets} onRemediate={handleRemediate} />
          )}
          {tab === 'scan' && (
            <GitHubScanTab onDone={reload} />
          )}
        </>
      )}
    </div>
  )
}

// ── Integrations tab ──────────────────────────────────────────────────────────
function IntegrationsTab({ intList, onRotate }) {
  if (intList.length === 0) {
    return (
      <Panel>
        <Empty message="No integrations found. Run a GitHub scan to auto-detect integrations." />
      </Panel>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {intList.map((i) => (
        <IntegrationCard key={i.id} integration={i} onRotate={onRotate} />
      ))}
    </div>
  )
}

function IntegrationCard({ integration: i, onRotate }) {
  const [rotating, setRotating] = useState(false)
  const [open, setOpen]         = useState(false)

  const handleRotate = async () => {
    setRotating(true)
    try { await intApi.rotate(i.id); onRotate() }
    catch (e) { alert(e.message) }
    finally { setRotating(false) }
  }

  const borderColor = i.score >= 70 ? 'var(--red)' : i.score >= 40 ? 'var(--amber)' : 'var(--border)'

  return (
    <div style={{
      background: 'var(--surface)', border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius-lg)', overflow: 'hidden',
      transition: 'border-color .2s',
    }}>
      {/* Row */}
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '16px',
          padding: '14px 18px', cursor: 'pointer',
        }}
      >
        <div style={{ minWidth: '110px' }}>
          <div style={{ color: '#fff', fontWeight: 500, fontSize: '13px' }}>{i.type}</div>
          <div style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '2px' }}>
            {(i.scopes || []).length} scope{(i.scopes || []).length !== 1 ? 's' : ''}
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(i.scopes || []).slice(0, 4).map((s) => (
              <span key={s} style={{
                fontSize: '10px', padding: '2px 7px',
                background: 'var(--bg)', border: '1px solid var(--border2)',
                borderRadius: '3px', color: 'var(--muted)',
              }}>{s}</span>
            ))}
            {(i.scopes || []).length > 4 && (
              <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
                +{(i.scopes || []).length - 4}
              </span>
            )}
          </div>
        </div>

        <div style={{ minWidth: '100px' }}>
          <RiskBar score={i.score || 0} />
        </div>

        <Badge variant={i.severity || 'ok'}>{i.severity || 'ok'}</Badge>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Btn onClick={(e) => { e.stopPropagation(); handleRotate() }} disabled={rotating}>
            {rotating ? 'Rotating…' : 'Mark Rotated'}
          </Btn>
          <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 18px', background: 'var(--bg)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px', letterSpacing: '1px' }}>
                RISK FACTORS
              </div>
              {(i.factors || []).length === 0
                ? <div style={{ color: 'var(--muted)', fontSize: '12px' }}>No risk factors detected</div>
                : (i.factors || []).map((f, idx) => (
                  <div key={idx} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '5px 0', borderBottom: '1px solid var(--border)',
                    fontSize: '12px',
                  }}>
                    <span style={{ color: 'var(--text)' }}>{f.label}</span>
                    <span style={{ color: 'var(--red)', fontWeight: 500 }}>+{f.penalty}</span>
                  </div>
                ))
              }
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px', letterSpacing: '1px' }}>
                UNUSED SCOPES
              </div>
              {(i.unusedScopes || []).length === 0
                ? <div style={{ color: 'var(--accent)', fontSize: '12px' }}>✓ All scopes in use</div>
                : (i.unusedScopes || []).map((s) => (
                  <div key={s} style={{
                    fontSize: '12px', color: 'var(--amber)',
                    padding: '3px 0', borderBottom: '1px solid var(--border)',
                  }}>⚠ {s}</div>
                ))
              }
              <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--muted)' }}>
                Last rotated: {i.last_rotated
                  ? new Date(i.last_rotated).toLocaleDateString()
                  : <span style={{ color: 'var(--red)' }}>Never</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Secrets tab ───────────────────────────────────────────────────────────────
function SecretsTab({ secrets, onRemediate }) {
  const [remediating, setRemediating] = useState(null)

  const handle = async (id) => {
    setRemediating(id)
    try { await onRemediate(id) }
    finally { setRemediating(null) }
  }

  if (secrets.length === 0) {
    return (
      <Panel>
        <div style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{ color: 'var(--accent)', fontSize: '24px', marginBottom: '8px' }}>✓</div>
          <div style={{ color: 'var(--text)', fontSize: '14px', fontFamily: 'var(--font-disp)' }}>
            No open secrets
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '4px' }}>
            All detected secrets have been remediated
          </div>
        </div>
      </Panel>
    )
  }

  return (
    <Panel title={`${secrets.length} unresolved secret(s)`}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr>
            {['Type', 'Location', 'Severity', 'Found', 'Action'].map((h) => (
              <th key={h} style={{
                textAlign: 'left', color: 'var(--muted)', fontWeight: 400,
                fontSize: '11px', padding: '4px 10px 10px',
                borderBottom: '1px solid var(--border)',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {secrets.map((s) => (
            <tr key={s.id}>
              <td style={{ padding: '10px', borderBottom: '1px solid var(--border)', color: '#fff', fontWeight: 500 }}>
                {s.secret_type}
              </td>
              <td style={{ padding: '10px', borderBottom: '1px solid var(--border)', color: 'var(--muted)', maxWidth: '260px' }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px' }}>
                  {s.location}
                </div>
              </td>
              <td style={{ padding: '10px', borderBottom: '1px solid var(--border)' }}>
                <Badge variant={s.severity}>{s.severity}</Badge>
              </td>
              <td style={{ padding: '10px', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: '11px' }}>
                {new Date(s.discovered_at).toLocaleDateString()}
              </td>
              <td style={{ padding: '10px', borderBottom: '1px solid var(--border)' }}>
                <Btn onClick={() => handle(s.id)} disabled={remediating === s.id}>
                  {remediating === s.id ? 'Saving…' : 'Mark Resolved'}
                </Btn>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}

// ── GitHub scan tab ───────────────────────────────────────────────────────────
function GitHubScanTab({ onDone }) {
  const [repo, setRepo]       = useState('')
  const [ref, setRef]         = useState('main')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState('')

  const scan = async (e) => {
    e.preventDefault()
    if (!repo.trim()) return
    setLoading(true)
    setResult(null)
    setError('')
    try {
      const res = await intApi.scanGitHub(repo.trim(), ref.trim() || 'main')
      setResult(res)
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Panel title="Scan GitHub Repository">
        <form onSubmit={scan}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '10px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', letterSpacing: '1px' }}>
                REPOSITORY (owner/repo)
              </label>
              <input
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="myorg/myapp"
                required
                style={{
                  width: '100%', background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  padding: '9px 12px', color: 'var(--text)',
                  fontFamily: 'var(--font-mono)', fontSize: '13px', outline: 'none',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                onBlur={(e)  => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', letterSpacing: '1px' }}>
                BRANCH / REF
              </label>
              <input
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="main"
                style={{
                  width: '110px', background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  padding: '9px 12px', color: 'var(--text)',
                  fontFamily: 'var(--font-mono)', fontSize: '13px', outline: 'none',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                onBlur={(e)  => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !repo.trim()}
              style={{
                background: loading ? 'var(--accent-dim)' : 'var(--accent)',
                border: 'none', borderRadius: 'var(--radius)',
                padding: '9px 20px', color: '#0a0c0f',
                fontFamily: 'var(--font-disp)', fontWeight: 700, fontSize: '13px',
                cursor: (loading || !repo.trim()) ? 'not-allowed' : 'pointer',
                opacity: (loading || !repo.trim()) ? .7 : 1,
                display: 'flex', alignItems: 'center', gap: '8px',
              }}
            >
              {loading && <Spinner size={12} />}
              {loading ? 'Scanning…' : 'Scan →'}
            </button>
          </div>
        </form>

        {error && (
          <div style={{
            marginTop: '14px', padding: '10px 14px',
            background: 'rgba(255,71,87,.08)', border: '1px solid rgba(255,71,87,.2)',
            borderRadius: 'var(--radius)', color: 'var(--red)', fontSize: '12px',
          }}>
            {error}
          </div>
        )}
      </Panel>

      {result && <ScanResults result={result} />}
    </div>
  )
}

function ScanResults({ result }) {
  return (
    <Panel title={`Scan results — ${result.message}`}>
      {/* Summary row */}
      <div style={{ display: 'flex', gap: '24px', marginBottom: '16px', padding: '12px 14px', background: 'var(--bg)', borderRadius: 'var(--radius)' }}>
        <Stat label="Files scanned" value={result.scannedFiles || 0} />
        <Stat label="Total findings" value={result.findings} color={result.findings > 0 ? 'var(--amber)' : 'var(--accent)'} />
        <Stat label="Critical"       value={result.critical}  color={result.critical > 0 ? 'var(--red)' : 'var(--muted)'} />
        <Stat label="High"           value={result.high}      color={result.high > 0 ? 'var(--amber)' : 'var(--muted)'} />
      </div>

      {result.findings === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--accent)', fontSize: '13px' }}>
          ✓ Clean scan — no secrets detected
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr>
              {['Type','Location','Severity'].map((h) => (
                <th key={h} style={{
                  textAlign: 'left', color: 'var(--muted)', fontWeight: 400,
                  fontSize: '11px', padding: '4px 10px 10px',
                  borderBottom: '1px solid var(--border)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(result.details || []).map((d, i) => (
              <tr key={i}>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', color: '#fff' }}>{d.type}</td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: '11px', maxWidth: '320px' }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.location}</div>
                </td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                  <Badge variant={d.severity}>{d.severity}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}

function Stat({ label, value, color = 'var(--text)' }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-disp)', fontSize: '22px', fontWeight: 800, color }}>{value}</div>
    </div>
  )
}
