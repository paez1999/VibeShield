// ── Badge ─────────────────────────────────────────────────────────────────────
const BADGE = {
  critical: { bg:'rgba(240,68,68,.12)',  color:'#f87171', border:'rgba(240,68,68,.25)' },
  high:     { bg:'rgba(245,166,35,.1)',  color:'#fbbf24', border:'rgba(245,166,35,.2)' },
  medium:   { bg:'rgba(79,142,247,.1)', color:'#7eb3fa', border:'rgba(79,142,247,.2)' },
  low:      { bg:'rgba(74,222,128,.08)',color:'#4ade80', border:'rgba(74,222,128,.15)' },
  ok:       { bg:'rgba(34,197,94,.1)',  color:'#4ade80', border:'rgba(34,197,94,.2)' },
  info:     { bg:'rgba(79,142,247,.1)', color:'#7eb3fa', border:'rgba(79,142,247,.2)' },
}

export function Badge({ variant='info', children, style={} }) {
  const c = BADGE[variant] || BADGE.info
  return (
    <span style={{
      display:'inline-flex', alignItems:'center',
      padding:'2px 8px', borderRadius:'3px',
      fontSize:'10px', fontWeight:500, letterSpacing:'.5px',
      background:c.bg, color:c.color, border:`1px solid ${c.border}`,
      textTransform:'uppercase', fontFamily:'var(--mono)', ...style,
    }}>{children}</span>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size=14 }) {
  return <span style={{ display:'inline-block', width:size, height:size, border:'1.5px solid var(--border2)', borderTop:`1.5px solid var(--red)`, borderRadius:'50%', animation:'spin .7s linear infinite' }} />
}

// ── Panel ─────────────────────────────────────────────────────────────────────
export function Panel({ title, action, children, style={} }) {
  return (
    <div style={{ background:'var(--s1)', border:'1px solid var(--border)', borderRadius:'var(--rl)', overflow:'hidden', ...style }}>
      {title && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 16px', borderBottom:'1px solid var(--border)' }}>
          <span style={{ fontSize:'12px', color:'var(--white)', fontWeight:500 }}>{title}</span>
          {action && <span style={{ fontSize:'11px', color:'var(--muted)' }}>{action}</span>}
        </div>
      )}
      {children}
    </div>
  )
}

// ── MetricCard ────────────────────────────────────────────────────────────────
export function MetricCard({ label, value, sub, color='var(--white)' }) {
  return (
    <div style={{ background:'var(--s1)', border:'1px solid var(--border)', borderRadius:'var(--rl)', padding:'14px 16px' }}>
      <div style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'8px' }}>{label}</div>
      <div style={{ fontFamily:'var(--disp)', fontSize:'30px', fontWeight:800, color, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:'6px' }}>{sub}</div>}
    </div>
  )
}

// ── Btn ───────────────────────────────────────────────────────────────────────
export function Btn({ onClick, variant='default', children, disabled, small }) {
  const variants = {
    default: { border:'var(--border2)', color:'var(--muted)', hoverB:'var(--border)', hoverC:'var(--text)' },
    danger:  { border:'var(--border2)', color:'var(--muted)', hoverB:'var(--red)',    hoverC:'var(--red)' },
    primary: { border:'var(--red)',     color:'var(--red)',   hoverB:'var(--red)',    hoverC:'var(--red)' },
  }
  const v = variants[variant] || variants.default
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background:'transparent', border:`1px solid ${v.border}`,
      borderRadius:'var(--r)', color:v.color,
      fontSize: small ? '10px' : '11px',
      padding: small ? '3px 8px' : '5px 11px',
      transition:'all .15s', opacity: disabled ? .4 : 1,
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = v.hoverB; e.currentTarget.style.color = v.hoverC }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = v.border; e.currentTarget.style.color = v.color }}
    >{children}</button>
  )
}

// ── Empty ─────────────────────────────────────────────────────────────────────
export function Empty({ message='No data' }) {
  return <div style={{ padding:'40px', textAlign:'center', color:'var(--muted)', fontSize:'12px' }}>{message}</div>
}

// ── SeverityDot ───────────────────────────────────────────────────────────────
export function SeverityDot({ severity }) {
  const colors = { critical:'var(--red)', high:'var(--amber)', medium:'var(--blue)', low:'var(--muted)' }
  return <span style={{ width:7, height:7, borderRadius:'50%', background: colors[severity]||'var(--muted)', display:'inline-block', flexShrink:0 }} />
}

// ── ScoreRing ─────────────────────────────────────────────────────────────────
export function ScoreBar({ score }) {
  const color = score < 40 ? 'var(--red)' : score < 70 ? 'var(--amber)' : 'var(--green)'
  return (
    <div>
      <div style={{ height:'5px', background:'var(--border2)', borderRadius:'3px', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${score}%`, background:color, borderRadius:'3px', transition:'width .5s ease' }} />
      </div>
    </div>
  )
}

// ── MethodBadge ───────────────────────────────────────────────────────────────
export function MethodBadge({ method }) {
  const colors = {
    GET:    { bg:'rgba(34,197,94,.1)',  color:'#4ade80' },
    POST:   { bg:'rgba(79,142,247,.1)', color:'#7eb3fa' },
    PUT:    { bg:'rgba(245,166,35,.1)', color:'#fbbf24' },
    PATCH:  { bg:'rgba(245,166,35,.1)', color:'#fbbf24' },
    DELETE: { bg:'rgba(240,68,68,.12)', color:'#f87171' },
  }
  const c = colors[method] || { bg:'rgba(255,255,255,.05)', color:'var(--muted)' }
  return (
    <span style={{ fontSize:'10px', fontWeight:500, padding:'2px 7px', borderRadius:'3px', background:c.bg, color:c.color, fontFamily:'var(--mono)', minWidth:'38px', textAlign:'center', display:'inline-block' }}>
      {method}
    </span>
  )
}
