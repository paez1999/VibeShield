import { Router } from 'express'
import { z } from 'zod'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { authenticate } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { scanCode, scanFiles } from '../services/codeScanner.js'
import { scanText as scanSecrets } from '../services/secretScanner.js'

const router = Router()
router.use(authenticate)
const db = () => getFirestore()

const SKIP = /node_modules|\.git|dist\/|build\/|\.png$|\.jpg$|\.gif$|\.ico$|\.lock$|\.min\.js$/i
const RELEVANT = /\.(js|jsx|ts|tsx|py|rb|php|go|java|cs|env|json|ya?ml|toml|tf|sh)$|^\.env/i
const SECRET_RELEVANT = /\.(env|json|ya?ml|toml|tf|sh|config)$|^\.env|Dockerfile/i

async function persistVulns(orgId, findings, scanId) {
  if (!findings.length) return
  const firestore = db()
  const batch = firestore.batch()
  for (const f of findings) {
    const ref = firestore.collection('vulnerabilities').doc()
    batch.set(ref, {
      orgId,
      scanId,
      status:      'open',
      title:       f.title,
      description: f.description,
      fix:         f.fix || null,
      category:    f.category,
      severity:    f.severity,
      location:    f.location || null,
      codeSnippet: f.codeSnippet || null,
      source:      f.source || 'Code scan',
      createdAt:   FieldValue.serverTimestamp(),
    })
  }
  await batch.commit()
}

async function createScanRecord(orgId, uid, type, meta) {
  const ref = await db().collection('scans').add({
    orgId, uid, type, meta,
    status:    'running',
    startedAt: FieldValue.serverTimestamp(),
  })
  return ref.id
}

async function completeScan(scanId, findings) {
  await db().collection('scans').doc(scanId).update({
    status:      'complete',
    findings:    findings.length,
    completedAt: FieldValue.serverTimestamp(),
  })
}

// ── GitHub repo code scan ─────────────────────────────────────────────────────
router.post('/code', asyncHandler(async (req, res) => {
  const { repo, ref = 'main' } = z.object({
    repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
    ref:  z.string().default('main'),
  }).parse(req.body)

  const { orgId, uid } = req.user

  if (!process.env.GITHUB_TOKEN)
    return res.status(503).json({ error: 'GITHUB_TOKEN not configured' })

  const headers = {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'VibeShield/1.0',
  }
  const base = 'https://api.github.com'

  // Validate repo + get default branch
  const repoRes = await fetch(`${base}/repos/${repo}`, { headers })
  if (repoRes.status === 404) return res.status(404).json({ error: `Repo not found: ${repo}` })
  if (!repoRes.ok) return res.status(502).json({ error: `GitHub error: ${repoRes.status}` })
  const repoData = await repoRes.json()

  // Resolve branch to SHA
  const tryBranch = async (b) => {
    const r = await fetch(`${base}/repos/${repo}/git/ref/heads/${b}`, { headers })
    return r.ok ? (await r.json()).object.sha : null
  }
  let sha = await tryBranch(ref)
  if (!sha) sha = await tryBranch(repoData.default_branch)
  if (!sha) return res.status(404).json({ error: `Branch "${ref}" not found` })

  // Fetch tree
  const treeRes = await fetch(`${base}/repos/${repo}/git/trees/${sha}?recursive=1`, { headers })
  if (!treeRes.ok) return res.status(502).json({ error: 'Failed to fetch repo tree' })
  const { tree } = await treeRes.json()

  const toScan = tree
    .filter(f => f.type === 'blob' && !SKIP.test(f.path) && RELEVANT.test(f.path) && (f.size||0) <= 256*1024)
    .slice(0, 150)

  // Fetch blobs and scan
  const fileContents = []
  await Promise.all(toScan.map(async file => {
    try {
      const r = await fetch(`${base}/repos/${repo}/git/blobs/${file.sha}`, { headers })
      if (!r.ok) return
      const blob = await r.json()
      const content = Buffer.from(blob.content, 'base64').toString('utf8')
      fileContents.push({ path: `${repo}:${sha.slice(0,7)}:${file.path}`, content })
    } catch {}
  }))

  // Run both scanners
  const codeFindings    = scanFiles(fileContents)
  const secretFindings  = fileContents
    .filter(f => SECRET_RELEVANT.test(f.path))
    .flatMap(f => scanSecrets(f.content, f.path).map(s => ({
      title:       `Secret exposed: ${s.type}`,
      description: `A ${s.type} was found hardcoded in your source code. Anyone with repo access can use it.`,
      fix:         'Move this value to an environment variable and rotate the secret immediately.',
      category:    'Secret exposed',
      severity:    s.severity,
      location:    s.location,
      source:      'Code scan',
    })))

  const allFindings = [...codeFindings, ...secretFindings]
  const scanId = await createScanRecord(orgId, uid, 'code', { repo, ref: sha.slice(0,7), scannedFiles: toScan.length })
  await persistVulns(orgId, allFindings, scanId)
  await completeScan(scanId, allFindings)

  res.json({
    message:      `Scanned ${toScan.length} files in ${repo}@${sha.slice(0,7)}`,
    scannedFiles: toScan.length,
    findings:     allFindings.length,
    critical:     allFindings.filter(f => f.severity==='critical').length,
    high:         allFindings.filter(f => f.severity==='high').length,
    details:      allFindings,
  })
}))

// ── Text / paste scan ─────────────────────────────────────────────────────────
router.post('/text', asyncHandler(async (req, res) => {
  const { content, filename = 'pasted' } = z.object({
    content:  z.string().min(1),
    filename: z.string().default('pasted'),
  }).parse(req.body)

  const { orgId } = req.user
  const codeFindings   = scanCode(content, filename)
  const secretFindings = scanSecrets(content, filename).map(s => ({
    title:       `Secret exposed: ${s.type}`,
    description: `A ${s.type} was found hardcoded in the scanned content.`,
    fix:         'Move this value to an environment variable.',
    category:    'Secret exposed',
    severity:    s.severity,
    location:    s.location,
    source:      'Text scan',
  }))

  const all = [...codeFindings, ...secretFindings]
  if (all.length) {
    const scanId = await createScanRecord(orgId, null, 'text', { filename })
    await persistVulns(orgId, all, scanId)
    await completeScan(scanId, all)
  }

  res.json({ findings: all.length, details: all })
}))

// ── API scan (endpoint probing) ───────────────────────────────────────────────
router.post('/api', asyncHandler(async (req, res) => {
  const { url } = z.object({ url: z.string().url() }).parse(req.body)
  const { orgId, uid } = req.user

  const findings = []
  const base = url.replace(/\/$/, '')

  // 1. Check security headers
  try {
    const r = await fetch(base, { method:'GET', redirect:'follow' })
    const required = ['content-security-policy','x-frame-options','strict-transport-security','x-content-type-options','referrer-policy']
    for (const h of required) {
      if (!r.headers.get(h)) {
        findings.push({
          title:       `Missing security header: ${h}`,
          description: `The ${h} header is not set. This leaves users exposed to XSS, clickjacking, and other attacks.`,
          fix:         `Add to your Express app:\napp.use(helmet()) // sets all security headers automatically`,
          category:    'Missing headers',
          severity:    h === 'content-security-policy' || h === 'strict-transport-security' ? 'high' : 'medium',
          location:    `${base} — response headers`,
          source:      'API scan',
        })
      }
    }

    // 2. Check for verbose error info
    const serverHeader = r.headers.get('server') || r.headers.get('x-powered-by')
    if (serverHeader) {
      findings.push({
        title:       `Server version disclosed: ${serverHeader}`,
        description: `The server is advertising its technology stack (${serverHeader}). Attackers use this to find known vulnerabilities.`,
        fix:         `app.disable('x-powered-by') // for Express\n// Or use helmet() which does this automatically`,
        category:    'Info disclosure',
        severity:    'low',
        location:    `${base} — response headers`,
        source:      'API scan',
      })
    }
  } catch (err) {
    findings.push({
      title:       'Target unreachable',
      description: `Could not connect to ${base}: ${err.message}`,
      category:    'Connectivity',
      severity:    'medium',
      location:    base,
      source:      'API scan',
    })
  }

  // 3. Check HTTPS redirect
  if (base.startsWith('http://')) {
    findings.push({
      title:       'No HTTPS — traffic is unencrypted',
      description: 'Your API is served over HTTP. All data including passwords and tokens is sent in plain text and can be intercepted.',
      fix:         'Set up SSL/TLS and redirect HTTP to HTTPS. Most hosting platforms (Railway, Render, Vercel) do this automatically.',
      category:    'Missing headers',
      severity:    'critical',
      location:    base,
      source:      'API scan',
    })
  }

  const scanId = await createScanRecord(orgId, uid, 'api', { url })
  await persistVulns(orgId, findings, scanId)
  await completeScan(scanId, findings)

  res.json({
    message:  `Scanned ${base}`,
    findings: findings.length,
    critical: findings.filter(f => f.severity==='critical').length,
    high:     findings.filter(f => f.severity==='high').length,
    details:  findings,
  })
}))

// ── Dependency scan ───────────────────────────────────────────────────────────
router.post('/deps', asyncHandler(async (req, res) => {
  const { repo } = z.object({ repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/) }).parse(req.body)
  const { orgId, uid } = req.user

  if (!process.env.GITHUB_TOKEN)
    return res.status(503).json({ error: 'GITHUB_TOKEN not configured' })

  const headers = { Authorization:`Bearer ${process.env.GITHUB_TOKEN}`, 'User-Agent':'VibeShield/1.0' }
  const base    = 'https://api.github.com'

  // Fetch package.json
  const pkgRes = await fetch(`${base}/repos/${repo}/contents/package.json`, { headers })
  if (!pkgRes.ok) return res.status(404).json({ error: 'package.json not found in repo' })

  const pkgData = await pkgRes.json()
  const pkg     = JSON.parse(Buffer.from(pkgData.content, 'base64').toString('utf8'))
  const deps    = { ...pkg.dependencies, ...pkg.devDependencies }

  // Known vulnerable packages (MVP — extend with real CVE DB later)
  const KNOWN_VULNS = {
    'lodash':           { below:'4.17.21', severity:'high',     cve:'CVE-2021-23337', desc:'Prototype pollution vulnerability' },
    'axios':            { below:'1.6.0',   severity:'medium',   cve:'CVE-2023-45857', desc:'CSRF vulnerability in cross-origin requests' },
    'jsonwebtoken':     { below:'9.0.0',   severity:'critical', cve:'CVE-2022-23529', desc:'Remote code execution via malformed JWT' },
    'node-fetch':       { below:'3.0.0',   severity:'high',     cve:'CVE-2022-0235',  desc:'Exposure of sensitive information' },
    'minimist':         { below:'1.2.6',   severity:'critical', cve:'CVE-2021-44906', desc:'Prototype pollution' },
    'qs':               { below:'6.10.3',  severity:'high',     cve:'CVE-2022-24999', desc:'Prototype pollution' },
    'express':          { below:'4.19.0',  severity:'medium',   cve:'CVE-2024-29041', desc:'Open redirect vulnerability' },
    'multer':           { below:'1.4.5',   severity:'high',     cve:'CVE-2022-24434', desc:'Denial of service via malformed boundary' },
  }

  const findings = []
  for (const [name, version] of Object.entries(deps)) {
    const v = KNOWN_VULNS[name]
    if (!v) continue
    const clean = version.replace(/[\^~>=<]/g, '')
    findings.push({
      title:       `Vulnerable dependency: ${name}@${version}`,
      description: `${name} has a known vulnerability (${v.cve}): ${v.desc}. Update to ${v.below} or higher.`,
      fix:         `npm install ${name}@latest\n# or\nnpm audit fix`,
      category:    'Dependencies',
      severity:    v.severity,
      location:    `package.json — ${name}`,
      source:      'Dependency scan',
    })
  }

  const scanId = await createScanRecord(orgId, uid, 'deps', { repo, depsChecked: Object.keys(deps).length })
  await persistVulns(orgId, findings, scanId)
  await completeScan(scanId, findings)

  res.json({
    message:      `Checked ${Object.keys(deps).length} dependencies in ${repo}`,
    depsChecked:  Object.keys(deps).length,
    findings:     findings.length,
    details:      findings,
  })
}))

// ── Scan history ──────────────────────────────────────────────────────────────
router.get('/history', asyncHandler(async (req, res) => {
  const { orgId } = req.user
  const snap = await db().collection('scans')
    .where('orgId', '==', orgId).get()

  const data = snap.docs
    .map(d => ({ id: d.id, ...d.data(), startedAt: d.data().startedAt?.toDate() }))
    .sort((a, b) => (b.startedAt||0) - (a.startedAt||0))
    .slice(0, 20)

  res.json({ data })
}))

export default router
