import { useEffect, useState } from 'react'
import { vulnsApi } from '../lib/api.js'
import { Panel, Badge, Btn, Empty, Spinner } from '../components/ui/index.jsx'
import FixPanel from '../components/ui/FixPanel.jsx'

const CATEGORIES = ['All','SQL Injection','XSS','Path Traversal','Command Injection','SSRF','Insecure cookies','Weak crypto','Broken auth','Insecure deserialization','Prototype Pollution','IDOR','Info disclosure','No rate limit','Secret exposed','Dependencies']
const SEVERITY_COLOR = { critical:'var(--red)', high:'var(--amber)', medium:'var(--blue)', low:'var(--muted)' }

export default function VulnsPage() {
  const [vulns, setVulns]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [cat, setCat]           = useState('All')
  const [sev, setSev]           = useState('All')
  const [status, setStatus]     = useState('open')
  const [expanded, setExpanded] = useState(null)
  const [showFix, setShowFix]   = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [bulkBusy, setBulkBusy] = useState(null)

  const load = () => {
    setLoading(true)
    setSelected(new Set())
    vulnsApi.list().then(r => setVulns(r.data || [])).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(v => v.id)))
    }
  }

  const bulkAct = async (action) => {
    const ids = [...selected]
    if (!ids.length) return
    setBulkBusy(action)
    try {
      await vulnsApi.bulk(ids, action)
      load()
    } finally { setBulkBusy(null) }
  }

  const filtered = vulns
    .filter(v => status === 'all' || v.status === status)
    .filter(v => sev === 'All' || v.severity === sev)
    .filter(v => cat === 'All' || v.category === cat)
    .sort((a, b) => {
      const o = { critical:0, high:1, medium:2, low:3 }
      return (o[a.severity]||4) - (o[b.severity]||4)
    })

  const counts = { critical:0, high:0, medium:0, low:0 }
  vulns.filter(v => v.status === 'open').forEach(v => { if (counts[v.severity] !== undefined) counts[v.severity]++ })

  return (
    <div style={{ maxWidth:1000, animation:'fadeIn .3s ease', display:'flex', flexDirection:'column', gap:20 }}>
      <div>
        <div style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'2px', marginBottom:4 }}>VULNERABILITIES</div>
        <h1 style={{ fontFamily:'var(--disp)', fontWeight:800, fontSize:'22px', color:'var(--white)' }}>All findings</h1>
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
        {['critical','high','medium','low'].map(s => (
          <div key={s} onClick={() => setSev(sev===s ? 'All' : s)} style={{
            background:'var(--s1)',
            border:`1px solid ${sev===s ? SEVERITY_COLOR[s] : 'var(--border)'}`,
            borderRadius:'var(--rl)', padding:'12px 14px', cursor:'pointer', transition:'border-color .15s',
          }}>
            <div style={{ fontFamily:'var(--disp)', fontSize:'26px', fontWeight:800, color:SEVERITY_COLOR[s] }}>{counts[s]}</div>
            <div style={{ fontSize:'10px', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'1px', marginTop:4 }}>{s}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:4 }}>
          {['open','resolved','ignored','all'].map(s => (
            <button key={s} onClick={() => { setStatus(s); setSelected(new Set()) }} style={{
              background: status===s ? 'var(--s2)' : 'transparent',
              border:`1px solid ${status===s ? 'var(--border2)' : 'var(--border)'}`,
              borderRadius:'var(--r)', color: status===s ? 'var(--white)' : 'var(--muted)',
              fontSize:'11px', padding:'5px 12px',
            }}>{s}</button>
          ))}
        </div>
        <select value={cat} onChange={e => setCat(e.target.value)} style={{
          background:'var(--s1)', border:'1px solid var(--border)', borderRadius:'var(--r)',
          color:'var(--text)', fontSize:'11px', padding:'5px 10px', outline:'none',
        }}>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Bulk action bar — only shown when items are selected */}
      {selected.size > 0 && (
        <div style={{
          display:'flex', alignItems:'center', gap:12, padding:'10px 14px',
          background:'var(--s2)', border:'1px solid var(--border2)', borderRadius:'var(--r)',
        }}>
          <span style={{ fontSize:'11px', color:'var(--white)', fontFamily:'var(--mono)' }}>
            {selected.size} selected
          </span>
          <button onClick={() => bulkAct('resolve')} disabled={!!bulkBusy} style={{
            background:'transparent', border:'1px solid var(--green)', borderRadius:'var(--r)',
            color:'var(--green)', fontSize:'11px', padding:'4px 12px', cursor:'pointer',
            opacity: bulkBusy ? .5 : 1,
          }}>
            {bulkBusy === 'resolve' ? '…' : 'Resolve all'}
          </button>
          <button onClick={() => bulkAct('ignore')} disabled={!!bulkBusy} style={{
            background:'transparent', border:'1px solid var(--red)', borderRadius:'var(--r)',
            color:'var(--red)', fontSize:'11px', padding:'4px 12px', cursor:'pointer',
            opacity: bulkBusy ? .5 : 1,
          }}>
            {bulkBusy === 'ignore' ? '…' : 'Ignore all'}
          </button>
          <button onClick={() => setSelected(new Set())} style={{
            marginLeft:'auto', background:'transparent', border:'none',
            color:'var(--muted)', fontSize:'11px', cursor:'pointer',
          }}>
            Clear
          </button>
        </div>
      )}

      {/* List */}
      <Panel title={`${filtered.length} result${filtered.length!==1?'s':''}`} action={
        filtered.length > 0 && !loading ? (
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:'11px', color:'var(--muted)', cursor:'pointer' }}>
            <input
              type="checkbox"
              checked={selected.size === filtered.length && filtered.length > 0}
              onChange={toggleAll}
              style={{ accentColor:'var(--red)', cursor:'pointer' }}
            />
            Select all
          </label>
        ) : null
      }>
        {loading
          ? <div style={{ padding:40, display:'flex', justifyContent:'center', gap:10, color:'var(--muted)' }}><Spinner /> Loading…</div>
          : filtered.length === 0
            ? <Empty message="No vulnerabilities match the current filters." />
            : filtered.map(v => (
                <VulnCard
                  key={v.id}
                  vuln={v}
                  expanded={expanded === v.id}
                  showingFix={showFix === v.id}
                  checked={selected.has(v.id)}
                  onCheck={(e) => { e.stopPropagation(); toggleSelect(v.id) }}
                  onToggle={() => {
                    setExpanded(expanded===v.id ? null : v.id)
                    if (showFix === v.id) setShowFix(null)
                  }}
                  onToggleFix={(e) => {
                    e.stopPropagation()
                    setShowFix(showFix===v.id ? null : v.id)
                    setExpanded(v.id)
                  }}
                  onUpdate={load}
                />
              ))
        }
      </Panel>
    </div>
  )
}

function VulnCard({ vuln: v, expanded, showingFix, checked, onCheck, onToggle, onToggleFix, onUpdate }) {
  const [busy, setBusy] = useState(null)

  const act = async (action, e) => {
    e.stopPropagation()
    setBusy(action)
    try {
      if (action === 'resolve') await vulnsApi.resolve(v.id)
      if (action === 'ignore')  await vulnsApi.ignore(v.id)
      onUpdate()
    } finally { setBusy(null) }
  }

  return (
    <div style={{ borderBottom:'1px solid var(--border)' }}>
      {/* Header row — always visible */}
      <div
        onClick={onToggle}
        style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'13px 16px', cursor:'pointer', transition:'background .1s' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.015)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onCheck}
          onClick={e => e.stopPropagation()}
          style={{ accentColor:'var(--red)', cursor:'pointer', flexShrink:0, marginTop:3 }}
        />
        <span style={{
          width:7, height:7, borderRadius:'50%', flexShrink:0, marginTop:5,
          background: SEVERITY_COLOR[v.severity] || 'var(--muted)',
        }} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ color:'var(--white)', fontWeight:500, fontSize:'12px' }}>{v.title}</span>
            <Badge variant={v.severity}>{v.severity}</Badge>
            {v.category && <Badge variant="info">{v.category}</Badge>}
            {v.status !== 'open' && (
              <Badge style={{ background:'rgba(34,197,94,.1)', color:'#4ade80', border:'1px solid rgba(34,197,94,.2)' }}>
                {v.status}
              </Badge>
            )}
          </div>
          {v.location && (
            <div style={{ color:'var(--muted)', fontSize:'10px', marginTop:4, fontFamily:'var(--mono)' }}>
              {v.location}
            </div>
          )}
        </div>
        <span style={{ color:'var(--muted)', fontSize:'11px', flexShrink:0 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding:'0 16px 16px 35px', borderTop:'1px solid var(--border)', background:'rgba(0,0,0,.12)' }}>

          {/* Description */}
          {v.description && (
            <div style={{ padding:'12px 0 10px', color:'var(--text)', fontSize:'12px', lineHeight:1.7 }}>
              {v.description}
            </div>
          )}

          {/* Vulnerable code snippet */}
          {v.codeSnippet && !showingFix && (
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'1px', marginBottom:6 }}>FOUND IN YOUR CODE</div>
              <pre style={{
                background:'var(--bg)', border:'1px solid rgba(240,68,68,.2)', borderRadius:'var(--r)',
                padding:'10px 12px', color:'#fca5a5', fontSize:'11px',
                overflow:'auto', whiteSpace:'pre-wrap', wordBreak:'break-word', fontFamily:'var(--mono)',
              }}>
                {v.codeSnippet}
              </pre>
            </div>
          )}

          {/* Fix panel */}
          {showingFix && <FixPanel vuln={v} />}

          {/* Action buttons */}
          {v.status === 'open' && (
            <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
              <button
                onClick={onToggleFix}
                style={{
                  background: showingFix ? 'rgba(79,142,247,.15)' : 'transparent',
                  border:`1px solid ${showingFix ? 'var(--blue)' : 'var(--border2)'}`,
                  borderRadius:'var(--r)', color: showingFix ? 'var(--blue)' : 'var(--muted)',
                  fontSize:'11px', padding:'5px 12px', fontFamily:'var(--mono)', transition:'all .15s',
                }}
                onMouseEnter={e => { if (!showingFix) { e.currentTarget.style.borderColor='var(--blue)'; e.currentTarget.style.color='var(--blue)' }}}
                onMouseLeave={e => { if (!showingFix) { e.currentTarget.style.borderColor='var(--border2)'; e.currentTarget.style.color='var(--muted)' }}}
              >
                {showingFix ? 'Hide fix' : 'See fix →'}
              </button>
              <Btn small onClick={e => act('resolve', e)} disabled={busy==='resolve'}>
                {busy==='resolve' ? '…' : 'Mark resolved'}
              </Btn>
              <Btn small variant="danger" onClick={e => act('ignore', e)} disabled={busy==='ignore'}>
                {busy==='ignore' ? '…' : 'Ignore'}
              </Btn>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
