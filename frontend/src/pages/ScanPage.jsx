import { useState } from 'react'
import { Panel, Badge, SeverityDot, Btn, Empty, Spinner } from '../components/ui/index.jsx'
import { scansApi } from '../lib/api.js'

export function CodeScanPage() { return <ScanPage type="code" /> }
export function ApiScanPage() { return <ScanPage type="api" /> }
export function DepsScanPage() { return <ScanPage type="deps" /> }

const CONFIG = {
  code: {
    title: 'Code scan',
    sub: 'Scan a GitHub repository for vulnerabilities in source code',
    placeholder: 'owner/repo',
    label: 'GitHub repository',
    label2: 'Branch',
    placeholder2: 'main',
    btnLabel: 'Scan repository',
  },
  api: {
    title: 'API scan',
    sub: 'Scan live endpoints for security misconfigurations',
    placeholder: 'https://api.yourapp.com',
    label: 'API base URL',
    label2: 'Auth token (optional)',
    placeholder2: 'Bearer eyJ...',
    btnLabel: 'Scan API',
  },
  deps: {
    title: 'Dependency scan',
    sub: 'Check npm packages for known CVEs',
    placeholder: 'owner/repo',
    label: 'GitHub repository',
    label2: 'Package manager',
    placeholder2: 'npm',
    btnLabel: 'Scan dependencies',
  },
}

function ScanPage({ type }) {
  const cfg = CONFIG[type]
  const [input, setInput] = useState('')
  const [input2, setInput2] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const handleScan = async (e) => {
    e.preventDefault()
    if (!input.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      let res
      if (type === 'code') res = await scans.runCode(input.trim(), input2.trim() || 'main')
      else if (type === 'api') res = await scans.runApi(input.trim())
      else res = await scans.runDeps(input.trim())
      setResult(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 900, animation: 'fadeIn .3s ease' }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '2px', marginBottom: 4 }}>SCANNER</div>
        <h1 style={{ fontFamily: 'var(--disp)', fontWeight: 800, fontSize: 24, color: 'var(--white)' }}>{cfg.title}</h1>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{cfg.sub}</div>
      </div>

      <Panel style={{ marginBottom: 16 }}>
        <form onSubmit={handleScan} style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginBottom: 6, letterSpacing: '1px', textTransform: 'uppercase' }}>{cfg.label}</label>
              <input value={input} onChange={e => setInput(e.target.value)} placeholder={cfg.placeholder} required
                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '9px 12px', color: 'var(--white)', fontFamily: 'var(--mono)', fontSize: 12, outline: 'none', transition: 'border-color .15s' }}
                onFocus={e => e.target.style.borderColor = 'var(--red)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginBottom: 6, letterSpacing: '1px', textTransform: 'uppercase' }}>{cfg.label2}</label>
              <input value={input2} onChange={e => setInput2(e.target.value)} placeholder={cfg.placeholder2}
                style={{ width: 140, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '9px 12px', color: 'var(--white)', fontFamily: 'var(--mono)', fontSize: 12, outline: 'none', transition: 'border-color .15s' }}
                onFocus={e => e.target.style.borderColor = 'var(--red)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
            <button type="submit" disabled={loading || !input.trim()}
              style={{ background: loading ? 'var(--red-dim)' : 'var(--red)', border: 'none', borderRadius: 'var(--radius)', padding: '9px 20px', color: '#fff', fontFamily: 'var(--mono)', fontSize: 12, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', opacity: !input.trim() ? .6 : 1, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
              {loading && <Spinner size={12} />}
              {loading ? 'Scanning…' : cfg.btnLabel}
            </button>
          </div>
        </form>

        {error && (
          <div style={{ margin: '0 20px 20px', padding: '10px 14px', background: 'rgba(240,68,68,.08)', border: '1px solid rgba(240,68,68,.2)', borderRadius: 'var(--radius)', color: 'var(--red)', fontSize: 12 }}>
            {error}
          </div>
        )}
      </Panel>

      {/* Quick scan - paste text */}
      {type === 'code' && <QuickTextScan />}

      {result && <ScanResults result={result} />}
    </div>
  )
}

function QuickTextScan() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const scan = async () => {
    if (!text.trim()) return
    setLoading(true)
    try {
      const res = await scans.scanText(text, 'pasted-code')
      setResult(res)
    } catch { setResult({ findings: 0, details: [] }) }
    finally { setLoading(false) }
  }

  return (
    <Panel title="Quick scan — paste code or config" style={{ marginBottom: 16 }}>
      <div style={{ padding: 16 }}>
        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder="Paste source code, .env file, config, Terraform… VibeShield scans for secrets and vulnerabilities."
          style={{ width: '100%', height: 120, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, color: 'var(--white)', fontFamily: 'var(--mono)', fontSize: 11, outline: 'none', resize: 'vertical', lineHeight: 1.6 }}
          onFocus={e => e.target.style.borderColor = 'var(--red)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
          <button onClick={scan} disabled={loading || !text.trim()}
            style={{ background: 'var(--red)', border: 'none', borderRadius: 'var(--radius)', padding: '7px 18px', color: '#fff', fontFamily: 'var(--mono)', fontSize: 11, cursor: loading || !text.trim() ? 'not-allowed' : 'pointer', opacity: !text.trim() ? .6 : 1 }}>
            {loading ? 'Scanning…' : 'Scan →'}
          </button>
          {result && (
            <span style={{ fontSize: 12, color: result.findings > 0 ? 'var(--amber)' : 'var(--green)' }}>
              {result.findings > 0 ? `⚠ ${result.findings} issue(s) found` : '✓ Clean'}
            </span>
          )}
        </div>
      </div>
    </Panel>
  )
}

function ScanResults({ result }) {
  if (!result) return null
  return (
    <Panel title={`Scan results — ${result.message || `${result.findings} findings`}`}>
      <div style={{ display: 'flex', gap: 24, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        {[
          { label: 'Files scanned', value: result.scannedFiles || result.filesScanned || '—' },
          { label: 'Total findings', value: result.findings || 0, color: result.findings > 0 ? 'var(--amber)' : undefined },
          { label: 'Critical', value: result.critical || 0, color: result.critical > 0 ? 'var(--red)' : undefined },
          { label: 'High', value: result.high || 0, color: result.high > 0 ? 'var(--amber)' : undefined },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontFamily: 'var(--disp)', fontSize: 22, fontWeight: 800, color: color || 'var(--white)' }}>{value}</div>
          </div>
        ))}
      </div>
      {(result.details || []).length === 0
        ? <div style={{ padding: '24px', textAlign: 'center', color: 'var(--green)', fontSize: 12 }}>✓ Clean scan — no issues detected</div>
        : (result.details || []).map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
            <SeverityDot severity={d.severity} />
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--white)', fontWeight: 500 }}>{d.type}</div>
              <div style={{ color: 'var(--muted)', fontSize: 10, fontFamily: 'var(--mono)', marginTop: 2 }}>{d.location}</div>
            </div>
            <Badge variant={d.severity}>{d.severity}</Badge>
          </div>
        ))
      }
    </Panel>
  )
}
