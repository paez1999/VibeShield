import { Router } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { authenticate } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = Router()
router.use(authenticate)
const db = () => getFirestore()

// GET /endpoints — returns endpoints discovered during API scans
router.get('/', asyncHandler(async (req, res) => {
  const { orgId } = req.user
  const snap = await db().collection('endpoints')
    .where('orgId', '==', orgId).get()
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  res.json({ data })
}))

export default router
