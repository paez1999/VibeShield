import { describe, it, expect } from 'vitest'
import { runSemgrep, guessCategory, deduplicateFindings } from '@/domain/services/semgrepScanner'
import type { CodeFinding } from '@/domain/services/codeScanner'

describe('guessCategory', () => {
  it('maps SQL injection check IDs', () => {
    expect(guessCategory('python.lang.security.audit.sqli.sql-injection')).toBe('SQL Injection')
  })
  it('maps XSS check IDs', () => {
    expect(guessCategory('javascript.browser.security.xss.cross-site-scripting')).toBe('XSS')
  })
  it('maps command injection check IDs', () => {
    expect(guessCategory('python.lang.security.audit.command-injection')).toBe('Command Injection')
  })
  it('maps path traversal check IDs', () => {
    expect(guessCategory('python.lang.security.audit.path-traversal')).toBe('Path Traversal')
  })
  it('maps SSRF check IDs', () => {
    expect(guessCategory('python.lang.security.audit.ssrf.request')).toBe('SSRF')
  })
  it('returns default for unknown check IDs', () => {
    expect(guessCategory('some.random.rule')).toBe('Code vulnerability')
  })
})

describe('runSemgrep', () => {
  it('returns empty array when no files provided', async () => {
    const result = await runSemgrep([])
    expect(result).toEqual([])
  })
})

describe('deduplicateFindings', () => {
  const makeFinding = (location: string, category: string, source: string): CodeFinding => ({
    id: 'test-id',
    checkId: 'test-check',
    locationHash: 'hash123',
    title: 'Test finding',
    description: 'desc',
    fix: 'fix it',
    category,
    severity: 'high',
    location,
    codeSnippet: 'code',
    source,
  })

  it('keeps Semgrep finding when both report same location+category', () => {
    const regex = [makeFinding('app.js:10', 'SQL Injection', 'Code scan')]
    const semgrep = [makeFinding('app.js:10', 'SQL Injection', 'Semgrep')]

    const result = deduplicateFindings(regex, semgrep)
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('Semgrep')
  })

  it('keeps both when location or category differ', () => {
    const regex = [makeFinding('app.js:10', 'XSS', 'Code scan')]
    const semgrep = [makeFinding('app.js:20', 'SQL Injection', 'Semgrep')]

    const result = deduplicateFindings(regex, semgrep)
    expect(result).toHaveLength(2)
  })

  it('returns empty when both inputs are empty', () => {
    expect(deduplicateFindings([], [])).toEqual([])
  })
})
