import { getAuth } from 'firebase-admin/auth'

/**
 * Verifies Firebase ID token from Authorization: Bearer header.
 * Attaches { uid, orgId, email } to req.user.
 */
export async function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' })
  }

  const token = header.slice(7)
  try {
    const decoded = await getAuth().verifyIdToken(token)
    req.user = {
      uid:   decoded.uid,
      email: decoded.email,
      // orgId stored as custom claim, or fall back to uid (set during signup)
      orgId: decoded.orgId ?? decoded.uid,
    }
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}
