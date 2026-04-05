import { Router } from 'express'
import { z } from 'zod'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { authenticate } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { checkBulkBreaches } from '../services/hibpChecker.js'
import { recordLoginAttempt, getStuffingAlerts } from '../services/stuffingDetector.js'

const router = Router()
router.use(authenticate)

const db = () => getFirestore()

async function auditLog(orgId, uid, action, meta = {}) {
  await db().collection('audit_log').add({
    orgId, uid, action, meta,
    createdAt: FieldValue.serverTimestamp(),
  })
}

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /credentials/check-breaches
// Body: { emails: string[] }  (max 20)
router.post('/check-breaches', asyncHandler(async (req, res) => {
  const { emails } = z.object({
    emails: z.array(z.string().email()).min(1).max(20),
  }).parse(req.body)

  const { orgId, uid } = req.user
  const results = await checkBulkBreaches(emails)

  // Persist new breach findings to Firestore
  const pwned = results.filter((r) => r.pwned && r.breaches.length > 0)
  if (pwned.length > 0) {
    const firestore = db()
    const batch = firestore.batch()
    for (const r of pwned) {
      for (const b of r.breaches) {
        const ref = firestore.collection('breach_findings').doc()
        batch.set(ref, {
          orgId,
          email:       r.email,
          breachName:  b.Name,
          domain:      b.Domain,
          breachDate:  b.BreachDate,
          pwnCount:    b.PwnCount,
          dataClasses: b.DataClasses,
          isVerified:  b.IsVerified,
          isSensitive: b.IsSensitive,
          severity:    b.severity,
          remediated:  false,
          discoveredAt: FieldValue.serverTimestamp(),
        })
      }
    }
    await batch.commit()
  }

  await auditLog(orgId, uid, 'breach_check', {
    emailCount:  emails.length,
    pwnedCount:  pwned.length,
  })

  res.json({ results, pwnedCount: pwned.length })
}))

// GET /credentials/breach-findings
// Returns all un-remediated breach findings for the org
router.get('/breach-findings', asyncHandler(async (req, res) => {
  const { orgId } = req.user
  const snap = await db().collection('breach_findings')
    .where('orgId', '==', orgId)
    .get()

  const data = snap.docs
    .map((d) => ({ id: d.id, ...d.data(), discoveredAt: d.data().discoveredAt?.toDate() }))
    .filter((d) => !d.remediated)
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 }
      return (order[a.severity] ?? 4) - (order[b.severity] ?? 4)
    })

  res.json({ data, count: data.length })
}))

// PATCH /credentials/breach-findings/:id/remediate
router.patch('/breach-findings/:id/remediate', asyncHandler(async (req, res) => {
  const { orgId, uid } = req.user
  const ref  = db().collection('breach_findings').doc(req.params.id)
  const snap = await ref.get()
  if (!snap.exists || snap.data().orgId !== orgId) {
    return res.status(404).json({ error: 'Finding not found' })
  }
  await ref.update({ remediated: true, remediatedAt: FieldValue.serverTimestamp() })
  await auditLog(orgId, uid, 'breach_remediated', { findingId: req.params.id })
  res.json({ ok: true })
}))

// POST /credentials/login-event
// Called from frontend after each login attempt to feed stuffing detection
router.post('/login-event', asyncHandler(async (req, res) => {
  const { ip, uid, email, success } = z.object({
    ip:      z.string().min(1),
    uid:     z.string().optional(),
    email:   z.string().email().optional(),
    success: z.boolean(),
  }).parse(req.body)

  await recordLoginAttempt({ orgId: req.user.orgId, ip, uid, email, success })
  res.json({ ok: true })
}))

// GET /credentials/stuffing-alerts
router.get('/stuffing-alerts', asyncHandler(async (req, res) => {
  const alerts = await getStuffingAlerts(req.user.orgId)
  res.json({ data: alerts, count: alerts.length })
}))

// GET /credentials/users
// Lists all org users with Firebase Auth metadata (MFA status, last sign-in)
router.get('/users', asyncHandler(async (req, res) => {
  const { orgId } = req.user
  const snap = await db().collection('users').where('orgId', '==', orgId).get()
  const users = snap.docs.map((d) => ({ uid: d.id, ...d.data() }))

  const enriched = await Promise.all(users.map(async (u) => {
    try {
      const authUser = await getAuth().getUser(u.uid)
      return {
        uid:         u.uid,
        email:       u.email,
        role:        u.role,
        mfaEnrolled: (authUser.multiFactor?.enrolledFactors?.length ?? 0) > 0,
        disabled:    authUser.disabled,
        lastSignIn:  authUser.metadata.lastSignInTime || null,
        createdAt:   u.createdAt?.toDate?.() || null,
      }
    } catch {
      return { uid: u.uid, email: u.email, role: u.role, mfaEnrolled: false, disabled: false }
    }
  }))

  res.json({ data: enriched })
}))

// POST /credentials/force-reset/:uid
// Revokes all refresh tokens (forces re-auth) and returns a password-reset link
router.post('/force-reset/:uid', asyncHandler(async (req, res) => {
  const { orgId, uid: callerUid } = req.user
  const targetUid = req.params.uid

  // Verify target user belongs to the same org
  const userDoc = await db().collection('users').doc(targetUid).get()
  if (!userDoc.exists || userDoc.data().orgId !== orgId) {
    return res.status(404).json({ error: 'User not found in this org' })
  }

  const authUser = await getAuth().getUser(targetUid)

  // Invalidate all active sessions immediately
  await getAuth().revokeRefreshTokens(targetUid)

  // Generate password-reset link (does not send email — admin can share it)
  const resetLink = await getAuth().generatePasswordResetLink(authUser.email)

  await auditLog(orgId, callerUid, 'force_password_reset', {
    targetUid,
    targetEmail: authUser.email,
  })

  res.json({ ok: true, email: authUser.email, resetLink })
}))

export default router
