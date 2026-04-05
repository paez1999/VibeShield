const HIBP_BASE = 'https://haveibeenpwned.com/api/v3'

const hibpHeaders = () => {
  if (!process.env.HIBP_API_KEY) {
    throw Object.assign(new Error('HIBP_API_KEY not configured'), { status: 503 })
  }
  return {
    'hibp-api-key': process.env.HIBP_API_KEY,
    'user-agent': 'VibeShield/1.0',
  }
}

export async function checkEmailBreach(email) {
  const res = await fetch(
    `${HIBP_BASE}/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
    { headers: hibpHeaders() },
  )
  if (res.status === 404) return []
  if (res.status === 401) throw Object.assign(new Error('HIBP API key invalid or expired'), { status: 401 })
  if (res.status === 429) throw Object.assign(new Error('HIBP rate limited — retry in a moment'), { status: 429 })
  if (!res.ok) throw Object.assign(new Error(`HIBP API error ${res.status}`), { status: 502 })
  return res.json()
}

// Severity based on data classes present in the breach
export function breachSeverity(breach) {
  const dc = (breach.DataClasses || []).map((s) => s.toLowerCase())
  if (dc.some((d) => d.includes('password'))) return 'critical'
  if (breach.IsSensitive) return 'high'
  if (dc.some((d) => d.includes('financial') || d.includes('credit card') || d.includes('bank'))) return 'high'
  if (dc.some((d) => d.includes('phone') || d.includes('address') || d.includes('social security'))) return 'medium'
  return 'low'
}

// Batch-check up to 20 emails, respecting HIBP's 1.5 req/s rate limit
export async function checkBulkBreaches(emails) {
  const results = []

  for (const email of emails) {
    try {
      const breaches = await checkEmailBreach(email)
      const annotated = breaches.map((b) => ({ ...b, severity: breachSeverity(b) }))
      results.push({
        email,
        pwned: breaches.length > 0,
        breachCount: breaches.length,
        breaches: annotated,
      })
    } catch (err) {
      if (err.status === 429) {
        // Back off 2s and retry once
        await new Promise((r) => setTimeout(r, 2000))
        try {
          const breaches = await checkEmailBreach(email)
          const annotated = breaches.map((b) => ({ ...b, severity: breachSeverity(b) }))
          results.push({ email, pwned: breaches.length > 0, breachCount: breaches.length, breaches: annotated })
        } catch {
          results.push({ email, error: 'Rate limited', pwned: false, breachCount: 0, breaches: [] })
        }
      } else {
        results.push({ email, error: err.message, pwned: false, breachCount: 0, breaches: [] })
      }
    }

    // HIBP allows max 1 req/1.5s — stay safely under
    await new Promise((r) => setTimeout(r, 750))
  }

  return results
}
