import { Router } from 'express'
import { z } from 'zod'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { authenticate } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { scanCode, scanFiles } from '../services/codeScanner.js'
import { scanText as scanSecrets } from '../services/secretScanner.js'
import { runSemgrep } from '../services/semgrepScanner.js'
import { createOctokit, parseRepo, fetchRepoFiles } from '../services/githubClient.js'
import { notifySlack } from '../services/notifyService.js'

const router = Router()
router.use(authenticate)
const db = () => getFirestore()

// Deduplicate findings: if Semgrep and the regex scanner both report the same
// location+category, keep the Semgrep result (it's more precise).
function dedup(regexFindings, semgrepFindings) {
  const semgrepKeys = new Set(
    semgrepFindings.map(f => `${f.location}|${f.category}`)
  )
  const filtered = regexFindings.filter(
    f => !semgrepKeys.has(`${f.location}|${f.category}`)
  )
  return [...semgrepFindings, ...filtered]
}

const SKIP           = /node_modules|\.git|dist\/|build\/|\.png$|\.jpg$|\.gif$|\.ico$|\.lock$|\.min\.js$/i
const RELEVANT       = /\.(js|jsx|ts|tsx|py|rb|php|go|java|cs|env|json|ya?ml|toml|tf|sh)$|^\.env/i
const SECRET_RELEVANT = /\.(env|json|ya?ml|toml|tf|sh|config)$|^\.env|Dockerfile/i
// Union of RELEVANT + SECRET_RELEVANT — used as the tarball fetch filter so both
// scanners see all the files they care about in a single download.
const FETCH          = /\.(js|jsx|ts|tsx|py|rb|php|go|java|cs|env|json|ya?ml|toml|tf|sh|config)$|^\.env|Dockerfile/i

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
  const octokit = createOctokit()
  const { owner, repo: repoName } = parseRepo(repo)

  // Validate repo + get default branch
  let repoData
  try {
    const { data } = await octokit.repos.get({ owner, repo: repoName })
    repoData = data
  } catch (err) {
    const status = err.status === 404 ? 404 : 502
    return res.status(status).json({ error: err.status === 404 ? `Repo not found: ${repo}` : `GitHub error: ${err.message}` })
  }

  // Resolve branch to SHA
  const tryRef = async (branch) => {
    try {
      const { data } = await octokit.git.getRef({ owner, repo: repoName, ref: `heads/${branch}` })
      return data.object.sha
    } catch { return null }
  }
  let sha = await tryRef(ref)
  if (!sha) sha = await tryRef(repoData.default_branch)
  if (!sha) return res.status(404).json({ error: `Branch "${ref}" not found` })

  // Fetch all relevant files in one tarball download (1 API call instead of 1 per file)
  const fileContents = await fetchRepoFiles(owner, repoName, sha, {
    skip: SKIP, relevant: FETCH, maxFiles: 150,
  })

  // Run all scanners in parallel
  const [regexFindings, semgrepFindings] = await Promise.all([
    Promise.resolve(scanFiles(fileContents)),
    runSemgrep(fileContents),
  ])

  const codeFindings   = dedup(regexFindings, semgrepFindings)
  const secretFindings = fileContents
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
  const scanId = await createScanRecord(orgId, uid, 'code', { repo, ref: sha.slice(0, 7), scannedFiles: fileContents.length })
  await persistVulns(orgId, allFindings, scanId)
  await completeScan(scanId, allFindings)
  notifySlack(allFindings, { target: repo, type: 'code' }).catch(() => {})

  res.json({
    message:      `Scanned ${fileContents.length} files in ${repo}@${sha.slice(0, 7)}`,
    scannedFiles: fileContents.length,
    findings:     allFindings.length,
    critical:     allFindings.filter(f => f.severity === 'critical').length,
    high:         allFindings.filter(f => f.severity === 'high').length,
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

  const findings        = []
  const endpointResults = []
  const base            = url.replace(/\/$/, '')
  const firestore       = getFirestore()

  async function probeEndpoint(method, path, opts = {}) {
    const fullUrl = `${base}${path}`
    const issues  = []
    let status    = null
    let reachable = true

    try {
      const r = await fetch(fullUrl, {
        method, redirect: 'follow',
        headers: opts.headers || {},
        signal: AbortSignal.timeout(8000),
      })
      status = r.status

      if (path === '') {
        const REQUIRED = [
          { name:'content-security-policy',  severity:'high',   label:'Content-Security-Policy' },
          { name:'strict-transport-security', severity:'high',   label:'HSTS' },
          { name:'x-frame-options',           severity:'medium', label:'X-Frame-Options' },
          { name:'x-content-type-options',    severity:'medium', label:'X-Content-Type-Options' },
          { name:'referrer-policy',           severity:'medium', label:'Referrer-Policy' },
        ]
        for (const h of REQUIRED) {
          if (!r.headers.get(h.name)) {
            issues.push(`Missing ${h.label}`)
            findings.push({
              title:       `Missing security header: ${h.label}`,
              description: `The ${h.label} header is not set on ${base}. This exposes users to XSS, clickjacking, and data leakage attacks.`,
              fix:         `app.use(helmet()) // automatically sets all security headers`,
              category:    'Missing headers',
              severity:    h.severity,
              location:    `${base} — response headers`,
              source:      'API scan',
              checkId:     `missing-header-${h.name}`,
            })
          }
        }

        const serverHeader = r.headers.get('server') || r.headers.get('x-powered-by')
        if (serverHeader) {
          issues.push(`Discloses: ${serverHeader}`)
          findings.push({
            title:       `Server technology disclosed: ${serverHeader}`,
            description: `Your server advertises its stack (${serverHeader}). Attackers use this to find version-specific exploits.`,
            fix:         `app.disable('x-powered-by')\n// Or: app.use(helmet())`,
            category:    'Info disclosure',
            severity:    'low',
            location:    `${base} — response headers`,
            source:      'API scan',
            checkId:     'server-disclosure',
          })
        }

        const cors = r.headers.get('access-control-allow-origin')
        if (cors === '*') {
          issues.push('CORS: wildcard (*)')
          findings.push({
            title:       'CORS allows all origins (*)',
            description: 'Any website can make cross-origin requests to your API, potentially accessing authenticated data.',
            fix:         `app.use(cors({ origin: 'https://yourapp.com' }))`,
            category:    'Missing headers',
            severity:    'high',
            location:    `${base} — CORS policy`,
            source:      'API scan',
            checkId:     'cors-wildcard',
          })
        }
      }

      if (opts.expectAuth && status === 200) {
        issues.push('No auth required')
        findings.push({
          title:       `Endpoint accessible without authentication: ${method} ${path}`,
          description: `${fullUrl} returns 200 without any Authorization header. Sensitive data may be publicly exposed.`,
          fix:         `router.get('/path', authenticate, handler) // add auth middleware`,
          category:    'Broken auth',
          severity:    'high',
          location:    `${method} ${fullUrl}`,
          source:      'API scan',
          checkId:     `no-auth-${method}-${path}`,
        })
      }
    } catch (err) {
      reachable = false
      if (path === '') {
        issues.push('Unreachable')
        findings.push({
          title:       'Target unreachable',
          description: `Could not connect to ${base}: ${err.message}`,
          category:    'Connectivity',
          severity:    'medium',
          location:    base,
          source:      'API scan',
          checkId:     'unreachable',
        })
      }
    }

    endpointResults.push({
      method, path: path || '/', url: fullUrl,
      status, reachable, issues,
      severity: issues.length === 0 ? 'ok'
              : issues.some(i => i.includes('No auth')) ? 'critical'
              : 'vulnerable',
    })
  }

  if (base.startsWith('http://')) {
    findings.push({
      title:       'No HTTPS — traffic is unencrypted',
      description: 'All data including passwords and tokens is sent in plain text over HTTP.',
      fix:         'Enable HTTPS. Railway, Render, and Vercel do this automatically.',
      category:    'Missing headers',
      severity:    'critical',
      location:    base,
      source:      'API scan',
      checkId:     'no-https',
    })
  }

  await probeEndpoint('GET', '')
  await Promise.all([
    probeEndpoint('GET',  '/api/users',      { expectAuth: true }),
    probeEndpoint('GET',  '/api/admin',      { expectAuth: true }),
    probeEndpoint('GET',  '/api/admin/users',{ expectAuth: true }),
    probeEndpoint('GET',  '/health'),
    probeEndpoint('GET',  '/api/health'),
    probeEndpoint('POST', '/api/auth/login'),
    probeEndpoint('POST', '/api/auth/signup'),
  ])

  const scanId = await createScanRecord(orgId, uid, 'api', { url, endpointsProbed: endpointResults.length })
  await persistVulns(orgId, findings, scanId)
  await completeScan(scanId, findings)
  notifySlack(findings, { target: url, type: 'api' }).catch(() => {})

  // Remove old endpoints for this base URL, save new ones
  const oldSnap = await firestore.collection('endpoints')
    .where('orgId', '==', orgId).where('baseUrl', '==', base).get()
  const delBatch = firestore.batch()
  oldSnap.docs.forEach(d => delBatch.delete(d.ref))
  await delBatch.commit()

  const epBatch = firestore.batch()
  for (const ep of endpointResults) {
    epBatch.set(firestore.collection('endpoints').doc(), {
      orgId, scanId, baseUrl: base,
      method: ep.method, path: ep.path, url: ep.url,
      status: ep.status, reachable: ep.reachable,
      issues: ep.issues, severity: ep.severity,
      scannedAt: FieldValue.serverTimestamp(),
    })
  }
  await epBatch.commit()

  res.json({
    message:         `Scanned ${base} — ${endpointResults.length} endpoints probed`,
    findings:        findings.length,
    critical:        findings.filter(f => f.severity==='critical').length,
    high:            findings.filter(f => f.severity==='high').length,
    endpointsProbed: endpointResults.length,
    details:         findings,
    endpoints:       endpointResults,
  })
}))


// ── Dependency scan ───────────────────────────────────────────────────────────
router.post('/deps', asyncHandler(async (req, res) => {
  const { repo } = z.object({ repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/) }).parse(req.body)
  const { orgId, uid } = req.user

  const octokit = createOctokit()
  const { owner, repo: repoName } = parseRepo(repo)

  // Fetch package.json via contents API
  let pkg
  try {
    const { data } = await octokit.repos.getContent({ owner, repo: repoName, path: 'package.json' })
    pkg = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'))
  } catch (err) {
    return res.status(404).json({ error: 'package.json not found in repo' })
  }
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
  notifySlack(findings, { target: repo, type: 'deps' }).catch(() => {})

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
