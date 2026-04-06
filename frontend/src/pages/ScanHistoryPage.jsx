import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { scansApi } from '../lib/api.js'
import { Panel, Empty, Spinner } from '../components/ui/index.jsx'

const TYPE_COLOR = { code: 'var(--blue)', api: 'var(--amber)', deps: 'var(--green)', text: 'var(--muted)', webhook: 'var(--red)' }

function fmt(date) {
  if (!date) return '—'
  const d = new Date(date)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function duration(start, end) {
  if (!start || !end) return null
  const ms = new Date(end) - new Date(start)
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

export default function ScanHistoryPage() {
  const [scans, setScans]     = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    scansApi.history()
      .then(r => setScans(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ maxWidth:900, animation:'fadeIn .3s ease', display:'flex', flexDirection:'column', gap:20 }}>
      <div>
        <div style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'2px', marginBottom:4 }}>HISTORY</div>
        <h1 style={{ fontFamily:'var(--disp)', fontWeight:800, fontSize:'22px', color:'var(--white)' }}>Scan history</h1>
      </div>

      <Panel title={loading ? 'Loading…' : `${scans.length} scan${scans.length !== 1 ? 's' : ''}`}>
        {loading
          ? <div style={{ padding:40, display:'flex', justifyContent:'center', gap:10, color:'var(--muted)' }}><Spinner /> Loading…</div>
          : scans.length === 0
            ? <Empty message="No scans yet. Run your first scan to see history here." />
            : scans.map(s => <ScanRow key={s.id} scan={s} onScan={() => {
                const type = s.type
                if (type === 'code' || type === 'deps' || type === 'webhook') navigate('/dashboard/scan/code')
                else if (type === 'api') navigate('/dashboard/scan/api')
                else navigate('/dashboard/scan/code')
              }} />)
        }
      </Panel>
    </div>
  )
}

function ScanRow({ scan: s }) {
  const target = s.meta?.repo || s.meta?.url || s.meta?.filename || '—'
  const typeColor = TYPE_COLOR[s.type] || 'var(--muted)'
  const dur = duration(s.startedAt, s.completedAt)
  const findings = s.findings ?? 0

  return (
    <div style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', borderBottom:'1px solid var(--border)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.015)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Type badge */}
      <div style={{
        padding:'2px 8px', borderRadius:'var(--r)', fontSize:'9px', fontFamily:'var(--mono)',
        letterSpacing:'1px', textTransform:'uppercase', border:`1px solid ${typeColor}`,
        color: typeColor, flexShrink:0, minWidth:52, textAlign:'center',
      }}>
        {s.type}
      </div>

      {/* Target */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ color:'var(--white)', fontSize:'12px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {target}
        </div>
        {s.meta?.ref && (
          <div style={{ color:'var(--muted)', fontSize:'10px', fontFamily:'var(--mono)', marginTop:2 }}>
            @{s.meta.ref}{s.meta.branch ? ` (${s.meta.branch})` : ''}
          </div>
        )}
      </div>

      {/* Findings */}
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <div style={{
          fontFamily:'var(--disp)', fontWeight:700, fontSize:'16px',
          color: findings > 0 ? 'var(--red)' : 'var(--green)',
        }}>{findings}</div>
        <div style={{ fontSize:'9px', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'1px' }}>findings</div>
      </div>

      {/* Status */}
      <div style={{ flexShrink:0, display:'flex', alignItems:'center', gap:6 }}>
        <span style={{
          width:6, height:6, borderRadius:'50%', flexShrink:0,
          background: s.status === 'complete' ? 'var(--green)' : s.status === 'running' ? 'var(--amber)' : 'var(--muted)',
        }} />
        <span style={{ fontSize:'10px', color:'var(--muted)', fontFamily:'var(--mono)' }}>
          {s.status}
        </span>
      </div>

      {/* Time + duration */}
      <div style={{ textAlign:'right', flexShrink:0, minWidth:90 }}>
        <div style={{ fontSize:'11px', color:'var(--text)' }}>{fmt(s.startedAt)}</div>
        {dur && <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:2 }}>{dur}</div>}
      </div>
    </div>
  )
}
