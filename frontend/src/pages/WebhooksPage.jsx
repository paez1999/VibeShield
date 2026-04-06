import { useEffect, useState } from 'react'
import { webhooksApi } from '../lib/api.js'
import { Panel, Spinner, Empty } from '../components/ui/index.jsx'

// Derive the public webhook URL from the current backend host
function getWebhookUrl() {
  const { protocol, hostname } = window.location
  return `${protocol}//${hostname}:3000/webhook/github`
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState([])
  const [loading, setLoading]   = useState(true)
  const [repo, setRepo]         = useState('')
  const [adding, setAdding]     = useState(false)
  const [error, setError]       = useState('')
  const [newSecret, setNewSecret] = useState(null)  // shown once after creation

  const load = () => {
    setLoading(true)
    webhooksApi.list()
      .then(r => setWebhooks(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    setAdding(true); setError(''); setNewSecret(null)
    try {
      const res = await webhooksApi.create(repo.trim())
      setNewSecret({ id: res.id, repo: res.repo, secret: res.secret })
      setRepo('')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Remove this webhook?')) return
    await webhooksApi.remove(id).catch(() => {})
    load()
  }

  const webhookUrl = getWebhookUrl()

  return (
    <div style={{ maxWidth: 720, animation: 'fadeIn .3s ease', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '2px', marginBottom: 4 }}>AUTOMATION</div>
        <h1 style={{ fontFamily: 'var(--disp)', fontWeight: 800, fontSize: 22, color: 'var(--white)' }}>GitHub webhooks</h1>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
          Automatically scan your repo on every push — no manual trigger needed.
        </p>
      </div>

      {/* How it works */}
      <Panel title="Setup">
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            ['1', 'Add a repo below to generate a webhook secret'],
            ['2', `Go to your GitHub repo → Settings → Webhooks → Add webhook`],
            ['3', `Payload URL: ${webhookUrl}`],
            ['4', 'Content type: application/json'],
            ['5', 'Secret: paste the generated secret'],
            ['6', 'Events: Just the push event'],
          ].map(([n, text]) => (
            <div key={n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%', background: 'var(--red)',
                color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontFamily: 'var(--mono)', marginTop: 1,
              }}>{n}</span>
              <span style={{ fontSize: 12, color: n === '3' ? 'var(--white)' : 'var(--text)', fontFamily: n === '3' ? 'var(--mono)' : undefined }}>
                {n === '3'
                  ? <CopyLine value={webhookUrl} />
                  : text}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Add webhook */}
      <Panel title="Connect a repository">
        <form onSubmit={handleAdd} style={{ padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginBottom: 6, letterSpacing: '1px', textTransform: 'uppercase' }}>
              GitHub repository
            </label>
            <input
              value={repo}
              onChange={e => setRepo(e.target.value)}
              placeholder="owner/repo"
              required
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '9px 12px', color: 'var(--white)', fontFamily: 'var(--mono)', fontSize: 12, outline: 'none' }}
              onFocus={e => e.target.style.borderColor = 'var(--red)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
          <button type="submit" disabled={adding || !repo.trim()}
            style={{ background: 'var(--red)', border: 'none', borderRadius: 'var(--r)', padding: '9px 20px', color: '#fff', fontFamily: 'var(--mono)', fontSize: 12, cursor: adding || !repo.trim() ? 'not-allowed' : 'pointer', opacity: !repo.trim() ? .6 : 1, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
            {adding && <Spinner size={12} />}
            {adding ? 'Creating…' : 'Generate secret'}
          </button>
        </form>
        {error && (
          <div style={{ margin: '0 16px 14px', padding: '10px 14px', background: 'rgba(240,68,68,.08)', border: '1px solid rgba(240,68,68,.2)', borderRadius: 'var(--r)', color: 'var(--red)', fontSize: 12 }}>
            {error}
          </div>
        )}
      </Panel>

      {/* Secret reveal — shown once after creation */}
      {newSecret && (
        <div style={{ padding: '14px 16px', background: 'rgba(34,197,94,.05)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 'var(--rl)' }}>
          <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 600, marginBottom: 8 }}>
            ✓ Webhook created for {newSecret.repo} — copy your secret now, it won't be shown again
          </div>
          <CopyLine value={newSecret.secret} label="Secret" mono />
        </div>
      )}

      {/* Registered webhooks */}
      <Panel title={`${webhooks.length} registered webhook${webhooks.length !== 1 ? 's' : ''}`}>
        {loading
          ? <div style={{ padding: 40, display: 'flex', justifyContent: 'center', gap: 10, color: 'var(--muted)' }}><Spinner /> Loading…</div>
          : webhooks.length === 0
            ? <Empty message="No webhooks yet. Add a repo above to get started." />
            : webhooks.map(w => (
                <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: w.active ? 'var(--green)' : 'var(--border2)', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--white)' }}>{w.repo}</span>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                    {w.createdAt ? new Date(w.createdAt).toLocaleDateString() : ''}
                  </span>
                  <button
                    onClick={() => handleDelete(w.id)}
                    style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--r)', color: 'var(--muted)', fontSize: 11, padding: '4px 10px', cursor: 'pointer', transition: 'all .15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}
                  >
                    Remove
                  </button>
                </div>
              ))
        }
      </Panel>
    </div>
  )
}

function CopyLine({ value, label, mono }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {label && <span style={{ fontSize: 10, color: 'var(--muted)', width: 44 }}>{label}</span>}
      <code style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--white)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '6px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </code>
      <button onClick={copy}
        style={{ background: copied ? 'rgba(34,197,94,.1)' : 'var(--s2)', border: `1px solid ${copied ? 'rgba(34,197,94,.3)' : 'var(--border2)'}`, borderRadius: 'var(--r)', color: copied ? '#4ade80' : 'var(--muted)', fontSize: 10, padding: '5px 10px', cursor: 'pointer', transition: 'all .2s', whiteSpace: 'nowrap' }}>
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  )
}
