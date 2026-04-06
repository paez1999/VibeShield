import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { endpointsApi } from '../lib/api.js'
import { Panel, Badge, MethodBadge, Empty, Spinner } from '../components/ui/index.jsx'

const SEV_COLOR = { critical:'var(--red)', vulnerable:'var(--amber)', ok:'var(--green)' }

export default function EndpointsPage() {
  const [endpoints, setEndpoints] = useState([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('all')
  const [expanded, setExpanded]   = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    endpointsApi.list()
      .then(r => setEndpoints(r.data || []))
      .catch(() => setEndpoints([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? endpoints : endpoints.filter(e => e.severity === filter)

  const counts = {
    critical:   endpoints.filter(e => e.severity === 'critical').length,
    vulnerable: endpoints.filter(e => e.severity === 'vulnerable').length,
    ok:         endpoints.filter(e => e.severity === 'ok').length,
  }

  // Group headers by base URL for the headers check panel
  const baseUrls = [...new Set(endpoints.map(e => e.baseUrl).filter(Boolean))]

  return (
    <div style={{ maxWidth:900, animation:'fadeIn .3s ease', display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'2px', marginBottom:4 }}>MODULE 2</div>
          <h1 style={{ fontFamily:'var(--disp)', fontWeight:800, fontSize:'22px', color:'var(--white)' }}>Endpoints</h1>
          <p style={{ color:'var(--muted)', fontSize:'12px', marginTop:6 }}>
            {endpoints.length > 0
              ? `${endpoints.length} endpoints from ${baseUrls.length} API scan${baseUrls.length!==1?'s':''}`
              : 'Run an API scan to populate this page'}
          </p>
        </div>
        <button onClick={() => navigate('/dashboard/scan/api')} style={{
          background:'var(--red)', border:'none', borderRadius:'var(--r)',
          color:'#fff', fontFamily:'var(--mono)', fontSize:'11px',
          padding:'9px 16px', cursor:'pointer',
        }}>
          Run API scan →
        </button>
      </div>

      {/* Empty state */}
      {!loading && endpoints.length === 0 && (
        <Panel>
          <div style={{ padding:'48px', textAlign:'center' }}>
            <div style={{ fontFamily:'var(--disp)', fontSize:'16px', color:'var(--white)', fontWeight:600, marginBottom:8 }}>
              No endpoints scanned yet
            </div>
            <div style={{ color:'var(--muted)', fontSize:'12px', marginBottom:20 }}>
              Run an API scan to discover and audit your endpoints
            </div>
            <button onClick={() => navigate('/dashboard/scan/api')} style={{
              background:'var(--red)', border:'none', borderRadius:'var(--r)',
              color:'#fff', fontFamily:'var(--mono)', fontSize:'11px', padding:'9px 20px', cursor:'pointer',
            }}>
              Go to API scan →
            </button>
          </div>
        </Panel>
      )}

      {endpoints.length > 0 && (
        <>
          {/* Summary */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            {[
              { label:'Critical',    count:counts.critical,   color:'var(--red)' },
              { label:'Vulnerable',  count:counts.vulnerable, color:'var(--amber)' },
              { label:'OK',          count:counts.ok,         color:'var(--green)' },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ background:'var(--s1)', border:'1px solid var(--border)', borderRadius:'var(--rl)', padding:'14px 16px' }}>
                <div style={{ fontFamily:'var(--disp)', fontSize:'28px', fontWeight:800, color }}>{count}</div>
                <div style={{ fontSize:'10px', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'1px', marginTop:4 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display:'flex', gap:6 }}>
            {['all','critical','vulnerable','ok'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                background: filter===f ? 'var(--s2)' : 'transparent',
                border:`1px solid ${filter===f ? 'var(--border2)' : 'var(--border)'}`,
                borderRadius:'var(--r)', color: filter===f ? 'var(--white)' : 'var(--muted)',
                fontSize:'11px', padding:'5px 12px',
              }}>{f}</button>
            ))}
          </div>

          {/* Endpoint list */}
          <Panel title={`${filtered.length} endpoint${filtered.length!==1?'s':''}`}>
            {loading
              ? <div style={{ padding:40, display:'flex', justifyContent:'center', gap:10, color:'var(--muted)' }}><Spinner /></div>
              : filtered.length === 0
                ? <Empty message="No endpoints match the current filter." />
                : filtered.map((ep, i) => (
                    <EndpointRow
                      key={ep.id || i}
                      endpoint={ep}
                      expanded={expanded === (ep.id || i)}
                      onToggle={() => setExpanded(expanded === (ep.id||i) ? null : (ep.id||i))}
                    />
                  ))
            }
          </Panel>
        </>
      )}
    </div>
  )
}

function EndpointRow({ endpoint: ep, expanded, onToggle }) {
  return (
    <div style={{ borderBottom:'1px solid var(--border)' }}>
      <div onClick={onToggle} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 16px', cursor:'pointer' }}
        onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.015)'}
        onMouseLeave={e => e.currentTarget.style.background='transparent'}
      >
        <MethodBadge method={ep.method || 'GET'} />
        <span style={{ flex:1, color:'var(--white)', fontFamily:'var(--mono)', fontSize:'12px' }}>
          {ep.path || ep.url}
        </span>
        {ep.status && (
          <span style={{ fontSize:'11px', color:'var(--muted)', marginRight:8 }}>
            {ep.status}
          </span>
        )}
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          {ep.issues?.length > 0
            ? ep.issues.slice(0,2).map((issue, i) => (
                <span key={i} style={{ fontSize:'10px', color:SEV_COLOR[ep.severity]||'var(--muted)' }}>
                  {issue}
                </span>
              ))
            : <span style={{ fontSize:'10px', color:'var(--green)' }}>No issues</span>
          }
          <span style={{ width:7, height:7, borderRadius:'50%', background:SEV_COLOR[ep.severity]||'var(--border2)', flexShrink:0 }} />
        </div>
        <span style={{ color:'var(--muted)', fontSize:'11px' }}>{expanded?'▲':'▼'}</span>
      </div>

      {expanded && ep.issues?.length > 0 && (
        <div style={{ padding:'10px 16px 14px 62px', background:'rgba(0,0,0,.15)', borderTop:'1px solid var(--border)' }}>
          <div style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'1px', marginBottom:8 }}>ISSUES DETECTED</div>
          {ep.issues.map((issue, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:'12px' }}>
              <span style={{ color:'var(--red)' }}>✗</span>
              <span style={{ color:'var(--text)', flex:1 }}>{issue}</span>
              <Badge variant={ep.severity==='critical'?'critical':'high'}>{ep.severity}</Badge>
            </div>
          ))}
          {ep.url && (
            <div style={{ marginTop:8, fontSize:'10px', color:'var(--muted)', fontFamily:'var(--mono)' }}>
              {ep.url}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
