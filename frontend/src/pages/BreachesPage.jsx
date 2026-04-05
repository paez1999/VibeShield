import { useEffect, useState } from 'react'
import { credentials as credApi } from '../lib/api.js'
import { Panel, Badge, Empty, Spinner, Btn } from '../components/ui/index.jsx'

export default function BreachesPage() {
  const [tab, setTab] = useState('check')  // 'check' | 'findings' | 'stuffing' | 'users'

  const [findings,  setFindings]  = useState([])
  const [alerts,    setAlerts]    = useState([])
  const [users,     setUsers]     = useState([])
  const [loading,   setLoading]   = useState(true)

  const reload = () => {
    setLoading(true)
    Promise.all([
      credApi.breachFindings().catch(() => ({ data: [] })),
      credApi.stuffingAlerts().catch(() => ({ data: [] })),
      credApi.users().catch(() => ({ data: [] })),
    ]).then(([fRes, aRes, uRes]) => {
      setFindings(fRes.data || [])
      setAlerts(aRes.data || [])
      setUsers(uRes.data || [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [])

  const tabs = [
    { key: 'check',    label: 'Breach Lookup' },
    { key: 'findings', label: `Findings (${findings.length})` },
    { key: 'stuffing', label: `Stuffing Alerts (${alerts.length})` },
    { key: 'users',    label: `Users (${users.length})` },
  ]

  return (
    <div style={{ maxWidth: '1100px', animation: 'fadeIn .3s ease' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '2px', marginBottom: '4px' }}>
          MODULE 2
        </div>
        <h1 style={{ fontFamily: 'var(--font-disp)', fontWeight: 800, fontSize: '24px', color: '#fff' }}>
          Credential Monitor
        </h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
        {tabs.map(({ key, label }) => (
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
          {tab === 'check'    && <BreachCheckTab onDone={reload} />}
          {tab === 'findings' && <FindingsTab findings={findings} onRemediate={(id) => {
            setFindings((prev) => prev.filter((f) => f.id !== id))
          }} />}
          {tab === 'stuffing' && <StuffingTab alerts={alerts} />}
          {tab === 'users'    && <UsersTab users={users} onReset={reload} />}
        </>
      )}
    </div>
  )
}

// ── Breach Check tab ──────────────────────────────────────────────────────────
function BreachCheckTab({ onDone }) {
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error,   setError]   = useState('')

  const parseEmails = (text) =>
    text.split(/[\n,;]+/).map((e) => e.trim()).filter((e) => e.includes('@'))

  const check = async (e) => {
    e.preventDefault()
    const emails = parseEmails(input)
    if (emails.length === 0) return
    if (emails.length > 20) { setError('Max 20 emails per query (HIBP rate limit)'); return }

    setLoading(true)
    setResults(null)
    setError('')
    try {
      const res = await credApi.checkBreaches(emails)
      setResults(res)
      if (res.pwnedCount > 0) onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const emails = parseEmails(input)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Panel title="Query Have I Been Pwned">
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px', lineHeight: 1.6 }}>
          Enter one or more email addresses (newline, comma, or semicolon separated) to check against
          the HIBP database. Requires <code style={{ color: 'var(--accent)' }}>HIBP_API_KEY</code> on the backend.
          Max 20 emails per request due to rate limits.
        </div>
        <form onSubmit={check}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={'alice@example.com\nbob@example.com'}
            style={{
              width: '100%', height: '100px',
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '10px 12px',
              color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: '12px',
              outline: 'none', resize: 'vertical', boxSizing: 'border-box',
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
            onBlur={(e)  => e.target.style.borderColor = 'var(--border)'}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
            <button
              type="submit"
              disabled={loading || emails.length === 0 || emails.length > 20}
              style={{
                background: 'var(--accent)', border: 'none',
                borderRadius: 'var(--radius)', padding: '8px 20px',
                color: '#0a0c0f', fontFamily: 'var(--font-disp)',
                fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
                opacity: (loading || emails.length === 0 || emails.length > 20) ? .5 : 1,
                cursor: (loading || emails.length === 0) ? 'not-allowed' : 'pointer',
              }}
            >
              {loading && <Spinner size={12} />}
              {loading ? `Checking ${emails.length} email${emails.length > 1 ? 's' : ''}…` : 'Check Breaches →'}
            </button>
            {emails.length > 0 && (
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                {emails.length} email{emails.length > 1 ? 's' : ''} detected
              </span>
            )}
          </div>
        </form>

        {error && (
          <div style={{
            marginTop: '12px', padding: '10px 14px',
            background: 'rgba(255,71,87,.08)', border: '1px solid rgba(255,71,87,.2)',
            borderRadius: 'var(--radius)', color: 'var(--red)', fontSize: '12px',
          }}>
            {error}
          </div>
        )}
      </Panel>

      {results && <CheckResults results={results} />}
    </div>
  )
}

function CheckResults({ results }) {
  const { results: rows, pwnedCount } = results
  return (
    <Panel title={`Results — ${pwnedCount} of ${rows.length} email${rows.length > 1 ? 's' : ''} pwned`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {rows.map((r) => (
          <EmailResult key={r.email} result={r} />
        ))}
      </div>
    </Panel>
  )
}

function EmailResult({ result: r }) {
  const [open, setOpen] = useState(r.pwned)

  return (
    <div style={{
      border: `1px solid ${r.pwned ? (r.breaches?.some((b) => b.severity === 'critical') ? 'rgba(255,71,87,.3)' : 'rgba(255,179,71,.3)') : 'var(--border)'}`,
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
    }}>
      <div
        onClick={() => r.pwned && setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '10px 14px', cursor: r.pwned ? 'pointer' : 'default',
        }}
      >
        <div style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#fff' }}>
          {r.email}
        </div>
        {r.error ? (
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{r.error}</span>
        ) : r.pwned ? (
          <>
            <Badge variant="critical">{r.breachCount} breach{r.breachCount > 1 ? 'es' : ''}</Badge>
            <span style={{ color: 'var(--muted)', fontSize: '11px' }}>{open ? '▲' : '▼'}</span>
          </>
        ) : (
          <Badge variant="ok">clean</Badge>
        )}
      </div>

      {open && r.pwned && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px', background: 'var(--bg)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {r.breaches.map((b) => (
              <BreachRow key={b.Name} breach={b} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function BreachRow({ breach: b }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '180px 1fr auto',
      gap: '12px', alignItems: 'center',
      padding: '6px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div>
        <div style={{ color: '#fff', fontSize: '12px', fontWeight: 500 }}>{b.Name}</div>
        <div style={{ color: 'var(--muted)', fontSize: '10px', marginTop: '1px' }}>
          {b.BreachDate} · {(b.PwnCount || 0).toLocaleString()} accounts
        </div>
      </div>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {(b.DataClasses || []).slice(0, 5).map((dc) => (
          <span key={dc} style={{
            fontSize: '10px', padding: '1px 6px',
            background: 'var(--surface)', border: '1px solid var(--border2)',
            borderRadius: '3px', color: 'var(--muted)',
          }}>{dc}</span>
        ))}
        {(b.DataClasses || []).length > 5 && (
          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
            +{(b.DataClasses || []).length - 5}
          </span>
        )}
      </div>
      <Badge variant={b.severity}>{b.severity}</Badge>
    </div>
  )
}

// ── Findings tab ──────────────────────────────────────────────────────────────
function FindingsTab({ findings, onRemediate }) {
  const [remediating, setRemediating] = useState(null)

  const handle = async (id) => {
    setRemediating(id)
    try {
      await credApi.remediateBreach(id)
      onRemediate(id)
    } finally {
      setRemediating(null)
    }
  }

  if (findings.length === 0) {
    return (
      <Panel>
        <div style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{ color: 'var(--accent)', fontSize: '24px', marginBottom: '8px' }}>✓</div>
          <div style={{ color: 'var(--text)', fontSize: '14px', fontFamily: 'var(--font-disp)' }}>
            No open breach findings
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '4px' }}>
            Use Breach Lookup to check email addresses against HIBP
          </div>
        </div>
      </Panel>
    )
  }

  return (
    <Panel title={`${findings.length} unresolved finding${findings.length > 1 ? 's' : ''}`}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr>
            {['Email', 'Breach', 'Data exposed', 'Severity', 'Found', 'Action'].map((h) => (
              <th key={h} style={{
                textAlign: 'left', color: 'var(--muted)', fontWeight: 400,
                fontSize: '11px', padding: '4px 10px 10px',
                borderBottom: '1px solid var(--border)',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {findings.map((f) => (
            <tr key={f.id}>
              <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                {f.email}
              </td>
              <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>
                <div>{f.breachName}</div>
                <div style={{ color: 'var(--muted)', fontSize: '10px' }}>{f.breachDate}</div>
              </td>
              <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)', maxWidth: '200px' }}>
                <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                  {(f.dataClasses || []).slice(0, 3).map((dc) => (
                    <span key={dc} style={{
                      fontSize: '10px', padding: '1px 5px',
                      background: 'var(--bg)', border: '1px solid var(--border2)',
                      borderRadius: '3px', color: 'var(--muted)',
                    }}>{dc}</span>
                  ))}
                  {(f.dataClasses || []).length > 3 && (
                    <span style={{ fontSize: '10px', color: 'var(--muted)' }}>+{(f.dataClasses || []).length - 3}</span>
                  )}
                </div>
              </td>
              <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)' }}>
                <Badge variant={f.severity}>{f.severity}</Badge>
              </td>
              <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: '11px' }}>
                {f.discoveredAt ? new Date(f.discoveredAt).toLocaleDateString() : '—'}
              </td>
              <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)' }}>
                <Btn onClick={() => handle(f.id)} disabled={remediating === f.id}>
                  {remediating === f.id ? 'Saving…' : 'Mark Resolved'}
                </Btn>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}

// ── Stuffing Alerts tab ───────────────────────────────────────────────────────
function StuffingTab({ alerts }) {
  if (alerts.length === 0) {
    return (
      <Panel>
        <div style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{ color: 'var(--accent)', fontSize: '24px', marginBottom: '8px' }}>✓</div>
          <div style={{ color: 'var(--text)', fontSize: '14px', fontFamily: 'var(--font-disp)' }}>
            No stuffing attacks detected
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '4px' }}>
            Login events are recorded automatically. Alerts appear when an IP triggers {'>'}10 failures
            or targets {'>'}5 accounts within 1 hour.
          </div>
        </div>
      </Panel>
    )
  }

  return (
    <Panel title={`${alerts.length} suspicious IP${alerts.length > 1 ? 's' : ''} detected (last 1h)`}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr>
            {['IP Address', 'Failed logins', 'Accounts targeted', 'Window', 'Severity'].map((h) => (
              <th key={h} style={{
                textAlign: 'left', color: 'var(--muted)', fontWeight: 400,
                fontSize: '11px', padding: '4px 10px 10px',
                borderBottom: '1px solid var(--border)',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {alerts.map((a) => (
            <tr key={a.ip}>
              <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)', color: '#fff', fontFamily: 'var(--font-mono)' }}>
                {a.ip}
              </td>
              <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)', color: 'var(--red)', fontWeight: 600 }}>
                {a.failureCount}
              </td>
              <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)', color: 'var(--amber)' }}>
                {a.targetedAccounts}
              </td>
              <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: '11px' }}>
                {a.firstSeen ? new Date(a.firstSeen).toLocaleTimeString() : '?'} →{' '}
                {a.lastSeen  ? new Date(a.lastSeen).toLocaleTimeString() : '?'}
              </td>
              <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)' }}>
                <Badge variant={a.severity}>{a.severity}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}

// ── Users tab ─────────────────────────────────────────────────────────────────
function UsersTab({ users, onReset }) {
  const [resetting, setResetting] = useState(null)
  const [resetLink, setResetLink] = useState(null)

  const handleReset = async (uid) => {
    if (!window.confirm('Force password reset for this user? Their active sessions will be terminated immediately.')) return
    setResetting(uid)
    setResetLink(null)
    try {
      const res = await credApi.forceReset(uid)
      setResetLink({ email: res.email, link: res.resetLink })
      onReset()
    } catch (err) {
      alert(err.message)
    } finally {
      setResetting(null)
    }
  }

  if (users.length === 0) {
    return (
      <Panel>
        <Empty message="No users found in this organization." />
      </Panel>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {resetLink && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(0,212,170,.06)', border: '1px solid rgba(0,212,170,.2)',
          borderRadius: 'var(--radius)',
        }}>
          <div style={{ fontSize: '12px', color: 'var(--accent)', marginBottom: '6px', fontWeight: 500 }}>
            Password reset triggered for {resetLink.email}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>
            Share this link with the user (expires in 1 hour):
          </div>
          <code style={{
            display: 'block', fontSize: '10px', color: 'var(--text)',
            background: 'var(--bg)', padding: '6px 10px', borderRadius: '3px',
            wordBreak: 'break-all',
          }}>
            {resetLink.link}
          </code>
        </div>
      )}

      <Panel title={`${users.length} user${users.length > 1 ? 's' : ''} in this organization`}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr>
              {['Email', 'Role', 'MFA', 'Last sign-in', 'Actions'].map((h) => (
                <th key={h} style={{
                  textAlign: 'left', color: 'var(--muted)', fontWeight: 400,
                  fontSize: '11px', padding: '4px 10px 10px',
                  borderBottom: '1px solid var(--border)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.uid}>
                <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                  {u.email}
                </td>
                <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                  {u.role || '—'}
                </td>
                <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)' }}>
                  {u.mfaEnrolled
                    ? <Badge variant="ok">enrolled</Badge>
                    : <Badge variant="high">not enrolled</Badge>}
                </td>
                <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: '11px' }}>
                  {u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString() : 'Never'}
                </td>
                <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)' }}>
                  <Btn
                    variant="danger"
                    onClick={() => handleReset(u.uid)}
                    disabled={resetting === u.uid}
                  >
                    {resetting === u.uid ? 'Resetting…' : 'Force Reset'}
                  </Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}
