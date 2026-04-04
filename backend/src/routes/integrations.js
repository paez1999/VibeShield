import { Router } from 'express'
import { z } from 'zod'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { authenticate } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { scanGitHubRepo, scanText } from '../services/secretScanner.js'
import { scoreAll, scoreIntegration } from '../services/riskScorer.js'

const router = Router()
router.use(authenticate)

const db = () => getFirestore()

const ScanGitHubSchema = z.object({
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'Format: owner/repo'),
  ref: z.string().default('main'),
})
const ScanTextSchema = z.object({
  content: z.string().min(1),
  filename: z.string().default('pasted-content'),
})

// ── Helpers ───────────────────────────────────────────────────────────────────

async function persistFindings(orgId, findings) {
  if (!findings.length) return
  const firestore = db()
  const batch = firestore.batch()
  for (const f of findings) {
    const ref = firestore.collection('secrets_found').doc()
    batch.set(ref, {
      orgId,
      secretType: f.type,
      secretHash: f.hash,
      location: f.location,
      severity: f.severity,
      remediated: false,
      discoveredAt: FieldValue.serverTimestamp(),
    })
  }
  await batch.commit()
}

async function auditLog(orgId, uid, action, meta = {}) {
  await db().collection('audit_log').add({
    orgId, uid, action, meta,
    createdAt: FieldValue.serverTimestamp(),
  })
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /integrations
router.get('/', asyncHandler(async (req, res) => {
  const { orgId } = req.user
  const snap = await db().collection('integrations')
    .where('orgId', '==', orgId).get()

  const integrations = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const scored = scoreAll(integrations.map((i) => ({
    ...i,
    usedScopes: i.usedScopes || [],
    lastRotated: i.lastRotated?.toDate() || null,
    secretsFound: 0,
  })))
  res.json({ data: scored })
}))

// GET /integrations/secrets/open
// Avoid compound index by filtering in-memory after single where clause
router.get('/secrets/open', asyncHandler(async (req, res) => {
  const { orgId } = req.user
  const snap = await db().collection('secrets_found')
    .where('orgId', '==', orgId)
    .get()

  // Filter and sort in memory — avoids needing a composite Firestore index
  const data = snap.docs
    .map((d) => ({ id: d.id, ...d.data(), discovered_at: d.data().discoveredAt?.toDate(), secret_type: d.data().secretType }))
    .filter((d) => d.remediated === false)
    .sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      const sa = severityOrder[a.severity] ?? 4
      const sb = severityOrder[b.severity] ?? 4
      if (sa !== sb) return sa - sb
      return (b.discovered_at || 0) - (a.discovered_at || 0)
    })

  res.json({ data, count: data.length })
}))

// POST /integrations/scan/github
router.post('/scan/github', asyncHandler(async (req, res) => {
  const { repo, ref } = ScanGitHubSchema.parse(req.body)
  const { orgId, uid } = req.user

  const result = await scanGitHubRepo(repo, ref)
  await persistFindings(orgId, result.findings)
  await auditLog(orgId, uid, 'github_scan', { repo, ref, scannedFiles: result.scannedFiles, findingsCount: result.findings.length })

  res.json({
    message: `Scanned ${result.scannedFiles} files in ${repo}@${result.commit}`,
    findings: result.findings.length,
    critical: result.findings.filter((f) => f.severity === 'critical').length,
    high: result.findings.filter((f) => f.severity === 'high').length,
    details: result.findings,
  })
}))

// POST /integrations/scan/text
router.post('/scan/text', asyncHandler(async (req, res) => {
  const { content, filename } = ScanTextSchema.parse(req.body)
  const { orgId } = req.user
  const findings = scanText(content, filename)
  await persistFindings(orgId, findings)
  res.json({ findings: findings.length, details: findings })
}))

// GET /integrations/:type
router.get('/:type', asyncHandler(async (req, res) => {
  const { orgId } = req.user
  const snap = await db().collection('integrations')
    .where('orgId', '==', orgId)
    .where('type', '==', req.params.type)
    .limit(1).get()

  if (snap.empty) return res.status(404).json({ error: 'Integration not found' })

  const docData = { id: snap.docs[0].id, ...snap.docs[0].data() }
  const scored = scoreIntegration({
    type: docData.type, scopes: docData.scopes || [],
    usedScopes: docData.usedScopes || [],
    lastRotated: docData.lastRotated?.toDate() || null,
    secretsFound: 0,
  })

  // Get recent secrets for this org without compound index
  const secretsSnap = await db().collection('secrets_found')
    .where('orgId', '==', orgId).get()

  const recentSecrets = secretsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((d) => d.secretType?.includes(docData.type))
    .sort((a, b) => (b.discoveredAt?.toMillis() || 0) - (a.discoveredAt?.toMillis() || 0))
    .slice(0, 10)

  res.json({ data: { ...docData, ...scored, recentSecrets } })
}))

// PATCH /integrations/:id/rotate
router.patch('/:id/rotate', asyncHandler(async (req, res) => {
  const { orgId, uid } = req.user
  const ref = db().collection('integrations').doc(req.params.id)
  const snap = await ref.get()
  if (!snap.exists || snap.data().orgId !== orgId) {
    return res.status(404).json({ error: 'Integration not found' })
  }
  await ref.update({ lastRotated: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  await auditLog(orgId, uid, 'integration_rotated', { integrationId: req.params.id })
  res.json({ data: { id: snap.id, ...snap.data() } })
}))

// PATCH /integrations/secrets/:id/remediate
router.patch('/secrets/:id/remediate', asyncHandler(async (req, res) => {
  const { orgId, uid } = req.user
  const ref = db().collection('secrets_found').doc(req.params.id)
  const snap = await ref.get()
  if (!snap.exists || snap.data().orgId !== orgId) {
    return res.status(404).json({ error: 'Secret not found' })
  }
  await ref.update({ remediated: true, remediatedAt: FieldValue.serverTimestamp() })
  await auditLog(orgId, uid, 'secret_remediated', { secretId: req.params.id })
  res.json({ data: { id: snap.id, ...snap.data() } })
}))

export default router