import crypto from 'crypto'
import type { CodeFinding } from './codeScanner'

const PROBE_TIMEOUT = 8_000

export interface EndpointResult {
  method: string
  path: string
  url: string
  status: number | null
  reachable: boolean
  issues: string[]
}

export interface ApiProbeResult {
  findings: CodeFinding[]
  endpoints: EndpointResult[]
}

// ── Security headers to check ───────────────────────────────────────────────

const REQUIRED_HEADERS: Array<{ name: string; title: string; severity: CodeFinding['severity'] }> = [
  { name: 'content-security-policy', title: 'Content-Security-Policy header missing', severity: 'high' },
  { name: 'strict-transport-security', title: 'Strict-Transport-Security (HSTS) header missing', severity: 'high' },
  { name: 'x-frame-options', title: 'X-Frame-Options header missing', severity: 'medium' },
  { name: 'x-content-type-options', title: 'X-Content-Type-Options header missing', severity: 'medium' },
  { name: 'referrer-policy', title: 'Referrer-Policy header missing', severity: 'low' },
]

const AUTH_ENDPOINTS = [
  { method: 'GET', path: '/api/users' },
  { method: 'GET', path: '/api/admin' },
  { method: 'GET', path: '/api/admin/users' },
]

const HEALTH_ENDPOINTS = [
  { method: 'GET', path: '/health' },
  { method: 'GET', path: '/api/health' },
]

// ── Main function ───────────────────────────────────────────────────────────

export async function probeApi(baseUrl: string): Promise<ApiProbeResult> {
  const findings: CodeFinding[] = []
  const endpoints: EndpointResult[] = []

  // Check HTTPS
  if (baseUrl.startsWith('http://')) {
    findings.push(makeFinding(
      'no-https',
      'No HTTPS — traffic is unencrypted',
      'The target URL uses HTTP instead of HTTPS. All traffic is transmitted in plain text.',
      'Switch to HTTPS and enforce HSTS.',
      'Transport security',
      'critical',
      baseUrl,
    ))
  }

  // Probe root URL
  let rootRes: { status: number; headers: { get(name: string): string | null } } | null = null
  try {
    rootRes = await fetchWithTimeout(baseUrl)
  } catch {
    findings.push(makeFinding(
      'unreachable',
      'Target unreachable',
      `Could not connect to ${baseUrl}.`,
      'Verify the URL is correct and the server is running.',
      'Connectivity',
      'info',
      baseUrl,
    ))
    return { findings, endpoints }
  }

  endpoints.push({
    method: 'GET',
    path: '/',
    url: baseUrl,
    status: rootRes.status,
    reachable: true,
    issues: [],
  })

  // Check security headers
  for (const header of REQUIRED_HEADERS) {
    if (!rootRes.headers.get(header.name)) {
      findings.push(makeFinding(
        `missing-${header.name}`,
        header.title,
        `The ${header.name} header is not set on the root URL.`,
        `Add the ${header.name} header to your server responses.`,
        'Missing headers',
        header.severity,
        baseUrl,
      ))
    }
  }

  // Check server technology disclosure
  const server = rootRes.headers.get('server')
  const poweredBy = rootRes.headers.get('x-powered-by')
  if (server) {
    findings.push(makeFinding(
      'server-disclosure',
      `Server header discloses technology: ${server}`,
      'The Server header reveals server software and version, aiding attackers.',
      'Remove or generalize the Server header.',
      'Information disclosure',
      'low',
      baseUrl,
    ))
  }
  if (poweredBy) {
    findings.push(makeFinding(
      'powered-by-disclosure',
      `X-Powered-By header discloses technology: ${poweredBy}`,
      'The X-Powered-By header reveals the framework in use.',
      'Remove the X-Powered-By header.',
      'Information disclosure',
      'low',
      baseUrl,
    ))
  }

  // Check CORS
  const cors = rootRes.headers.get('access-control-allow-origin')
  if (cors === '*') {
    findings.push(makeFinding(
      'cors-wildcard',
      'CORS wildcard (*) allows any origin',
      'Access-Control-Allow-Origin is set to *, allowing any website to make requests.',
      'Restrict CORS to specific trusted origins.',
      'CORS Misconfiguration',
      'high',
      baseUrl,
    ))
  }

  // Probe auth endpoints (unauthenticated)
  for (const ep of AUTH_ENDPOINTS) {
    const url = `${baseUrl.replace(/\/$/, '')}${ep.path}`
    try {
      const res = await fetchWithTimeout(url)
      const result: EndpointResult = {
        method: ep.method,
        path: ep.path,
        url,
        status: res.status,
        reachable: true,
        issues: [],
      }
      if (res.status === 200) {
        result.issues.push('Returns 200 without authentication')
        findings.push(makeFinding(
          `unauth-${ep.path}`,
          `${ep.path} accessible without authentication`,
          `The endpoint ${ep.path} returns 200 without any authentication headers, suggesting broken access control.`,
          `Require authentication for ${ep.path}.`,
          'Broken access control',
          'high',
          url,
        ))
      }
      endpoints.push(result)
    } catch {
      endpoints.push({
        method: ep.method,
        path: ep.path,
        url,
        status: null,
        reachable: false,
        issues: [],
      })
    }
  }

  // Probe health endpoints
  for (const ep of HEALTH_ENDPOINTS) {
    const url = `${baseUrl.replace(/\/$/, '')}${ep.path}`
    try {
      const res = await fetchWithTimeout(url)
      endpoints.push({
        method: ep.method,
        path: ep.path,
        url,
        status: res.status,
        reachable: true,
        issues: [],
      })
    } catch {
      endpoints.push({
        method: ep.method,
        path: ep.path,
        url,
        status: null,
        reachable: false,
        issues: [],
      })
    }
  }

  return { findings, endpoints }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT) })
}

function makeFinding(
  checkId: string,
  title: string,
  description: string,
  fix: string,
  category: string,
  severity: CodeFinding['severity'],
  location: string,
): CodeFinding {
  const locationHash = crypto
    .createHash('sha256')
    .update(`${location}:${checkId}`)
    .digest('hex')
    .slice(0, 16)

  return {
    id: `api-${crypto.randomBytes(4).toString('hex')}`,
    checkId: `api:${checkId}`,
    locationHash,
    title,
    description,
    fix,
    category,
    severity,
    location,
    codeSnippet: '',
    source: 'API probe',
  }
}
