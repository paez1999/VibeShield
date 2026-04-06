import { describe, it, expect, vi, beforeEach } from 'vitest'
import { probeApi } from '@/domain/services/apiProber'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeHeaders(map: Record<string, string> = {}) {
  return { get: (name: string) => map[name.toLowerCase()] ?? null }
}

describe('probeApi', () => {
  beforeEach(() => mockFetch.mockReset())

  it('flags missing security headers', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: makeHeaders({}),
    })
    const result = await probeApi('https://example.com')
    const headerFindings = result.findings.filter(f => f.category === 'Missing headers')
    expect(headerFindings.length).toBeGreaterThanOrEqual(1)
  })

  it('flags HTTP (no HTTPS)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: makeHeaders({}),
    })
    const result = await probeApi('http://example.com')
    const httpsFindings = result.findings.filter(f => f.title.includes('HTTPS'))
    expect(httpsFindings.length).toBeGreaterThanOrEqual(1)
    expect(httpsFindings[0].severity).toBe('critical')
  })

  it('flags CORS wildcard', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: makeHeaders({ 'access-control-allow-origin': '*' }),
    })
    const result = await probeApi('https://example.com')
    const corsFindings = result.findings.filter(f => f.title.includes('CORS'))
    expect(corsFindings.length).toBeGreaterThanOrEqual(1)
  })

  it('flags server technology disclosure', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: makeHeaders({
        server: 'Apache/2.4.51',
        'x-powered-by': 'Express',
      }),
    })
    const result = await probeApi('https://example.com')
    const disclosureFindings = result.findings.filter(f => f.category === 'Information disclosure')
    expect(disclosureFindings.length).toBeGreaterThanOrEqual(1)
  })

  it('handles unreachable target', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const result = await probeApi('https://down.example.com')
    expect(result.findings.some(f => f.category === 'Connectivity')).toBe(true)
  })

  it('returns endpoint probe results', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: makeHeaders({
        'content-security-policy': 'default-src self',
        'strict-transport-security': 'max-age=31536000',
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin',
      }),
    })
    const result = await probeApi('https://secure.example.com')
    expect(result.endpoints.length).toBeGreaterThanOrEqual(1)
  })

  it('flags unauthenticated admin endpoints returning 200', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: makeHeaders({
        'content-security-policy': 'default-src self',
        'strict-transport-security': 'max-age=31536000',
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin',
      }),
    })
    const result = await probeApi('https://example.com')
    const authFindings = result.findings.filter(f => f.category === 'Broken access control')
    expect(authFindings.length).toBeGreaterThanOrEqual(1)
  })
})
