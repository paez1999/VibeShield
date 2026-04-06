import { Router }                    from 'express'
import { createHmac, timingSafeEqual, randomBytes } from 'crypto'
import { getFirestore, FieldValue }  from 'firebase-admin/firestore'
import { authenticate }                         from '../middleware/auth.js'
import { asyncHandler }                         from '../middleware/errorHandler.js'
import { scanFiles }                            from '../services/codeScanner.js'
import { scanText as scanSecrets }              from '../services/secretScanner.js'
import { runSemgrep }                           from '../services/semgrepScanner.js'
import { fetchRepoFiles, parseRepo }            from '../services/githubClient.js'
import { notifySlack }                          from '../services/notifyService.js'

const router = Router()
const db     = () => getFirestore()

const SKIP      = /node_modules|\.git|dist\/|build\/|\.png$|\.jpg$|\.gif$|\.ico$|\.lock$|\.min\.js$/i
const FETCH     = /\.(js|jsx|ts|tsx|py|rb|php|go|java|cs|env|json|ya?ml|toml|tf|sh|config)$|^\.env|Dockerfile/i
const SECRET_RE = /\.(env|json|ya?ml|toml|tf|sh|config)$|^\.env|Dockerfile/i

// ── Authenticated CRUD ────────────────────────────────────────────────────────

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { orgId } = req.user
  const snap = await db().collection('webhooks').where('orgId', '==', orgId).get()
  res.json({ data: snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() })) })
}))

router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { repo } = req.body ?? {}
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo))
    return res.status(400).json({ error: 'Invalid repo (expected owner/repo)' })

  const { orgId, uid } = req.user
  const secret = randomBytes(20).toString('hex')

  const ref = await db().collection('webhooks').add({
    orgId, uid, repo, secret,
    active:    true,
    createdAt: FieldValue.serverTimestamp(),
  })

  res.status(201).json({ id: ref.id, repo, secret })
}))

router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const { orgId } = req.user
  const doc = await db().collection('webhooks').doc(req.params.id).get()
  if (!doc.exists || doc.data().orgId !== orgId)
    return res.status(404).json({ error: 'Webhook not found' })
  await doc.ref.delete()
  res.json({ ok: true })
}))

// ── Public GitHub webhook receiver ────────────────────────────────────────────

router.post('/github', asyncHandler(async (req, res) => {
  const event     = req.headers['x-github-event']
  const sigHeader = req.headers['x-hub-signature-256']
  const rawBody   = req.rawBody   // captured in index.js via express.json verify

  if (!sigHeader || !rawBody)
    return res.status(400).json({ error: 'Missing signature or body' })

  // Only act on push events — ack everything else silently
  if (event !== 'push') return res.json({ ok: true, skipped: true })

  const payload      = JSON.parse(rawBody.toString('utf8'))
  const repoFullName = payload.repository?.full_name
  if (!repoFullName) return res.status(400).json({ error: 'Missing repository info' })

  // Lookup webhook config by repo
  const snap = await db().collection('webhooks')
    .where('repo', '==', repoFullName)
    .where('active', '==', true)
    .limit(1).get()

  if (snap.empty)
    return res.status(404).json({ error: 'No active webhook for this repo' })

  const data = snap.docs[0].data()

  // Verify HMAC — use timingSafeEqual to prevent timing attacks
  const expected = 'sha256=' + createHmac('sha256', data.secret).update(rawBody).digest('hex')
  try {
    const a = Buffer.from(sigHeader)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b))
      return res.status(401).json({ error: 'Invalid signature' })
  } catch {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  // Respond immediately — scan runs in background
  res.json({ ok: true, repo: repoFullName, ref: payload.after?.slice(0, 7) })

  triggerScan(data, payload).catch(err =>
    console.error(`[webhook] scan failed for ${repoFullName}:`, err.message)
  )
}))

// ── Background scan (fires after 200 is sent) ─────────────────────────────────

async function triggerScan(webhook, payload) {
  const { orgId, uid, repo } = webhook
  const commitSha = payload.after
  const branch    = payload.ref?.replace('refs/heads/', '') ?? 'main'
  const firestore = db()

  const { owner, repo: repoName } = parseRepo(repo)

  // One tarball download replaces getTree + N×getBlob (1 API call instead of ≤151)
  let fileContents
  try {
    fileContents = await fetchRepoFiles(owner, repoName, commitSha, {
      skip: SKIP, relevant: FETCH, maxFiles: 150,
    })
  } catch (err) {
    console.warn('[webhook] failed to fetch files:', err.message)
    return
  }

  // Create scan record
  const scanRef = await firestore.collection('scans').add({
    orgId, uid, type: 'code',
    meta: { repo, ref: commitSha.slice(0, 7), branch, trigger: 'webhook', scannedFiles: fileContents.length },
    status:    'running',
    startedAt: FieldValue.serverTimestamp(),
  })

  // Run scanners in parallel
  const [regexFindings, semgrepFindings] = await Promise.all([
    Promise.resolve(scanFiles(fileContents)),
    runSemgrep(fileContents),
  ])

  const semgrepKeys  = new Set(semgrepFindings.map(f => `${f.location}|${f.category}`))
  const codeFindings = [
    ...semgrepFindings,
    ...regexFindings.filter(f => !semgrepKeys.has(`${f.location}|${f.category}`)),
  ]
  const secretFindings = fileContents
    .filter(f => SECRET_RE.test(f.path))
    .flatMap(f => scanSecrets(f.content, f.path).map(s => ({
      title:       `Secret exposed: ${s.type}`,
      description: `A ${s.type} was found hardcoded in your source code.`,
      fix:         'Move this value to an environment variable and rotate it immediately.',
      category:    'Secret exposed', severity: s.severity,
      location:    s.location, source: 'Code scan',
    })))

  const all = [...codeFindings, ...secretFindings]

  if (all.length) {
    const batch = firestore.batch()
    for (const f of all) {
      batch.set(firestore.collection('vulnerabilities').doc(), {
        orgId, scanId: scanRef.id, status: 'open',
        title: f.title, description: f.description, fix: f.fix || null,
        category: f.category, severity: f.severity,
        location: f.location || null, codeSnippet: f.codeSnippet || null,
        source: f.source || 'Code scan',
        createdAt: FieldValue.serverTimestamp(),
      })
    }
    await batch.commit()
  }

  await scanRef.update({
    status: 'complete', findings: all.length,
    completedAt: FieldValue.serverTimestamp(),
  })
  notifySlack(all, { target: repo, type: 'webhook' }).catch(() => {})

  console.log(`[webhook] ${repo}@${commitSha.slice(0, 7)} — ${all.length} findings (branch: ${branch})`)
}

export default router
