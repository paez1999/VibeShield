import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const db = () => getFirestore()

// Thresholds for flagging an IP as suspicious
const FAIL_THRESHOLD    = 10   // >10 failures from same IP in the window
const ACCOUNT_THRESHOLD = 5    // or >5 distinct accounts targeted from same IP
const WINDOW_MS         = 60 * 60 * 1000  // look at last 1h of events

export async function recordLoginAttempt({ orgId, ip, uid = null, email = null, success }) {
  await db().collection('login_events').add({
    orgId, ip, uid, email, success,
    timestamp: FieldValue.serverTimestamp(),
  })
}

export async function getStuffingAlerts(orgId) {
  const since = new Date(Date.now() - WINDOW_MS)

  // Single where clause to avoid composite index requirements
  const snap = await db().collection('login_events')
    .where('orgId', '==', orgId)
    .where('success', '==', false)
    .get()

  const events = snap.docs
    .map((d) => ({ ...d.data(), ts: d.data().timestamp?.toDate() }))
    .filter((e) => e.ts && e.ts >= since)

  // Group by IP
  const byIp = {}
  for (const e of events) {
    if (!e.ip) continue
    if (!byIp[e.ip]) {
      byIp[e.ip] = { ip: e.ip, failures: 0, accounts: new Set(), firstSeen: e.ts, lastSeen: e.ts }
    }
    byIp[e.ip].failures++
    if (e.email) byIp[e.ip].accounts.add(e.email)
    if (e.ts < byIp[e.ip].firstSeen) byIp[e.ip].firstSeen = e.ts
    if (e.ts > byIp[e.ip].lastSeen)  byIp[e.ip].lastSeen  = e.ts
  }

  return Object.values(byIp)
    .filter((x) => x.failures >= FAIL_THRESHOLD || x.accounts.size >= ACCOUNT_THRESHOLD)
    .map((x) => ({
      ip:               x.ip,
      failureCount:     x.failures,
      targetedAccounts: x.accounts.size,
      firstSeen:        x.firstSeen,
      lastSeen:         x.lastSeen,
      severity:
        x.failures >= 50 || x.accounts.size >= 20 ? 'critical'
        : x.failures >= 20 || x.accounts.size >= 10 ? 'high'
        : 'medium',
    }))
    .sort((a, b) => b.failureCount - a.failureCount)
}

// Summary stats used on the Overview card
export async function getStuffingStats(orgId) {
  const alerts = await getStuffingAlerts(orgId)
  return {
    alertCount:  alerts.length,
    critical:    alerts.filter((a) => a.severity === 'critical').length,
    high:        alerts.filter((a) => a.severity === 'high').length,
  }
}
