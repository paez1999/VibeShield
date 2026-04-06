import { Router } from 'express'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { authenticate } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = Router()
router.use(authenticate)
const db = () => getFirestore()

// GET /vulns
router.get('/', asyncHandler(async (req, res) => {
  const { orgId } = req.user
  const snap = await db().collection('vulnerabilities')
    .where('orgId', '==', orgId).get()

  const data = snap.docs
    .map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() }))
    .sort((a, b) => {
      const o = { critical:0, high:1, medium:2, low:3 }
      return (o[a.severity]||4) - (o[b.severity]||4)
    })

  res.json({ data })
}))

// PATCH /vulns/:id/resolve
router.patch('/:id/resolve', asyncHandler(async (req, res) => {
  const { orgId, uid } = req.user
  const ref = db().collection('vulnerabilities').doc(req.params.id)
  const snap = await ref.get()
  if (!snap.exists || snap.data().orgId !== orgId)
    return res.status(404).json({ error: 'Not found' })

  await ref.update({ status: 'resolved', resolvedAt: FieldValue.serverTimestamp(), resolvedBy: uid })
  res.json({ ok: true })
}))

// PATCH /vulns/:id/ignore
router.patch('/:id/ignore', asyncHandler(async (req, res) => {
  const { orgId } = req.user
  const ref = db().collection('vulnerabilities').doc(req.params.id)
  const snap = await ref.get()
  if (!snap.exists || snap.data().orgId !== orgId)
    return res.status(404).json({ error: 'Not found' })

  await ref.update({ status: 'ignored' })
  res.json({ ok: true })
}))

// POST /vulns/bulk  { ids: string[], action: 'resolve'|'ignore' }
router.post('/bulk', asyncHandler(async (req, res) => {
  const { orgId, uid } = req.user
  const { ids, action } = req.body ?? {}

  if (!Array.isArray(ids) || !ids.length)
    return res.status(400).json({ error: 'ids must be a non-empty array' })
  if (!['resolve', 'ignore'].includes(action))
    return res.status(400).json({ error: 'action must be resolve or ignore' })

  const firestore  = db()
  const update     = action === 'resolve'
    ? { status: 'resolved', resolvedAt: FieldValue.serverTimestamp(), resolvedBy: uid }
    : { status: 'ignored' }

  // Firestore batch write limit is 500
  const chunks = []
  for (let i = 0; i < ids.length; i += 500) chunks.push(ids.slice(i, i + 500))

  let updated = 0
  for (const chunk of chunks) {
    const batch = firestore.batch()
    for (const id of chunk) {
      const ref  = firestore.collection('vulnerabilities').doc(id)
      const snap = await ref.get()
      if (snap.exists && snap.data().orgId === orgId) {
        batch.update(ref, update)
        updated++
      }
    }
    await batch.commit()
  }

  res.json({ ok: true, updated })
}))

export default router
