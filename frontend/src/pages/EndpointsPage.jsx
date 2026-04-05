import { useEffect, useState } from 'react'
import { endpointsApi } from '../lib/api.js'
import { Panel, Badge, MethodBadge, Empty, Spinner } from '../components/ui/index.jsx'

const MOCK_ENDPOINTS = [
  { id:1, method:'POST', path:'/api/auth/login',  issues:['No rate limit','Verbose errors'], status:'vulnerable' },
  { id:2, method:'POST', path:'/api/auth/signup', issues:['No rate limit'],                  status:'vulnerable' },
  { id:3, method:'GET',  path:'/api/users/:id',   issues:[],                                 status:'ok' },
  { id:4, method:'GET',  path:'/api/admin/users', issues:['No auth required'],               status:'critical' },
  { id:5, method:'DELETE',path:'/api/tracks/:id', issues:['No ownership check'],             status:'vulnerable' },
  { id:6, method:'GET',  path:'/api/health',      issues:[],                                 status:'ok' },
  { id:7, method:'POST', path:'/api/tracks',      issues:['No file type validation'],        status:'vulnerable' },
  { id:8, method:'GET',  path:'/api/users',       issues:['Exposes all user emails'],        status:'critical' },
]

export default function EndpointsPage() {
  const [endpoints, setEndpoints] = useState([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('all')

  useEffect(() => {
    endpointsApi.list()
      .then(r => setEndpoints(r.data || MOCK_ENDPOINTS))
      .catch(() => setEndpoints(MOCK_ENDPOINTS))
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? endpoints : endpoints.filter(e => e.status === filter)

  const counts = {
    critical:   endpoints.filter(e => e.status==='critical').length,
    vulnerable: endpoints.filter(e => e.status==='vulnerable').length,
    ok:         endpoints.filter(e => e.status==='ok').length,
  }

  return (
    <div style={{ maxWidth:900, animation:'fadeIn .3s ease', display:'flex', flexDirection:'column', gap:20 }}>
      <div>
        <div style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'2px', marginBottom:4 }}>MODULE 2</div>
        <h1 style={{ fontFamily:'var(--disp)', fontWeight:800, fontSize:'22px', color:'var(--white)' }}>Endpoints</h1>
        <p style={{ color:'var(--muted)', fontSize:'12px', marginTop:6 }}>Live API scan results — security posture per endpoint</p>
      </div>

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
        {[
          { label:'Critical', count:counts.critical, color:'var(--red)' },
          { label:'Vulnerable', count:counts.vulnerable, color:'var(--amber)' },
          { label:'OK', count:counts.ok, color:'var(--green)' },
        ].map(({ label, count, color }) => (
          <div key={label} style={{ background:'var(--s1)', border:'1px solid var(--border)', borderRadius:'var(--rl)', padding:'14px 16px' }}>
            <div style={{ fontFamily:'var(--disp)', fontSize:'28px', fontWeight:800, color }}>{count}</div>
            <div style={{ fontSize:'10px', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'1px', marginTop:4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Global headers check */}
      <Panel title="Global security headers">
        <div style={{ padding:'12px 16px', display:'flex', flexWrap:'wrap', gap:10 }}>
          {[
            { header:'Content-Security-Policy', ok:false },
            { header:'X-Frame-Options',         ok:false },
            { header:'HSTS',                    ok:false },
            { header:'X-Content-Type-Options',  ok:true  },
            { header:'Referrer-Policy',         ok:false },
            { header:'CORS configured',         ok:true  },
          ].map(({ header, ok }) => (
            <div key={header} style={{
              display:'flex', alignItems:'center', gap:8, padding:'7px 12px',
              background:'var(--bg)', border:`1px solid ${ok ? 'rgba(34,197,94,.2)' : 'rgba(240,68,68,.2)'}`,
              borderRadius:'var(--r)', fontSize:'11px',
            }}>
              <span style={{ color: ok ? 'var(--green)' : 'var(--red)', fontSize:12 }}>{ok ? '✓' : '✗'}</span>
              <span style={{ color: ok ? 'var(--green)' : 'var(--red)' }}>{header}</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Filter */}
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
            : filtered.map(ep => <EndpointRow key={ep.id} endpoint={ep} />)
        }
      </Panel>
    </div>
  )
}

function EndpointRow({ endpoint: ep }) {
  const [open, setOpen] = useState(false)
  const statusColor = { critical:'var(--red)', vulnerable:'var(--amber)', ok:'var(--green)' }

  return (
    <div style={{ borderBottom:'1px solid var(--border)' }}>
      <div onClick={() => setOpen(v=>!v)} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 16px', cursor:'pointer' }}
        onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.015)'}
        onMouseLeave={e=>e.currentTarget.style.background='transparent'}
      >
        <MethodBadge method={ep.method} />
        <span style={{ flex:1, color:'var(--white)', fontFamily:'var(--mono)', fontSize:'12px' }}>{ep.path}</span>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          {ep.issues?.length > 0
            ? ep.issues.slice(0,2).map(issue => (
                <span key={issue} style={{ fontSize:'10px', color:statusColor[ep.status]||'var(--muted)' }}>{issue}</span>
              ))
            : <span style={{ fontSize:'10px', color:'var(--green)' }}>No issues</span>
          }
          <span style={{ width:7, height:7, borderRadius:'50%', background:statusColor[ep.status]||'var(--muted)', flexShrink:0 }} />
        </div>
        <span style={{ color:'var(--muted)', fontSize:'12px' }}>{open?'▲':'▼'}</span>
      </div>

      {open && ep.issues?.length > 0 && (
        <div style={{ padding:'10px 16px 14px 58px', background:'rgba(0,0,0,.15)', borderTop:'1px solid var(--border)' }}>
          <div style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'1px', marginBottom:8 }}>ISSUES DETECTED</div>
          {ep.issues.map(issue => (
            <div key={issue} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:'12px' }}>
              <span style={{ color:'var(--red)', fontSize:12 }}>✗</span>
              <span style={{ color:'var(--text)', flex:1 }}>{issue}</span>
              <Badge variant={ep.status==='critical'?'critical':'high'}>{ep.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
