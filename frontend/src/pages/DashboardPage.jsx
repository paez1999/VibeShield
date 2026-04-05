import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { vulnsApi, scansApi } from '../lib/api.js'
import { MetricCard, Panel, Badge, SeverityDot, ScoreBar, Spinner, Btn, Empty } from '../components/ui/index.jsx'

const SEVERITY_ORDER = { critical:0, high:1, medium:2, low:3 }
const SEVERITY_COLOR = { critical:'var(--red)', high:'var(--amber)', medium:'var(--blue)', low:'var(--muted)' }

function scoreFromVulns(vulns) {
  if (!vulns.length) return 100
  const weights = { critical:20, high:10, medium:4, low:1 }
  const deduction = vulns.filter(v => v.status === 'open').reduce((acc, v) => acc + (weights[v.severity] || 0), 0)
  return Math.max(0, 100 - deduction)
}

export default function DashboardPage() {
  const [vulns, setVulns]     = useState([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scanInput, setScanInput] = useState('')
  const [scanResult, setScanResult] = useState(null)
  const navigate = useNavigate()

  const load = () => {
    setLoading(true)
    vulnsApi.list().then(r => setVulns(r.data || [])).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const open     = vulns.filter(v => v.status === 'open')
  const critical = open.filter(v => v.severity === 'critical').length
  const high     = open.filter(v => v.severity === 'high').length
  const medium   = open.filter(v => v.severity === 'medium').length
  const low      = open.filter(v => v.severity === 'low').length
  const score    = scoreFromVulns(vulns)
  const scoreColor = score < 40 ? 'var(--red)' : score < 70 ? 'var(--amber)' : 'var(--green)'

  const handleQuickScan = async (e) => {
    e.preventDefault()
    if (!scanInput.trim()) return
    setScanning(true)
    setScanResult(null)
    try {
      const isUrl  = scanInput.startsWith('http')
      const isRepo = /^[\w.-]+\/[\w.-]+$/.test(scanInput.trim())
      let res
      if (isUrl)       res = await scansApi.scanApi(scanInput.trim())
      else if (isRepo) res = await scansApi.scanCode(scanInput.trim(), 'main')
      else             res = await scansApi.scanText(scanInput, 'quick-scan')
      setScanResult(res)
      load()
    } catch(err) {
      setScanResult({ error: err.message })
    } finally {
      setScanning(false)
    }
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', gap:'10px', color:'var(--muted)' }}>
      <Spinner /> Loading...
    </div>
  )

  return (
    <div style={{ maxWidth:1100, animation:'fadeIn .3s ease', display:'flex', flexDirection:'column', gap:20 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'2px', marginBottom:4 }}>SECURITY OVERVIEW</div>
          <h1 style={{ fontFamily:'var(--disp)', fontWeight:800, fontSize:'22px', color:'var(--white)' }}>Dashboard</h1>
        </div>
        <button onClick={() => navigate('/dashboard/scan/code')} style={{
          background:'var(--red)', border:'none', borderRadius:'var(--r)',
          color:'#fff', fontFamily:'var(--mono)', fontSize:'11px',
          padding:'9px 16px', display:'flex', alignItems:'center', gap:6, letterSpacing:'.5px',
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="#fff" strokeWidth="1.2"/><path d="M6 3.5V6L7.5 7.5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/></svg>
          Run scan
        </button>
      </div>

      {/* Score + Metrics */}
      <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:14 }}>
        <div style={{ background:'var(--s1)', border:'1px solid var(--border)', borderRadius:'var(--rl)', padding:18, display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'1px' }}>SECURITY SCORE</div>
          <div style={{ fontFamily:'var(--disp)', fontSize:'52px', fontWeight:800, color:scoreColor, lineHeight:1 }}>{score}</div>
          <ScoreBar score={score} />
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:'11px', color:scoreColor }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:scoreColor, animation:'pulse 2s infinite', display:'inline-block' }} />
            {score < 40 ? 'Critical risk' : score < 70 ? 'Needs attention' : 'Good posture'}
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
          <MetricCard label="Critical" value={critical} sub="Fix immediately" color={critical > 0 ? 'var(--red)' : 'var(--muted)'} />
          <MetricCard label="High"     value={high}     sub="Fix this week"  color={high > 0 ? 'var(--amber)' : 'var(--muted)'} />
          <MetricCard label="Medium"   value={medium}   sub="Plan a fix"     color={medium > 0 ? 'var(--blue)' : 'var(--muted)'} />
          <MetricCard label="Low"      value={low}      sub="Monitor"        color="var(--muted)" />
        </div>
      </div>

      {/* Vulnerabilities list */}
      <Panel title="Open vulnerabilities" action={<span onClick={() => navigate('/dashboard/vulns')} style={{ cursor:'pointer', color:'var(--blue)' }}>View all →</span>}>
        {open.length === 0
          ? <Empty message="No open vulnerabilities. Run a scan to check your app." />
          : open.sort((a,b) => (SEVERITY_ORDER[a.severity]||4) - (SEVERITY_ORDER[b.severity]||4))
              .slice(0, 5)
              .map(v => <VulnRow key={v.id} vuln={v} onUpdate={load} />)
        }
      </Panel>

      {/* Quick scan */}
      <Panel title="Quick scan">
        <div style={{ padding:'14px 16px' }}>
          <form onSubmit={handleQuickScan} style={{ display:'flex', gap:10 }}>
            <input
              value={scanInput}
              onChange={e => setScanInput(e.target.value)}
              placeholder="GitHub repo (owner/repo), URL (https://...), or paste code"
              style={{
                flex:1, background:'var(--bg)', border:'1px solid var(--border)',
                borderRadius:'var(--r)', padding:'9px 12px',
                color:'var(--white)', fontSize:'12px', outline:'none',
              }}
              onFocus={e => e.target.style.borderColor='var(--red)'}
              onBlur={e  => e.target.style.borderColor='var(--border)'}
            />
            <button type="submit" disabled={scanning || !scanInput.trim()} style={{
              background: scanning ? 'var(--red-dim)' : 'var(--red)',
              border:'none', borderRadius:'var(--r)', color:'#fff',
              fontFamily:'var(--mono)', fontSize:'11px', padding:'9px 18px',
              opacity: (!scanInput.trim()) ? .5 : 1, display:'flex', alignItems:'center', gap:6,
            }}>
              {scanning && <Spinner size={11} />}
              {scanning ? 'Scanning…' : 'Scan →'}
            </button>
          </form>
          <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:8 }}>
            Detects: SQL injection · secrets exposed · weak crypto · missing auth · broken headers · and more
          </div>
          {scanResult && (
            <div style={{ marginTop:12, padding:'10px 12px', borderRadius:'var(--r)', background: scanResult.error ? 'rgba(240,68,68,.08)' : 'rgba(34,197,94,.08)', border:`1px solid ${scanResult.error ? 'rgba(240,68,68,.2)' : 'rgba(34,197,94,.2)'}`, fontSize:'12px', color: scanResult.error ? 'var(--red)' : 'var(--green)' }}>
              {scanResult.error
                ? scanResult.error
                : `Scan complete — ${scanResult.findings || 0} issue(s) found${scanResult.scannedFiles ? ` across ${scanResult.scannedFiles} files` : ''}`
              }
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}

function VulnRow({ vuln: v, onUpdate }) {
  const [loading, setLoading] = useState(false)

  const resolve = async (e) => {
    e.stopPropagation()
    setLoading(true)
    try { await vulnsApi.resolve(v.id); onUpdate() } finally { setLoading(false) }
  }

  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'13px 16px', borderBottom:'1px solid var(--border)', cursor:'pointer' }}
      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.015)'}
      onMouseLeave={e => e.currentTarget.style.background='transparent'}
    >
      <SeverityDot severity={v.severity} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ color:'var(--white)', fontWeight:500, fontSize:'12px' }}>{v.title}</div>
        {v.location && <div style={{ color:'var(--muted)', fontSize:'10px', marginTop:3, fontFamily:'var(--mono)' }}>{v.location}</div>}
        {v.description && <div style={{ color:'var(--text)', fontSize:'11px', marginTop:5, lineHeight:1.6 }}>{v.description}</div>}
        <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap', alignItems:'center' }}>
          <Badge variant={v.severity}>{v.severity}</Badge>
          {v.category && <Badge variant="info">{v.category}</Badge>}
          {v.source && <Badge style={{ background:'rgba(255,255,255,.05)', color:'var(--muted)', border:'1px solid var(--border2)' }}>{v.source}</Badge>}
          <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
            <Btn small onClick={resolve} disabled={loading}>{loading ? '…' : 'Resolve'}</Btn>
            <Btn small variant="danger" onClick={e => { e.stopPropagation(); vulnsApi.ignore(v.id).then(onUpdate) }}>Ignore</Btn>
          </div>
        </div>
      </div>
    </div>
  )
}
