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
  ref:  z.string().default('main'),
})
const ScanTextSchema = z.object({
  content:  z.string().min(1),
  filename: z.string().default('pasted-content'),
})

// ── Helpers ──────────────────────────────────────────────────────────────────

async function persistFindings(orgId, findings) {
  if (!findings.length) return
  const firestore = db()
  const batch = firestore.batch()
  for (const f of findings) {
    const ref = firestore.collection('secrets_found').doc()
    batch.set(ref, {
      orgId,
      secretType:   f.type,
      secretHash:   f.hash,
      location:     f.location,
      severity:     f.severity,
      remediated:   false,
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

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /integrations
router.get('/', asyncHandler(async (req, res) => {
  const { orgId } = req.user
  const snap = await db().collection('integrations')
    .where('orgId', '==', orgId).get()

  const integrations = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const scored = scoreAll(integrations.map((i) => ({
    ...i,
    usedScopes:  i.usedScopes  || [],
    lastRotated: i.lastRotated?.toDate() || null,
    secretsFound: 0,
  })))
  res.json({ data: scored })
}))

// GET /integrations/secrets/open
router.get('/secrets/open', asyncHandler(async (req, res) => {
  const { orgId } = req.user
  const snap = await db().collection('secrets_found')
    .where('orgId', '==', orgId)
    .where('remediated', '==', false)
    .orderBy('discoveredAt', 'desc')
    .get()

  const data = snap.docs.map((d) => ({ id: d.id, ...d.data(),
    discovered_at: d.data().discoveredAt?.toDate(),
    secret_type:   d.data().secretType,
  }))
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
    message:  `Scanned ${result.scannedFiles} files in ${repo}@${result.commit}`,
    findings: result.findings.length,
    critical: result.findings.filter((f) => f.severity === 'critical').length,
    high:     result.findings.filter((f) => f.severity === 'high').length,
    details:  result.findings,
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

  const doc  = snap.docs[0]
  const data = { id: doc.id, ...doc.data() }
  const scored = scoreIntegration({
    type: data.type, scopes: data.scopes || [],
    usedScopes: data.usedScopes || [],
    lastRotated: data.lastRotated?.toDate() || null,
    secretsFound: 0,
  })

  const secretsSnap = await db().collection('secrets_found')
    .where('orgId', '==', orgId)
    .where('secretType', '>=', data.type)
    .orderBy('secretType').orderBy('discoveredAt', 'desc')
    .limit(10).get()

  res.json({ data: { ...data, ...scored, recentSecrets: secretsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) } })
}))

// PATCH /integrations/:id/rotate
router.patch('/:id/rotate', asyncHandler(async (req, res) => {
  const { orgId, uid } = req.user
  const ref = db().collection('integrations').doc(req.params.id)
  const doc = await ref.get()
  if (!doc.exists || doc.data().orgId !== orgId) {
    return res.status(404).json({ error: 'Integration not found' })
  }
  await ref.update({ lastRotated: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  await auditLog(orgId, uid, 'integration_rotated', { integrationId: req.params.id })
  res.json({ data: { id: doc.id, ...doc.data() } })
}))

// PATCH /integrations/secrets/:id/remediate
router.patch('/secrets/:id/remediate', asyncHandler(async (req, res) => {
  const { orgId, uid } = req.user
  const ref = db().collection('secrets_found').doc(req.params.id)
  const doc = await ref.get()
  if (!doc.exists || doc.data().orgId !== orgId) {
    return res.status(404).json({ error: 'Secret not found' })
  }
  await ref.update({ remediated: true, remediatedAt: FieldValue.serverTimestamp() })
  await auditLog(orgId, uid, 'secret_remediated', { secretId: req.params.id })
  res.json({ data: { id: doc.id, ...doc.data() } })
}))

export default router
