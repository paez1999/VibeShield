import { describe, it, expect } from 'vitest'
import { scanCode } from '@/domain/services/codeScanner'
import { readFileSync } from 'fs'
import path from 'path'

const fixtures = path.join(__dirname, '../../fixtures')

describe('scanCode', () => {
  it('detects SQL injection via string concatenation', () => {
    const content = readFileSync(path.join(fixtures, 'vulnerable-js.txt'), 'utf8')
    const findings = scanCode(content, 'app.js')
    const sqlFindings = findings.filter(f => f.category === 'SQL Injection')
    expect(sqlFindings.length).toBeGreaterThanOrEqual(1)
    expect(sqlFindings[0].severity).toBe('critical')
  })

  it('detects command injection', () => {
    const content = readFileSync(path.join(fixtures, 'vulnerable-js.txt'), 'utf8')
    const findings = scanCode(content, 'app.js')
    const cmdFindings = findings.filter(f => f.category === 'Command Injection')
    expect(cmdFindings.length).toBeGreaterThanOrEqual(1)
  })

  it('detects MD5 usage', () => {
    const content = readFileSync(path.join(fixtures, 'vulnerable-js.txt'), 'utf8')
    const findings = scanCode(content, 'app.js')
    const cryptoFindings = findings.filter(f => f.checkId === 'md5-hash')
    expect(cryptoFindings.length).toBeGreaterThanOrEqual(1)
  })

  it('detects JWT decode without verify', () => {
    const content = readFileSync(path.join(fixtures, 'vulnerable-js.txt'), 'utf8')
    const findings = scanCode(content, 'app.js')
    const jwtFindings = findings.filter(f => f.checkId === 'jwt-no-verify')
    expect(jwtFindings.length).toBeGreaterThanOrEqual(1)
  })

  it('returns no findings for clean code', () => {
    const content = readFileSync(path.join(fixtures, 'clean-code.txt'), 'utf8')
    const findings = scanCode(content, 'app.js')
    expect(findings).toHaveLength(0)
  })

  it('detects Python-specific vulnerabilities in .py files', () => {
    const content = readFileSync(path.join(fixtures, 'vulnerable-py.txt'), 'utf8')
    const findings = scanCode(content, 'app.py')
    const categories = findings.map(f => f.category)
    expect(categories).toContain('Unsafe Deserialization')
    expect(categories).toContain('Command Injection')
  })

  it('skips minified files', () => {
    const findings = scanCode('eval(req.body.code)', 'bundle.min.js')
    expect(findings).toHaveLength(0)
  })

  it('includes location with file path and line number', () => {
    const content = 'line1\neval(req.body.code + "x")\nline3'
    const findings = scanCode(content, 'test.js')
    expect(findings.length).toBeGreaterThanOrEqual(1)
    expect(findings[0].location).toBe('test.js:2')
  })

  it('includes code snippet trimmed to 200 chars', () => {
    const content = 'eval(req.body.code + "x")'
    const findings = scanCode(content, 'test.js')
    expect(findings.length).toBeGreaterThanOrEqual(1)
    expect(findings[0].codeSnippet.length).toBeLessThanOrEqual(200)
  })

  it('caps findings at 100 per file to prevent runaway scanning', () => {
    const line = 'db.query("SELECT * FROM x WHERE id = \'" + req.params.id + "\'");\n'
    const content = line.repeat(200)
    const findings = scanCode(content, 'app.js')
    expect(findings.length).toBeLessThanOrEqual(100)
  })
})
