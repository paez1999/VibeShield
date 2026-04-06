import { describe, it, expect } from 'vitest'
import { scanSecrets } from '@/domain/services/secretScanner'
import { readFileSync } from 'fs'
import path from 'path'

const fixtures = path.join(__dirname, '../../fixtures')

describe('scanSecrets', () => {
  it('detects AWS access key', () => {
    const content = readFileSync(path.join(fixtures, 'secrets-sample.txt'), 'utf8')
    const findings = scanSecrets(content, '.env')
    const aws = findings.filter(f => f.type === 'aws_access_key')
    expect(aws.length).toBeGreaterThanOrEqual(1)
    expect(aws[0].severity).toBe('critical')
  })

  it('detects GitHub token', () => {
    const content = readFileSync(path.join(fixtures, 'secrets-sample.txt'), 'utf8')
    const findings = scanSecrets(content, '.env')
    const gh = findings.filter(f => f.type === 'github_token')
    expect(gh.length).toBeGreaterThanOrEqual(1)
  })

  it('detects Stripe secret key', () => {
    const content = readFileSync(path.join(fixtures, 'secrets-sample.txt'), 'utf8')
    const findings = scanSecrets(content, '.env')
    const stripe = findings.filter(f => f.type === 'stripe_secret_key')
    expect(stripe.length).toBeGreaterThanOrEqual(1)
    expect(stripe[0].severity).toBe('critical')
  })

  it('detects database URL with credentials', () => {
    const content = readFileSync(path.join(fixtures, 'secrets-sample.txt'), 'utf8')
    const findings = scanSecrets(content, '.env')
    const db = findings.filter(f => f.type === 'database_url')
    expect(db.length).toBeGreaterThanOrEqual(1)
  })

  it('detects JWT token', () => {
    const content = readFileSync(path.join(fixtures, 'secrets-sample.txt'), 'utf8')
    const findings = scanSecrets(content, '.env')
    const jwt = findings.filter(f => f.type === 'jwt_token')
    expect(jwt.length).toBeGreaterThanOrEqual(1)
  })

  it('returns empty for clean content', () => {
    const findings = scanSecrets('const x = 42\nconst name = "hello"', 'app.js')
    expect(findings).toHaveLength(0)
  })

  it('includes location with file path and line number', () => {
    const content = 'line1\nGITHUB_TOKEN=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef01\nline3'
    const findings = scanSecrets(content, 'config.js')
    expect(findings.length).toBeGreaterThanOrEqual(1)
    expect(findings[0].location).toMatch(/config\.js:\d+/)
  })

  it('masks matched values in output', () => {
    const content = 'GITHUB_TOKEN=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef01'
    const findings = scanSecrets(content, '.env')
    expect(findings.length).toBeGreaterThanOrEqual(1)
    expect(findings[0].match).toContain('****')
    expect(findings[0].match).not.toContain('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef01')
  })
})
