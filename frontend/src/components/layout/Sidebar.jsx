import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore.js'

const NAV = [
  { to:'/dashboard',             label:'Dashboard',       dot:'var(--red)' },
  { to:'/dashboard/vulns',       label:'Vulnerabilities', dot:'var(--amber)', badge:26 },
  { to:'/dashboard/endpoints',   label:'Endpoints',       dot:'var(--blue)',  badge:8 },
]
const SCANNERS = [
  { to:'/dashboard/scan/code',   label:'Code scan',       dot:'var(--border2)' },
  { to:'/dashboard/scan/api',    label:'API scan',        dot:'var(--border2)' },
  { to:'/dashboard/scan/deps',   label:'Dependencies',    dot:'var(--border2)' },
]
const SETTINGS = [
  { to:'/dashboard/settings',    label:'Settings',        dot:'var(--border2)' },
]

const linkStyle = ({ isActive }) => ({
  display:'flex', alignItems:'center', gap:'9px',
  padding:'8px 14px', fontSize:'11px',
  color: isActive ? 'var(--white)' : 'var(--muted)',
  background: isActive ? 'rgba(240,68,68,.07)' : 'transparent',
  borderLeft: isActive ? '2px solid var(--red)' : '2px solid transparent',
  transition:'all .15s', textDecoration:'none', letterSpacing:'.2px',
})

function NavSection({ label, items }) {
  return (
    <div style={{ paddingTop:'14px' }}>
      <div style={{ padding:'2px 14px 7px', fontSize:'10px', color:'var(--muted)', letterSpacing:'2px' }}>{label}</div>
      {items.map(({ to, label, dot, badge }) => (
        <NavLink key={to} to={to} end={to==='/dashboard'} style={linkStyle}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:dot, flexShrink:0 }} />
          <span style={{ flex:1 }}>{label}</span>
          {badge && <span style={{ background:'var(--red)', color:'#fff', fontSize:'9px', padding:'1px 5px', borderRadius:'8px' }}>{badge}</span>}
        </NavLink>
      ))}
    </div>
  )
}

export default function Sidebar() {
  const { logout, user } = useAuthStore()
  const navigate = useNavigate()

  return (
    <aside style={{ width:'200px', background:'var(--s1)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0 }}>
      {/* Logo */}
      <div style={{ padding:'18px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:'10px' }}>
        <div style={{ width:28, height:28, background:'var(--red)', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L13 4V9C13 12 10.5 14.5 8 15C5.5 14.5 3 12 3 9V4L8 1Z" stroke="#fff" strokeWidth="1.2" fill="none"/>
            <path d="M5.5 8L7 9.5L10.5 6" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </div>
        <span style={{ fontFamily:'var(--disp)', fontWeight:800, fontSize:'16px', color:'var(--white)' }}>VibeShield</span>
      </div>

      <NavSection label="OVERVIEW" items={NAV} />
      <div style={{ height:'1px', background:'var(--border)', margin:'10px 0' }} />
      <NavSection label="SCANNERS" items={SCANNERS} />
      <div style={{ height:'1px', background:'var(--border)', margin:'10px 0' }} />
      <NavSection label="CONFIG" items={SETTINGS} />

      {/* Bottom org + logout */}
      <div style={{ marginTop:'auto', borderTop:'1px solid var(--border)', padding:'12px 14px' }}>
        <div style={{ background:'var(--s2)', border:'1px solid var(--border2)', borderRadius:'var(--r)', padding:'8px 10px', marginBottom:'10px' }}>
          <div style={{ fontSize:'11px', color:'var(--white)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {user?.email?.split('@')[1] || 'My App'}
          </div>
          <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:2 }}>{user?.email || ''}</div>
        </div>
        <button onClick={async () => { await logout(); navigate('/') }}
          style={{ width:'100%', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--r)', color:'var(--muted)', fontSize:'11px', padding:'6px', transition:'all .15s' }}
          onMouseEnter={e => { e.target.style.borderColor='var(--red)'; e.target.style.color='var(--red)' }}
          onMouseLeave={e => { e.target.style.borderColor='var(--border)'; e.target.style.color='var(--muted)' }}
        >Logout</button>
      </div>
    </aside>
  )
}
