import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../lib/api.js'
import { useAuthStore } from '../store/authStore.js'

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    padding: '24px',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '40px',
    animation: 'fadeIn .3s ease',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '32px',
  },
  logoIcon: {
    width: '32px',
    height: '32px',
    background: 'var(--accent)',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontFamily: 'var(--font-disp)',
    fontWeight: 800,
    fontSize: '20px',
    color: '#fff',
  },
  tabs: {
    display: 'flex',
    gap: '0',
    marginBottom: '28px',
    borderBottom: '1px solid var(--border)',
  },
  tab: (active) => ({
    flex: 1,
    padding: '10px',
    textAlign: 'center',
    fontSize: '12px',
    fontFamily: 'var(--font-mono)',
    background: 'transparent',
    border: 'none',
    color: active ? 'var(--accent)' : 'var(--muted)',
    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
    marginBottom: '-1px',
    transition: 'all .15s',
    letterSpacing: '1px',
  }),
  field: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '11px',
    color: 'var(--muted)',
    marginBottom: '6px',
    letterSpacing: '1px',
    textTransform: 'uppercase',
  },
  input: {
    width: '100%',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '10px 12px',
    color: 'var(--text)',
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    outline: 'none',
    transition: 'border-color .15s',
  },
  btn: (loading) => ({
    width: '100%',
    marginTop: '8px',
    padding: '12px',
    background: loading ? 'var(--accent-dim)' : 'var(--accent)',
    border: 'none',
    borderRadius: 'var(--radius)',
    color: '#0a0c0f',
    fontFamily: 'var(--font-disp)',
    fontWeight: 700,
    fontSize: '14px',
    letterSpacing: '.5px',
    cursor: loading ? 'not-allowed' : 'pointer',
    transition: 'background .15s, transform .1s',
  }),
  error: {
    marginTop: '12px',
    padding: '10px 12px',
    background: 'rgba(255,71,87,.1)',
    border: '1px solid rgba(255,71,87,.25)',
    borderRadius: 'var(--radius)',
    color: 'var(--red)',
    fontSize: '12px',
  },
  divider: {
    textAlign: 'center',
    color: 'var(--muted)',
    fontSize: '11px',
    marginTop: '24px',
  },
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 1.5L15 5V10.5C15 13.5 12 16 9 16.5C6 16 3 13.5 3 10.5V5L9 1.5Z"
        stroke="#0a0c0f" strokeWidth="1.5" fill="none"/>
      <path d="M9 5.5L11.5 7V10L9 11.5L6.5 10V7L9 5.5Z" fill="#0a0c0f"/>
    </svg>
  )
}

export default function AuthPage() {
  const [mode, setMode]       = useState('login')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [form, setForm]       = useState({ orgName: '', email: '', password: '' })
  const navigate  = useNavigate()
  const setAuth   = useAuthStore((s) => s.setAuth)

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      let data
      if (mode === 'login') {
        data = await auth.login(form.email, form.password)
      } else {
        data = await auth.signup(form.orgName, form.email, form.password)
      }
      setAuth({ token: data.token, userId: data.userId, orgId: data.orgId })
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>
          <div style={s.logoIcon}><ShieldIcon /></div>
          <span style={s.logoText}>VibeShield</span>
        </div>

        <div style={s.tabs}>
          <button style={s.tab(mode === 'login')}  onClick={() => { setMode('login');  setError('') }}>
            LOGIN
          </button>
          <button style={s.tab(mode === 'signup')} onClick={() => { setMode('signup'); setError('') }}>
            SIGN UP
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div style={s.field}>
              <label style={s.label}>Organization name</label>
              <input
                style={s.input}
                placeholder="Acme Music Inc"
                value={form.orgName}
                onChange={set('orgName')}
                required
                onFocus={(e)  => e.target.style.borderColor = 'var(--accent)'}
                onBlur={(e)   => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
          )}

          <div style={s.field}>
            <label style={s.label}>Email</label>
            <input
              style={s.input}
              type="email"
              placeholder="admin@yourapp.com"
              value={form.email}
              onChange={set('email')}
              required
              onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
              onBlur={(e)  => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Password</label>
            <input
              style={s.input}
              type="password"
              placeholder={mode === 'signup' ? 'Min 8 characters' : '••••••••'}
              value={form.password}
              onChange={set('password')}
              required
              onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
              onBlur={(e)  => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {error && <div style={s.error}>{error}</div>}

          <button type="submit" style={s.btn(loading)} disabled={loading}>
            {loading ? 'Loading...' : mode === 'login' ? 'Sign in →' : 'Create account →'}
          </button>
        </form>

        <p style={s.divider}>
          {mode === 'login'
            ? "No account? Click Sign Up above"
            : "Already have an account? Click Login above"}
        </p>
      </div>
    </div>
  )
}
