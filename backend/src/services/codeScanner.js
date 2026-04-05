import crypto from 'crypto'

/**
 * VibeShield Code Scanner v2
 * Detects security vulnerabilities in source code.
 *
 * Categories:
 *   SQL Injection · XSS · Path Traversal · Insecure Cookies
 *   Weak Crypto · Broken Auth · Insecure Deserialization
 *   Command Injection · SSRF · Prototype Pollution
 *   Info Disclosure · No Rate Limit · IDOR · Secrets
 */

export const CHECKS = [

  // ── SQL Injection ───────────────────────────────────────────────────────────
  {
    id: 'sql-concat',
    category: 'SQL Injection',
    severity: 'critical',
    title: 'SQL query built with string concatenation',
    description: 'User input is concatenated directly into a SQL query. An attacker can manipulate the query to bypass authentication, read all data, or delete your database.',
    fix: 'Use parameterized queries:\n// Bad\ndb.query("SELECT * FROM users WHERE id = " + userId)\n// Good\ndb.query("SELECT * FROM users WHERE id = $1", [userId])',
    pattern: /(?:query|execute|run)\s*\(\s*["'`].*(?:WHERE|SET|VALUES|FROM).*["'`]\s*\+/gim,
  },
  {
    id: 'sql-template',
    category: 'SQL Injection',
    severity: 'critical',
    title: 'SQL query using template literals with user input',
    description: 'Template literals interpolating user-supplied values into SQL allow injection attacks.',
    fix: '// Bad\n`SELECT * FROM users WHERE email = \'${email}\'`\n// Good\ndb.query("SELECT * FROM users WHERE email = $1", [email])',
    pattern: /`\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)[^`]*\$\{(?:req\.|params\.|body\.|query\.)?[\w.]+\}/gim,
  },

  // ── XSS ────────────────────────────────────────────────────────────────────
  {
    id: 'xss-innerhtml',
    category: 'XSS',
    severity: 'high',
    title: 'User input assigned to innerHTML',
    description: 'Setting innerHTML with unescaped user data allows attackers to inject malicious scripts that run in other users\' browsers.',
    fix: '// Bad\nelement.innerHTML = userInput\n// Good\nelement.textContent = userInput\n// Or sanitize: DOMPurify.sanitize(userInput)',
    pattern: /\.innerHTML\s*=\s*(?:req\.|params\.|body\.|query\.|user|input|\w+Input|\w+Data)/gim,
  },
  {
    id: 'xss-dangerouslysethtml',
    category: 'XSS',
    severity: 'high',
    title: 'dangerouslySetInnerHTML used with dynamic content',
    description: 'React\'s dangerouslySetInnerHTML bypasses its XSS protection. If the content comes from user input or an API, attackers can inject scripts.',
    fix: '// Bad\n<div dangerouslySetInnerHTML={{ __html: userContent }} />\n// Good\n<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />',
    pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:/gim,
  },
  {
    id: 'xss-document-write',
    category: 'XSS',
    severity: 'high',
    title: 'document.write() used with dynamic content',
    description: 'document.write() with user-controlled data is a classic XSS vector.',
    fix: 'Use safe DOM manipulation methods like createElement() and textContent instead.',
    pattern: /document\.write\s*\([^)]*(?:req\.|params\.|body\.|location\.|search|hash|\$_GET|\$_POST)/gim,
  },

  // ── Path Traversal ──────────────────────────────────────────────────────────
  {
    id: 'path-traversal',
    category: 'Path Traversal',
    severity: 'critical',
    title: 'File path built from user input without sanitization',
    description: 'Building file paths directly from user input allows attackers to read any file on the server using "../../../etc/passwd" style attacks.',
    fix: '// Bad\nfs.readFile(req.params.filename)\n// Good\nconst safe = path.basename(req.params.filename)\nfs.readFile(path.join(__dirname, "uploads", safe))',
    pattern: /(?:readFile|readFileSync|createReadStream|writeFile|unlink)\s*\([^)]*(?:req\.|params\.|body\.|query\.)/gim,
  },
  {
    id: 'path-traversal-join',
    category: 'Path Traversal',
    severity: 'high',
    title: 'path.join() with user input — directory traversal risk',
    description: 'path.join() does not prevent "../" traversal sequences. An attacker can escape the intended directory.',
    fix: '// After joining, verify the result starts with the intended base directory:\nconst filePath = path.join(baseDir, userInput)\nif (!filePath.startsWith(baseDir)) throw new Error("Invalid path")',
    pattern: /path\.join\s*\([^)]*(?:req\.|params\.|body\.|query\.)[^)]*\)/gim,
  },

  // ── Command Injection ───────────────────────────────────────────────────────
  {
    id: 'command-injection-exec',
    category: 'Command Injection',
    severity: 'critical',
    title: 'Shell command executed with user input',
    description: 'Passing user input to exec(), execSync(), or child_process allows attackers to run arbitrary commands on your server.',
    fix: '// Bad\nexec("convert " + req.body.filename)\n// Good — use execFile with an args array (no shell expansion):\nexecFile("convert", [req.body.filename])',
    pattern: /(?:exec|execSync|spawn|spawnSync)\s*\([^)]*(?:req\.|params\.|body\.|query\.|\+\s*\w+)/gim,
  },
  {
    id: 'command-injection-eval',
    category: 'Command Injection',
    severity: 'critical',
    title: 'eval() used with dynamic content',
    description: 'eval() executes any JavaScript string. If user input reaches eval(), attackers can run arbitrary code on your server.',
    fix: 'Never use eval() with user input. Use safer alternatives:\n// JSON parsing: JSON.parse(str)\n// Math: mathjs library\n// Templates: a template engine',
    pattern: /eval\s*\([^)]*(?:req\.|params\.|body\.|query\.|\+)/gim,
  },

  // ── SSRF ────────────────────────────────────────────────────────────────────
  {
    id: 'ssrf-fetch',
    category: 'SSRF',
    severity: 'high',
    title: 'HTTP request made to user-supplied URL',
    description: 'Server-Side Request Forgery: an attacker can supply a URL pointing to internal services (http://localhost, http://169.254.169.254) to access resources that should not be public.',
    fix: '// Validate and allowlist URLs before fetching:\nconst allowed = ["api.spotify.com", "api.github.com"]\nconst url = new URL(req.body.url)\nif (!allowed.includes(url.hostname)) throw new Error("URL not allowed")',
    pattern: /(?:fetch|axios\.get|axios\.post|http\.get|request)\s*\([^)]*(?:req\.|params\.|body\.|query\.)/gim,
  },

  // ── Insecure Cookies ────────────────────────────────────────────────────────
  {
    id: 'cookie-no-httponly',
    category: 'Insecure cookies',
    severity: 'high',
    title: 'Cookie set without HttpOnly flag',
    description: 'Without HttpOnly, cookies are accessible via JavaScript. An XSS attack can steal session cookies and hijack user accounts.',
    fix: '// Bad\nres.cookie("session", token)\n// Good\nres.cookie("session", token, { httpOnly: true, secure: true, sameSite: "strict" })',
    pattern: /res\.cookie\s*\([^)]+\)(?![\s\S]*httpOnly)/gim,
  },
  {
    id: 'cookie-no-secure',
    category: 'Insecure cookies',
    severity: 'medium',
    title: 'Cookie set without Secure flag',
    description: 'Without the Secure flag, cookies can be transmitted over HTTP, exposing them to network interception.',
    fix: 'res.cookie("name", value, { secure: true, httpOnly: true, sameSite: "strict" })',
    pattern: /res\.cookie\s*\([^)]*\{[^}]*(?!secure)[^}]*\}\s*\)/gim,
  },

  // ── Insecure Deserialization ────────────────────────────────────────────────
  {
    id: 'deserialize-user-input',
    category: 'Insecure deserialization',
    severity: 'critical',
    title: 'Deserialization of user-supplied data',
    description: 'Deserializing untrusted data can lead to remote code execution. The node-serialize package is particularly dangerous.',
    fix: 'Never deserialize user input. Use JSON.parse() for data exchange and validate the schema after parsing.',
    pattern: /(?:deserialize|unserialize|pickle\.loads|yaml\.load\b)\s*\([^)]*(?:req\.|params\.|body\.|query\.)/gim,
  },
  {
    id: 'yaml-load-unsafe',
    category: 'Insecure deserialization',
    severity: 'high',
    title: 'yaml.load() used instead of yaml.safeLoad()',
    description: 'yaml.load() can execute arbitrary JavaScript if the YAML contains special tags. This is exploitable when parsing user-supplied YAML.',
    fix: '// Bad\nyaml.load(userInput)\n// Good\nyaml.safeLoad(userInput)\n// Or with js-yaml v4+: yaml.load(userInput, { schema: yaml.JSON_SCHEMA })',
    pattern: /yaml\.load\s*\(/gim,
  },

  // ── Prototype Pollution ─────────────────────────────────────────────────────
  {
    id: 'prototype-pollution-merge',
    category: 'Prototype Pollution',
    severity: 'high',
    title: 'Recursive merge or assign with user input',
    description: 'Merging user-controlled objects without key sanitization can pollute Object.prototype, affecting all objects in the process and potentially enabling privilege escalation.',
    fix: '// Sanitize keys before merging — block __proto__, constructor, prototype:\nconst safe = JSON.parse(JSON.stringify(userObj)) // removes prototype chain\n// Or use a safe merge library like lodash.mergeWith with key validation',
    pattern: /(?:merge|deepMerge|extend|assign)\s*\([^)]*(?:req\.|params\.|body\.|query\.)/gim,
  },

  // ── Weak Cryptography ───────────────────────────────────────────────────────
  {
    id: 'md5-password',
    category: 'Weak crypto',
    severity: 'critical',
    title: 'MD5 used for hashing — cryptographically broken',
    description: 'MD5 is broken and passwords hashed with it can be cracked in seconds using rainbow tables.',
    fix: '// Bad\ncrypto.createHash("md5").update(password).digest("hex")\n// Good\nawait bcrypt.hash(password, 12)',
    pattern: /createHash\s*\(\s*['"`]md5['"`]\s*\)/gi,
  },
  {
    id: 'sha1-password',
    category: 'Weak crypto',
    severity: 'critical',
    title: 'SHA-1 used for hashing — not suitable for passwords',
    description: 'SHA-1 is fast by design, making brute-force trivial. It\'s also collision-vulnerable.',
    fix: 'Use bcrypt, argon2, or scrypt for passwords. Use SHA-256+ for checksums.',
    pattern: /createHash\s*\(\s*['"`]sha1['"`]\s*\)/gi,
  },
  {
    id: 'math-random-token',
    category: 'Weak crypto',
    severity: 'high',
    title: 'Math.random() used for security-sensitive value',
    description: 'Math.random() is not cryptographically secure. Tokens generated with it are predictable.',
    fix: '// Bad\nMath.random().toString(36)\n// Good\ncrypto.randomBytes(32).toString("hex")',
    pattern: /Math\.random\(\)[^;]*(?:token|secret|key|session|password|auth|csrf|nonce)/gim,
  },

  // ── Broken Auth ─────────────────────────────────────────────────────────────
  {
    id: 'jwt-no-verify',
    category: 'Broken auth',
    severity: 'critical',
    title: 'JWT decoded without signature verification',
    description: 'jwt.decode() skips signature validation. Anyone can forge a JWT and impersonate any user.',
    fix: '// Bad\njwt.decode(token)\n// Good\njwt.verify(token, process.env.JWT_SECRET)',
    pattern: /jwt\.decode\s*\(/gi,
  },
  {
    id: 'jwt-none-algo',
    category: 'Broken auth',
    severity: 'critical',
    title: 'JWT accepts "none" algorithm',
    description: 'Accepting the none algorithm allows attackers to craft unsigned tokens that pass verification.',
    fix: 'Always specify allowed algorithms:\njwt.verify(token, secret, { algorithms: ["HS256"] })',
    pattern: /algorithms?\s*:\s*\[?\s*['"`]none['"`]/gi,
  },
  {
    id: 'jwt-weak-secret',
    category: 'Broken auth',
    severity: 'critical',
    title: 'Weak or hardcoded JWT secret',
    description: 'Short or predictable JWT secrets can be brute-forced, allowing attackers to forge valid tokens.',
    fix: 'Use a randomly generated secret of at least 32 characters:\nconst secret = crypto.randomBytes(64).toString("hex")\n// Store in environment variable, never in code',
    pattern: /(?:jwt\.sign|jwt\.verify)\s*\([^,]+,\s*['"`][^'"`]{1,20}['"`]/gim,
  },

  // ── IDOR ────────────────────────────────────────────────────────────────────
  {
    id: 'idor-findbyid',
    category: 'IDOR',
    severity: 'high',
    title: 'Resource fetched by ID without ownership check',
    description: 'Fetching by ID alone lets any authenticated user access any other user\'s data by changing the ID in the request.',
    fix: '// Bad\ndb.findById(req.params.id)\n// Good\ndb.findOne({ _id: req.params.id, userId: req.user.id })',
    pattern: /findById\s*\(\s*req\.params\.\w+\s*\)/gim,
  },
  {
    id: 'idor-where-id-only',
    category: 'IDOR',
    severity: 'high',
    title: 'Database query filters only by request ID',
    description: 'Querying only by the ID from the URL without checking the owner allows horizontal privilege escalation.',
    fix: 'Always include the authenticated user\'s ID in the query:\nWHERE id = $1 AND user_id = $2',
    pattern: /WHERE\s+id\s*=\s*(?:\$1|req\.params\.\w+|:\w+)\s*(?:LIMIT|ORDER|$)/gim,
  },

  // ── Info Disclosure ─────────────────────────────────────────────────────────
  {
    id: 'console-log-sensitive',
    category: 'Info disclosure',
    severity: 'medium',
    title: 'Sensitive data logged to console',
    description: 'Passwords, tokens, and PII in logs can leak through log aggregators or accessible log files.',
    fix: '// Bad\nconsole.log("User:", user)\n// Good\nconsole.log("User logged in:", user.id)',
    pattern: /console\.log\s*\([^)]*(?:password|token|secret|credit|ssn|auth|private)/gim,
  },
  {
    id: 'stack-trace-client',
    category: 'Info disclosure',
    severity: 'medium',
    title: 'Stack trace or error details sent to client',
    description: 'Sending error.stack reveals internal file paths, library versions, and code structure to attackers.',
    fix: '// Bad\nres.json({ error: err.stack })\n// Good\nres.status(500).json({ error: "Internal server error" })',
    pattern: /res\.(?:json|send)\s*\(\s*\{[^}]*(?:err\.stack|error\.stack|err\.message)\s*\}/gim,
  },

  // ── No Rate Limiting ────────────────────────────────────────────────────────
  {
    id: 'no-rate-limit-auth',
    category: 'No rate limit',
    severity: 'high',
    title: 'Auth endpoint without rate limiting',
    description: 'Unlimited login attempts allow brute-force and credential stuffing attacks.',
    fix: 'Add rate limiting to auth routes:\nimport rateLimit from "express-rate-limit"\napp.use("/api/auth", rateLimit({ windowMs: 15*60*1000, max: 10 }))',
    pattern: /router\.post\s*\(\s*['"`][/\\]?(?:login|signin|auth|password-reset|forgot)[^'"]*['"`]/gim,
  },

  // ── Insecure Direct Object Reference via Mass Assignment ───────────────────
  {
    id: 'mass-assignment',
    category: 'IDOR',
    severity: 'high',
    title: 'Mass assignment — req.body spread directly into DB update',
    description: 'Spreading req.body into a database update lets attackers modify any field, including role, isAdmin, or balance.',
    fix: '// Bad\nUser.update({ where: { id } }, req.body)\n// Good — allowlist specific fields:\nconst { name, email } = req.body\nUser.update({ where: { id } }, { name, email })',
    pattern: /(?:update|create|save)\s*\([^)]*\.\.\.\s*req\.body/gim,
  },
]

// ── Allowlist — suppress known false positives ─────────────────────────────
const ALLOWLIST = [
  /example/i, /placeholder/i, /test(?:ing)?/i, /mock/i,
  /dummy/i, /sample/i, /fixture/i, /spec\./i,
  /\.test\./i, /\.spec\./i, /TODO/i,
]
const isAllowlisted = v => ALLOWLIST.some(p => p.test(v))

// ── Skip binary / generated files ──────────────────────────────────────────
const SKIP_FILES = /\.min\.js$|\.map$|\.lock$|dist\/|build\/|\.d\.ts$/i

// ── Core scan function ─────────────────────────────────────────────────────
export function scanCode(content, filePath = 'unknown') {
  if (SKIP_FILES.test(filePath)) return []

  const findings = []
  const lines = content.split('\n')

  for (const check of CHECKS) {
    check.pattern.lastIndex = 0
    let match
    while ((match = check.pattern.exec(content)) !== null) {
      const snippet = match[0].trim()
      if (isAllowlisted(snippet)) continue

      const lineNum = content.slice(0, match.index).split('\n').length
      const codeLine = lines[lineNum - 1]?.trim() || snippet

      findings.push({
        id: `${check.id}-${crypto.randomBytes(4).toString('hex')}`,
        checkId: check.id,
        category: check.category,
        severity: check.severity,
        title: check.title,
        description: check.description,
        fix: check.fix,
        location: `${filePath}:${lineNum}`,
        codeSnippet: codeLine.slice(0, 300),
        source: 'Code scan',
      })
    }
  }

  return findings
}

// ── Multi-file scan ────────────────────────────────────────────────────────
export function scanFiles(files) {
  const all = []
  const seen = new Set()

  for (const { path, content } of files) {
    for (const f of scanCode(content, path)) {
      // Deduplicate by check + location
      const key = `${f.checkId}:${f.location}`
      if (!seen.has(key)) { seen.add(key); all.push(f) }
    }
  }
  return all
}