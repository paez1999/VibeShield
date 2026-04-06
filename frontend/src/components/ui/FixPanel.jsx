import { useState } from 'react'

/**
 * FixPanel — shows vulnerable code vs fixed code side by side
 * Used inside VulnCard when the user clicks "See fix"
 */

function CodeBlock({ code, label, color }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 12px',
        background: color === 'red' ? 'rgba(240,68,68,.1)' : 'rgba(34,197,94,.08)',
        borderBottom: `1px solid ${color === 'red' ? 'rgba(240,68,68,.2)' : 'rgba(34,197,94,.15)'}`,
        borderRadius: '6px 6px 0 0',
      }}>
        <span style={{
          fontSize: '10px', fontWeight: 500, letterSpacing: '1px',
          color: color === 'red' ? '#f87171' : '#4ade80',
        }}>
          {label}
        </span>
        <button onClick={copy} style={{
          background: 'transparent', border: 'none',
          color: 'var(--muted)', fontSize: '10px', cursor: 'pointer',
          fontFamily: 'var(--mono)', transition: 'color .15s',
          padding: '2px 6px',
        }}
          onMouseEnter={e => e.target.style.color = 'var(--white)'}
          onMouseLeave={e => e.target.style.color = 'var(--muted)'}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre style={{
        margin: 0, padding: '12px',
        background: 'var(--bg)',
        border: `1px solid ${color === 'red' ? 'rgba(240,68,68,.15)' : 'rgba(34,197,94,.1)'}`,
        borderTop: 'none', borderRadius: '0 0 6px 6px',
        color: color === 'red' ? '#fca5a5' : '#86efac',
        fontSize: '11px', lineHeight: 1.7,
        overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        fontFamily: 'var(--mono)', minHeight: '80px',
      }}>
        {code}
      </pre>
    </div>
  )
}

export default function FixPanel({ vuln }) {
  const fix = FIXES[vuln.checkId] || buildGenericFix(vuln)

  return (
    <div style={{ marginTop: 12 }}>
      {/* Explanation */}
      <div style={{
        padding: '10px 14px', marginBottom: 12,
        background: 'rgba(79,142,247,.07)',
        border: '1px solid rgba(79,142,247,.15)',
        borderRadius: '6px', fontSize: '12px', color: 'var(--text)', lineHeight: 1.7,
      }}>
        {fix.explanation}
      </div>

      {/* Code diff */}
      {fix.before && fix.after && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <CodeBlock code={fix.before} label="VULNERABLE" color="red" />
          <CodeBlock code={fix.after}  label="FIXED"      color="green" />
        </div>
      )}

      {/* Extra steps */}
      {fix.steps && fix.steps.length > 0 && (
        <div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', letterSpacing: '1px', marginBottom: 8 }}>
            STEPS TO FIX
          </div>
          <ol style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fix.steps.map((step, i) => (
              <li key={i} style={{ fontSize: '12px', color: 'var(--text)', lineHeight: 1.6 }}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Docs link */}
      {fix.docsUrl && (
        <a href={fix.docsUrl} target="_blank" rel="noopener noreferrer" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          marginTop: 10, fontSize: '11px', color: 'var(--blue)',
        }}>
          Read the docs →
        </a>
      )}
    </div>
  )
}

// ── Fix database — one entry per checkId ──────────────────────────────────────
const FIXES = {

  'sql-concat': {
    explanation: 'Never concatenate user input into SQL strings. Use parameterized queries — the database driver handles escaping safely.',
    before: `// Vulnerable — attacker sends: id = "1 OR 1=1"
const id = req.params.id
db.query("SELECT * FROM users WHERE id = " + id)`,
    after: `// Fixed — input is passed as a separate parameter
const id = req.params.id
db.query("SELECT * FROM users WHERE id = $1", [id])
// With Prisma: prisma.user.findUnique({ where: { id } })`,
    steps: [
      'Replace all string-concatenated queries with parameterized queries',
      'Use $1, $2 placeholders (pg) or ? (mysql2) and pass values as an array',
      'Consider using an ORM like Prisma or Drizzle which parameterizes automatically',
    ],
    docsUrl: 'https://node-postgres.com/features/queries',
  },

  'sql-template': {
    explanation: 'Template literals in SQL queries are as dangerous as concatenation — the interpolated value is still injected directly.',
    before: `// Vulnerable
const email = req.body.email
db.query(\`SELECT * FROM users WHERE email = '\${email}'\`)`,
    after: `// Fixed — never interpolate user input into SQL
const email = req.body.email
db.query("SELECT * FROM users WHERE email = $1", [email])`,
    steps: [
      'Search your codebase for template literal strings that contain SQL keywords',
      'Replace all interpolated SQL with parameterized queries',
    ],
  },

  'xss-innerhtml': {
    explanation: 'innerHTML parses the string as HTML, executing any <script> tags or event handlers. Always use textContent for plain text, or sanitize before rendering HTML.',
    before: `// Vulnerable — attacker sends: <img src=x onerror=alert(document.cookie)>
element.innerHTML = req.body.comment`,
    after: `// Option 1 — plain text (no HTML rendering)
element.textContent = userInput

// Option 2 — sanitized HTML (install dompurify)
import DOMPurify from 'dompurify'
element.innerHTML = DOMPurify.sanitize(userInput)`,
    steps: [
      'Install DOMPurify: npm install dompurify',
      'Replace innerHTML with textContent when you only need plain text',
      'Use DOMPurify.sanitize() when you need to render HTML from user input',
    ],
    docsUrl: 'https://github.com/cure53/DOMPurify',
  },

  'xss-dangerouslysethtml': {
    explanation: 'React escapes output by default, but dangerouslySetInnerHTML opts out of that protection. Sanitize before passing to __html.',
    before: `// Vulnerable
<div dangerouslySetInnerHTML={{ __html: userContent }} />`,
    after: `// Fixed — sanitize first
import DOMPurify from 'dompurify'

<div dangerouslySetInnerHTML={{
  __html: DOMPurify.sanitize(userContent, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href']
  })
}} />`,
    steps: [
      'npm install dompurify @types/dompurify',
      'Wrap every __html value with DOMPurify.sanitize()',
      'Define an allowlist of tags and attributes appropriate for your use case',
    ],
  },

  'path-traversal': {
    explanation: 'An attacker can send "../../../etc/passwd" as the filename to read any file on your server. Always sanitize and validate file paths.',
    before: `// Vulnerable — attacker sends: ../../etc/passwd
const file = req.params.filename
fs.readFile('./uploads/' + file, callback)`,
    after: `import path from 'path'

const BASE = path.resolve('./uploads')
const filename = path.basename(req.params.filename) // strips ../
const fullPath = path.join(BASE, filename)

// Double-check the resolved path stays inside BASE
if (!fullPath.startsWith(BASE)) {
  return res.status(400).json({ error: 'Invalid path' })
}
fs.readFile(fullPath, callback)`,
    steps: [
      'Use path.basename() to strip any directory components from the filename',
      'Use path.resolve() to get the absolute path',
      'Verify the resolved path starts with your intended base directory',
    ],
  },

  'command-injection-exec': {
    explanation: 'Shell metacharacters like ; | & allow attackers to chain additional commands. Use execFile() with an args array instead of exec() with a string.',
    before: `// Vulnerable — attacker sends: file.jpg; rm -rf /
exec("convert " + req.body.filename, callback)`,
    after: `import { execFile } from 'child_process'

// execFile does NOT invoke a shell — no injection possible
execFile('convert', [req.body.filename], (err, stdout) => {
  if (err) return res.status(500).json({ error: 'Conversion failed' })
  res.json({ result: stdout })
})`,
    steps: [
      'Replace exec() with execFile() and pass arguments as an array',
      'Validate and allowlist the input before passing it even to execFile()',
      'Consider if the shell command is necessary or can be replaced with a Node.js library',
    ],
  },

  'command-injection-eval': {
    explanation: 'eval() executes any JavaScript string with full access to the Node.js runtime. If user input reaches eval(), it\'s full remote code execution.',
    before: `// Vulnerable — attacker sends: process.exit(1) or worse
eval(req.body.expression)`,
    after: `// For math expressions: use mathjs
import { evaluate } from 'mathjs'
const result = evaluate(req.body.expression) // sandboxed

// For JSON: use JSON.parse
const data = JSON.parse(req.body.json)

// For templates: use a template engine like Handlebars`,
    steps: [
      'Remove all eval() calls from production code',
      'Use mathjs for math expression evaluation',
      'Use JSON.parse() for JSON, a template engine for templates',
    ],
    docsUrl: 'https://mathjs.org/docs/expressions/parsing.html',
  },

  'ssrf-fetch': {
    explanation: 'Attackers can supply internal URLs (http://localhost:3000/admin, http://169.254.169.254 for AWS metadata) to access resources behind your firewall.',
    before: `// Vulnerable — attacker fetches internal services
const url = req.body.webhookUrl
const response = await fetch(url)`,
    after: `// Fixed — validate against an allowlist
const ALLOWED_HOSTS = ['api.spotify.com', 'api.github.com', 'hooks.slack.com']

const url = new URL(req.body.webhookUrl) // throws if invalid URL
if (!ALLOWED_HOSTS.includes(url.hostname)) {
  return res.status(400).json({ error: 'URL not allowed' })
}
const response = await fetch(url.toString())`,
    steps: [
      'Define an allowlist of hostnames your app legitimately needs to call',
      'Parse the URL with new URL() to safely extract the hostname',
      'Reject any hostname not in the allowlist before making the request',
    ],
  },

  'cookie-no-httponly': {
    explanation: 'Without HttpOnly, any JavaScript on the page (including injected XSS) can read the cookie and exfiltrate the session token.',
    before: `// Vulnerable — cookie readable by JavaScript
res.cookie('session', token)
res.cookie('session', token, { maxAge: 86400 })`,
    after: `// Fixed — HttpOnly prevents JS access
res.cookie('session', token, {
  httpOnly: true,   // not accessible via document.cookie
  secure: true,     // only sent over HTTPS
  sameSite: 'strict', // prevents CSRF
  maxAge: 86400000, // 1 day in ms
})`,
    steps: [
      'Add httpOnly: true to all cookies that store session data or tokens',
      'Add secure: true so cookies are only sent over HTTPS',
      'Add sameSite: "strict" or "lax" to prevent CSRF attacks',
    ],
  },

  'jwt-no-verify': {
    explanation: 'jwt.decode() is for reading the payload without any validation. It never checks the signature, meaning any token passes — even forged ones.',
    before: `// Vulnerable — signature is never checked
const payload = jwt.decode(req.headers.authorization)
const userId = payload.sub`,
    after: `// Fixed — verify checks signature + expiry
try {
  const payload = jwt.verify(
    req.headers.authorization.replace('Bearer ', ''),
    process.env.JWT_SECRET,
    { algorithms: ['HS256'] } // explicitly set allowed algorithms
  )
  const userId = payload.sub
} catch (err) {
  return res.status(401).json({ error: 'Invalid token' })
}`,
    steps: [
      'Replace jwt.decode() with jwt.verify() everywhere',
      'Store your JWT secret in an environment variable (never in code)',
      'Always specify the algorithms option to prevent algorithm confusion attacks',
    ],
  },

  'md5-password': {
    explanation: 'MD5 produces a 128-bit hash in microseconds. Entire databases of MD5 hashes have been precomputed (rainbow tables). Every MD5 password hash is effectively cracked instantly.',
    before: `// Vulnerable — MD5 is broken for passwords
const hash = crypto.createHash('md5').update(password).digest('hex')
await db.query("INSERT INTO users (hash) VALUES ($1)", [hash])`,
    after: `// Fixed — bcrypt is slow by design, making brute-force impractical
import bcrypt from 'bcryptjs'

const hash = await bcrypt.hash(password, 12) // 12 = cost factor
await db.query("INSERT INTO users (hash) VALUES ($1)", [hash])

// Verify:
const valid = await bcrypt.compare(inputPassword, storedHash)`,
    steps: [
      'npm install bcryptjs',
      'Replace all MD5/SHA-1 password hashing with bcrypt.hash(password, 12)',
      'Migrate existing hashed passwords: force users to reset their passwords',
      'Use bcrypt.compare() for verification — never compare hashes directly',
    ],
    docsUrl: 'https://github.com/dcodeIO/bcrypt.js',
  },

  'math-random-token': {
    explanation: 'Math.random() uses a predictable algorithm. An attacker who observes a few tokens can predict past and future ones.',
    before: `// Vulnerable — predictable token
const token = Math.random().toString(36).slice(2)
const resetToken = Date.now() + Math.random()`,
    after: `// Fixed — cryptographically random
import crypto from 'crypto'

const token = crypto.randomBytes(32).toString('hex')
// Or for URL-safe tokens:
const urlToken = crypto.randomBytes(32).toString('base64url')`,
    steps: [
      'Replace Math.random() with crypto.randomBytes() for any security-sensitive value',
      'Use at least 32 bytes (256 bits) of randomness for tokens',
      'Never use timestamps alone or combined with Math.random() as tokens',
    ],
  },

  'idor-findbyid': {
    explanation: 'If your API returns data based only on the ID in the URL, any authenticated user can access any record by changing the ID.',
    before: `// Vulnerable — user can access any record
router.get('/api/invoices/:id', auth, async (req, res) => {
  const invoice = await Invoice.findById(req.params.id)
  res.json(invoice)
})`,
    after: `// Fixed — enforce ownership
router.get('/api/invoices/:id', auth, async (req, res) => {
  const invoice = await Invoice.findOne({
    _id: req.params.id,
    userId: req.user.id // must belong to authenticated user
  })
  if (!invoice) return res.status(404).json({ error: 'Not found' })
  res.json(invoice)
})`,
    steps: [
      'Add the authenticated user\'s ID to every database query that fetches user-owned data',
      'Return 404 (not 403) when the record doesn\'t belong to the user — don\'t confirm it exists',
      'Audit every GET/PATCH/DELETE endpoint that takes an ID parameter',
    ],
  },

  'mass-assignment': {
    explanation: 'If req.body is spread directly into a database update, a user can add extra fields like { role: "admin" } or { balance: 999999 } to the request.',
    before: `// Vulnerable — attacker adds { role: "admin" } to request body
await User.update({ where: { id } }, { ...req.body })`,
    after: `// Fixed — explicitly pick allowed fields
const { name, email, bio } = req.body  // only these fields

await User.update({
  where: { id },
  data: { name, email, bio }  // never spread req.body directly
})`,
    steps: [
      'Never spread req.body directly into a database create or update',
      'Explicitly destructure only the fields users are allowed to modify',
      'Use a validation library (zod, joi) to define and enforce allowed fields',
    ],
  },

  'no-rate-limit-auth': {
    explanation: 'Without rate limiting on login endpoints, attackers can try thousands of password combinations per second (brute force) or test leaked credential lists (credential stuffing).',
    before: `// Vulnerable — unlimited attempts
app.post('/api/auth/login', async (req, res) => {
  const user = await User.findOne({ email: req.body.email })
  // ...
})`,
    after: `// Fixed — add rate limiting
import rateLimit from 'express-rate-limit'

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // max 10 attempts per window
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: true,
})

app.post('/api/auth/login', authLimiter, async (req, res) => {
  // ...
})`,
    steps: [
      'npm install express-rate-limit',
      'Apply rateLimit middleware to /login, /signup, /password-reset endpoints',
      'Consider stricter limits per IP and per email (failed attempts)',
      'Add CAPTCHA after 5 failed attempts for extra protection',
    ],
    docsUrl: 'https://github.com/express-rate-limit/express-rate-limit',
  },

  'console-log-sensitive': {
    explanation: 'Log files are often collected by third-party services (Datadog, Sentry, CloudWatch). Passwords and tokens in logs are a significant data breach risk.',
    before: `// Vulnerable — full user object with password hash logged
console.log('Login attempt:', req.body)
console.log('User authenticated:', user)`,
    after: `// Fixed — log only non-sensitive identifiers
console.log('Login attempt for email:', req.body.email)
console.log('User authenticated:', user.id, user.email)

// Even better — use a structured logger that redacts sensitive fields:
// npm install pino
import pino from 'pino'
const logger = pino({ redact: ['password', 'token', 'secret'] })`,
    steps: [
      'Audit all console.log calls and remove or redact sensitive fields',
      'Never log req.body directly — always destructure specific safe fields',
      'Use a structured logger like pino with built-in redaction',
    ],
    docsUrl: 'https://getpino.io/#/',
  },
}

// Generic fallback for vulns without a specific fix entry
function buildGenericFix(vuln) {
  return {
    explanation: vuln.description,
    before: vuln.codeSnippet
      ? `// Vulnerable code found at ${vuln.location}\n${vuln.codeSnippet}`
      : null,
    after: vuln.fix || 'Refer to the fix instructions above.',
    steps: [],
  }
}
