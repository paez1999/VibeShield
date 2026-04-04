// ── Badge ─────────────────────────────────────────────────────────────────────
const BADGE_COLORS = {
  critical: { bg: 'rgba(255,71,87,.15)',   color: 'var(--red)',    border: 'rgba(255,71,87,.3)' },
  high:     { bg: 'rgba(255,179,71,.12)',  color: 'var(--amber)',  border: 'rgba(255,179,71,.25)' },
  medium:   { bg: 'rgba(74,158,255,.12)', color: 'var(--blue)',   border: 'rgba(74,158,255,.25)' },
  low:      { bg: 'rgba(0,212,170,.1)',   color: 'var(--accent)', border: 'rgba(0,212,170,.2)' },
  ok:       { bg: 'rgba(0,212,170,.1)',   color: 'var(--accent)', border: 'rgba(0,212,170,.2)' },
  pending:  { bg: 'rgba(167,139,250,.12)',color: 'var(--purple)', border: 'rgba(167,139,250,.25)' },
  info:     { bg: 'rgba(74,158,255,.12)', color: 'var(--blue)',   border: 'rgba(74,158,255,.25)' },
}

export function Badge({ variant = 'info', children }) {
  const c = BADGE_COLORS[variant] || BADGE_COLORS.info
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: '3px',
      fontSize: '10px', fontWeight: 500, letterSpacing: '.5px',
      background: c.bg, color: c.color,
      border: `1px solid ${c.border}`,
      fontFamily: 'var(--font-mono)',
      textTransform: 'uppercase',
    }}>
      {children}
    </span>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 16 }) {
  return (
    <span style={{
      display: 'inline-block',
      width: size, height: size,
      border: `2px solid var(--border2)`,
      borderTop: `2px solid var(--accent)`,
      borderRadius: '50%',
      animation: 'spin .7s linear infinite',
    }} />
  )
}

// ── MetricCard ────────────────────────────────────────────────────────────────
export function MetricCard({ label, value, sub, accentColor = 'var(--text)' }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '16px 18px',
    }}>
      <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-disp)', fontSize: '30px', fontWeight: 800, color: accentColor, lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>{sub}</div>
      )}
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────
export function Panel({ title, action, children, style = {} }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '16px 18px',
      ...style,
    }}>
      {title && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '14px',
        }}>
          <span style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 500 }}>{title}</span>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

// ── RiskBar ───────────────────────────────────────────────────────────────────
export function RiskBar({ score }) {
  const color = score >= 70 ? 'var(--red)' : score >= 40 ? 'var(--amber)' : score >= 20 ? 'var(--blue)' : 'var(--accent)'
  return (
    <div>
      <span style={{ color, fontWeight: 500 }}>{score}</span>
      <div style={{ height: '3px', background: 'var(--border2)', borderRadius: '2px', marginTop: '4px' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width .4s ease' }} />
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function Empty({ message = 'No data yet' }) {
  return (
    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
      {message}
    </div>
  )
}

// ── Btn ───────────────────────────────────────────────────────────────────────
export function Btn({ onClick, variant = 'default', children, disabled }) {
  const colors = {
    default: { border: 'var(--border2)', color: 'var(--muted)', hover: 'var(--accent)' },
    danger:  { border: 'var(--border2)', color: 'var(--muted)', hover: 'var(--red)' },
    primary: { border: 'var(--accent)',  color: 'var(--accent)', hover: 'var(--accent)' },
  }
  const c = colors[variant]
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'transparent',
        border: `1px solid ${c.border}`,
        borderRadius: 'var(--radius)',
        color: c.color,
        fontSize: '11px', padding: '4px 10px',
        fontFamily: 'var(--font-mono)',
        opacity: disabled ? .4 : 1,
        transition: 'all .15s',
      }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.borderColor = c.hover; e.currentTarget.style.color = c.hover } }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.color }}
    >
      {children}
    </button>
  )
}
