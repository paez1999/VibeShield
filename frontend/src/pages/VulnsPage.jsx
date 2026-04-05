import { useState } from 'react'
import { Panel, Badge, SeverityDot, Btn, Empty, Spinner } from '../components/ui/index.jsx'
const ALL_VULNS = [
  { id: '1', severity: 'critical', title: 'SQL Injection — login endpoint', location: 'src/routes/auth.js:47', category: 'SQL Injection', source: 'code', description: "User input concatenated directly into SQL query. Bypass auth or dump entire database.", fix: "Use parameterized queries: db.query('SELECT * FROM users WHERE email = $1', [email])" },
  { id: '2', severity: 'critical', title: 'Hardcoded AWS secret key', location: 'config/storage.js:12', category: 'Secret exposed', source: 'code', description: "AWS credentials in source code. Rotate immediately and move to environment variables.", fix: "Remove from code, rotate key in AWS console, add to .env and use process.env.AWS_SECRET_KEY" },
  { id: '3', severity: 'critical', title: 'Passwords hashed with MD5', location: 'src/services/userService.js:89', category: 'Weak crypto', source: 'code', description: "MD5 is broken. Passwords crackable in seconds with rainbow tables.", fix: "Replace with bcrypt: const hash = await bcrypt.hash(password, 12)" },
  { id: '4', severity: 'critical', title: 'Admin route exposed without auth', location: 'GET /api/admin/users', category: 'Broken auth', source: 'api', description: "Admin endpoint returns all user records without any authentication check.", fix: "Add authentication middleware and role check before the route handler." },
  { id: '5', severity: 'high', title: 'No rate limiting on auth endpoints', location: 'POST /api/auth/login', category: 'No rate limit', source: 'api', description: "1,000 req/sec accepted. Brute force attacks possible.", fix: "Add express-rate-limit: limiter({ windowMs: 15*60*1000, max: 10 }) before auth routes" },
  { id: '6', severity: 'high', title: 'Missing security headers', location: 'All endpoints', category: 'Missing headers', source: 'api', description: "No CSP, X-Frame-Options, or HSTS. XSS and clickjacking possible.", fix: "Add helmet() middleware: app.use(helmet()) — sets all recommended headers automatically." },
  { id: '7', severity: 'high', title: 'JWT secret key too short', location: 'src/middleware/auth.js:8', category: 'Broken auth', source: 'code', description: "6-character JWT secret is brute-forceable offline.", fix: "Generate a secure key: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"" },
  { id: '8', severity: 'high', title: 'console.log leaking user passwords', location: 'src/routes/auth.js:23', category: 'Info disclosure', source: 'code', description: "console.log(req.body) logs raw passwords to server logs.", fix: "Remove all console.log(req.body) from auth routes. Never log request bodies." },
  { id: '9', severity: 'medium', title: 'Stack trace in error responses', location: 'GET /api/users/999', category: 'Info disclosure', source: 'api', description: "Full Node.js stack traces including file paths exposed to clients.", fix: "Add global error handler that returns generic messages in production." },
  { id: '10', severity: 'medium', title: 'express 4.17.1 — CVE-2024-29041', location: 'package.json', category: 'Dependency CVE', source: 'deps', description: "Path traversal vulnerability. CVSS 7.5.", fix: "npm install express@latest" },
  { id: '11', severity: 'medium', title: 'CORS allows all origins', location: 'src/index.js:14', category: 'Missing headers', source: 'code', description: "Access-Control-Allow-Origin: * allows any domain to make authenticated requests.", fix: "Replace * with your specific frontend domain: cors({ origin: 'https://yourapp.com' })" },
  { id: '12', severity: 'low', title: 'X-Powered-By header exposes Express', location: 'All endpoints', category: 'Info disclosure', source: 'api', description: "Response header reveals server technology to attackers.", fix: "app.disable('x-powered-by') or use helmet() which removes it automatically." },
]

const CATEGORIES = ['All', 'SQL Injection', 'Secret exposed', 'Weak crypto', 'Broken auth', 'No rate limit', 'Missing headers', 'Info disclosure', 'Dependency CVE']
const SOURCES = { code: 'Code scan', api: 'API scan', deps: 'Deps scan' }
const SEV_COLOR = { critical: 'var(--red)', high: 'var(--amber)', medium: 'var(--blue)', low: 'var(--muted)' }

export default function VulnsPage() {
  const [items, setItems] = useState(ALL_VULNS)
  const [sevFilter, setSev] = useState('all')
  const [catFilter, setCat] = useState('All')
  const [expanded, setExpanded] = useState(null)
  const [showFix, setShowFix] = useState({})

  const filtered = items
    .filter(v => sevFilter === 'all' || v.severity === sevFilter)
    .filter(v => catFilter === 'All' || v.category === catFilter)
    .sort((a, b) => ['critical', 'high', 'medium', 'low'].indexOf(a.severity) - ['critical', 'high', 'medium', 'low'].indexOf(b.severity))

  const resolve = (id) => setItems(p => p.filter(v => v.id !== id))
  const ignore = (id) => setItems(p => p.filter(v => v.id !== id))

  return (
    <div style={{ maxWidth: 1100, animation: 'fadeIn .3s ease' }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '2px', marginBottom: 4 }}>MODULE</div>
        <h1 style={{ fontFamily: 'var(--disp)', fontWeight: 800, fontSize: 24, color: 'var(--white)' }}>Vulnerabilities</h1>
      </div>

      {/* Filters row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'critical', 'high', 'medium', 'low'].map(f => {
            const colors = { critical: '#f87171', high: '#fbbf24', medium: '#7eb3fa', low: 'var(--muted)', all: 'var(--text)' }
            const active = sevFilter === f
            return (
              <button key={f} onClick={() => setSev(f)}
                style={{
                  fontSize: 10, padding: '3px 10px', borderRadius: 3, border: '1px solid', cursor: 'pointer', fontFamily: 'var(--mono)', transition: 'all .15s',
                  background: active ? 'rgba(255,255,255,.06)' : 'transparent',
                  borderColor: active ? 'var(--border2)' : 'transparent',
                  color: active ? colors[f] : 'var(--muted)',
                }}>{f}</button>
            )
          })}
        </div>
        <div style={{ height: 16, width: 1, background: 'var(--border)' }} />
        <select value={catFilter} onChange={e => setCat(e.target.value)}
          style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 11, padding: '4px 10px', outline: 'none', cursor: 'pointer' }}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>{filtered.length} vulnerabilit{filtered.length !== 1 ? 'ies' : 'y'}</span>
      </div>

      <Panel>
        {filtered.length === 0
          ? <Empty message="No vulnerabilities match the current filters" />
          : filtered.map(v => (
            <div key={v.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <div
                style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', cursor: 'pointer', transition: 'background .1s' }}
                onClick={() => setExpanded(expanded === v.id ? null : v.id)}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <SeverityDot severity={v.severity} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--white)', fontWeight: 500 }}>{v.title}</span>
                    <Badge variant={v.severity}>{v.severity}</Badge>
                    <span style={{ fontSize: 10, color: 'var(--muted)', background: 'rgba(255,255,255,.04)', border: '1px solid var(--border2)', padding: '1px 6px', borderRadius: 3 }}>
                      {SOURCES[v.source]}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--muted)', background: 'rgba(255,255,255,.03)', border: '1px solid var(--border2)', padding: '1px 6px', borderRadius: 3 }}>
                      {v.category}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>{v.location}</div>
                </div>
                <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0, marginTop: 2 }}>{expanded === v.id ? '▲' : '▼'}</span>
              </div>

              {expanded === v.id && (
                <div style={{ padding: '0 16px 16px 36px', animation: 'fadeIn .2s ease' }}>
                  <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.7, padding: '10px 12px', background: 'var(--s2)', borderRadius: 'var(--radius)', borderLeft: '2px solid ' + SEV_COLOR[v.severity], marginBottom: 10 }}>
                    {v.description}
                  </div>

                  {showFix[v.id] ? (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: 'var(--green)', marginBottom: 6, letterSpacing: '1px' }}>HOW TO FIX</div>
                      <div style={{ fontSize: 11, color: 'var(--text)', padding: '10px 12px', background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.15)', borderRadius: 'var(--radius)', fontFamily: 'var(--mono)', lineHeight: 1.7 }}>
                        {v.fix}
                      </div>
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn onClick={() => setShowFix(p => ({ ...p, [v.id]: !p[v.id] }))}>
                      {showFix[v.id] ? 'Hide fix' : 'See fix →'}
                    </Btn>
                    <Btn onClick={() => resolve(v.id)} variant="primary">Mark resolved</Btn>
                    <Btn onClick={() => ignore(v.id)}>Ignore</Btn>
                  </div>
                </div>
              )}
            </div>
          ))
        }
      </Panel>
    </div>
  )
}
