import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore.js'

const NAV = [
  { to: '/dashboard',              label: 'Overview',     dot: 'var(--accent)' },
  { to: '/dashboard/integrations', label: 'Integrations', dot: 'var(--amber)' },
  { to: '/dashboard/breaches',     label: 'Breaches',     dot: 'var(--red)' },
  { to: '/dashboard/moderation',   label: 'Moderation',   dot: 'var(--purple)' },
]
const BOTTOM_NAV = [
  { to: '/dashboard/audit',    label: 'Audit Log', dot: 'var(--border2)' },
  { to: '/dashboard/settings', label: 'Settings',  dot: 'var(--border2)' },
]

export default function Sidebar() {
  const { logout, user } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const linkStyle = ({ isActive }) => ({
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '9px 16px', fontSize: '12px',
    color: isActive ? 'var(--accent)' : 'var(--muted)',
    background: isActive ? 'rgba(0,212,170,.06)' : 'transparent',
    borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
    transition: 'all .15s', letterSpacing: '.3px', textDecoration: 'none',
  })

  return (
    <aside style={{
      width: '180px', background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '24px', height: '24px', background: 'var(--accent)', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1L12 4V10L7 13L2 10V4L7 1Z" stroke="#0a0c0f" strokeWidth="1.5" fill="none"/>
            <path d="M7 4L9.5 5.5V8.5L7 10L4.5 8.5V5.5L7 4Z" fill="#0a0c0f"/>
          </svg>
        </div>
        <span style={{ fontFamily: 'var(--font-disp)', fontWeight: 800, fontSize: '15px', color: '#fff' }}>VibeShield</span>
      </div>

      <div style={{ padding: '12px 0 0' }}>
        <div style={{ padding: '4px 16px 8px', fontSize: '10px', color: 'var(--muted)', letterSpacing: '2px' }}>PANEL</div>
        {NAV.map(({ to, label, dot }) => (
          <NavLink key={to} to={to} end={to === '/dashboard'} style={linkStyle}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
            {label}
          </NavLink>
        ))}
      </div>

      <div style={{ height: '1px', background: 'var(--border)', margin: '12px 0' }} />

      <div>
        <div style={{ padding: '4px 16px 8px', fontSize: '10px', color: 'var(--muted)', letterSpacing: '2px' }}>SISTEMA</div>
        {BOTTOM_NAV.map(({ to, label, dot }) => (
          <NavLink key={to} to={to} style={linkStyle}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
            {label}
          </NavLink>
        ))}
      </div>

      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
        {user && (
          <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.email}
          </div>
        )}
        <button onClick={handleLogout}
          style={{
            width: '100%', background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', color: 'var(--muted)', fontSize: '11px',
            padding: '7px', fontFamily: 'var(--font-mono)', transition: 'all .15s', letterSpacing: '.5px',
          }}
          onMouseEnter={(e) => { e.target.style.borderColor = 'var(--red)'; e.target.style.color = 'var(--red)' }}
          onMouseLeave={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--muted)' }}
        >
          LOGOUT
        </button>
      </div>
    </aside>
  )
}
