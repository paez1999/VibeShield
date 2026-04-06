import { describe, it, expect } from 'vitest'
import { scanDeps } from '@/domain/services/depScanner'

const VULNERABLE_PACKAGE_JSON = JSON.stringify({
  dependencies: {
    lodash: '4.17.20',       // below 4.17.21 — should flag
    axios: '0.27.2',         // below 1.6.0 — should flag
    jsonwebtoken: '8.5.1',   // below 9.0.0 — should flag (critical)
  },
  devDependencies: {
    semver: '7.5.0',         // below 7.5.2 — should flag
  },
})

const SAFE_PACKAGE_JSON = JSON.stringify({
  dependencies: {
    lodash: '4.17.21',       // exactly at fixed version — safe
    axios: '1.6.0',          // exactly at fixed version — safe
    jsonwebtoken: '9.0.1',   // above fixed version — safe
  },
})

const VULNERABLE_REQUIREMENTS_TXT = [
  'django==4.2.10',          // below 4.2.11 — should flag
  'requests==2.28.0',        // below 2.31.0 — should flag
  'pyyaml==5.4.1',           // below 6.0.1 — should flag (critical)
  'flask==2.3.3',            // above 2.3.2 — safe
].join('\n')

const SAFE_REQUIREMENTS_TXT = [
  'django==4.2.11',          // exactly at fixed version — safe
  'requests==2.31.0',        // exactly at fixed version — safe
  'pyyaml==6.0.1',           // exactly at fixed version — safe
].join('\n')

describe('scanDeps — package.json', () => {
  it('detects vulnerable npm packages', () => {
    const findings = scanDeps(VULNERABLE_PACKAGE_JSON, 'package.json')
    expect(findings.length).toBeGreaterThanOrEqual(4)
  })

  it('flags lodash prototype pollution', () => {
    const findings = scanDeps(VULNERABLE_PACKAGE_JSON, 'package.json')
    const f = findings.find(x => x.title.includes('Prototype Pollution in lodash'))
    expect(f).toBeDefined()
    expect(f!.severity).toBe('high')
    expect(f!.category).toBe('Vulnerable Dependency')
    expect(f!.source).toBe('Dependency scan')
  })

  it('flags jsonwebtoken as critical', () => {
    const findings = scanDeps(VULNERABLE_PACKAGE_JSON, 'package.json')
    const f = findings.find(x => x.title.includes('JWT verification bypass'))
    expect(f).toBeDefined()
    expect(f!.severity).toBe('critical')
  })

  it('includes version info in description', () => {
    const findings = scanDeps(VULNERABLE_PACKAGE_JSON, 'package.json')
    const f = findings.find(x => x.title.includes('Prototype Pollution in lodash'))
    expect(f!.description).toContain('installed: 4.17.20')
    expect(f!.description).toContain('fixed in: 4.17.21')
  })

  it('produces valid codeSnippet with package name and version', () => {
    const findings = scanDeps(VULNERABLE_PACKAGE_JSON, 'package.json')
    const f = findings.find(x => x.title.includes('Prototype Pollution in lodash'))
    expect(f!.codeSnippet).toBe('"lodash": "4.17.20"')
  })

  it('generates deterministic locationHash', () => {
    const findings1 = scanDeps(VULNERABLE_PACKAGE_JSON, 'package.json')
    const findings2 = scanDeps(VULNERABLE_PACKAGE_JSON, 'package.json')
    const hash1 = findings1.find(x => x.title.includes('Prototype Pollution in lodash'))!.locationHash
    const hash2 = findings2.find(x => x.title.includes('Prototype Pollution in lodash'))!.locationHash
    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(16)
  })

  it('passes safe npm packages without findings', () => {
    const findings = scanDeps(SAFE_PACKAGE_JSON, 'package.json')
    expect(findings).toHaveLength(0)
  })

  it('handles invalid JSON gracefully', () => {
    const findings = scanDeps('{ this is not json }', 'package.json')
    expect(findings).toHaveLength(0)
  })

  it('handles empty JSON object gracefully', () => {
    const findings = scanDeps('{}', 'package.json')
    expect(findings).toHaveLength(0)
  })

  it('works with path-suffixed filename', () => {
    const findings = scanDeps(VULNERABLE_PACKAGE_JSON, 'subdir/package.json')
    expect(findings.length).toBeGreaterThanOrEqual(1)
  })

  it('does not scan unrelated filenames', () => {
    const findings = scanDeps(VULNERABLE_PACKAGE_JSON, 'not-a-manifest.json')
    expect(findings).toHaveLength(0)
  })
})

describe('scanDeps — requirements.txt', () => {
  it('detects vulnerable pip packages', () => {
    const findings = scanDeps(VULNERABLE_REQUIREMENTS_TXT, 'requirements.txt')
    expect(findings.length).toBeGreaterThanOrEqual(3)
  })

  it('flags django SQL injection', () => {
    const findings = scanDeps(VULNERABLE_REQUIREMENTS_TXT, 'requirements.txt')
    const f = findings.find(x => x.title.includes('SQL Injection in Django'))
    expect(f).toBeDefined()
    expect(f!.severity).toBe('high')
    expect(f!.category).toBe('Vulnerable Dependency')
  })

  it('flags pyyaml as critical', () => {
    const findings = scanDeps(VULNERABLE_REQUIREMENTS_TXT, 'requirements.txt')
    const f = findings.find(x => x.title.includes('Arbitrary Code Execution in PyYAML'))
    expect(f).toBeDefined()
    expect(f!.severity).toBe('critical')
  })

  it('produces correct codeSnippet for pip package', () => {
    const findings = scanDeps(VULNERABLE_REQUIREMENTS_TXT, 'requirements.txt')
    const f = findings.find(x => x.title.includes('SQL Injection in Django'))
    expect(f!.codeSnippet).toBe('django==4.2.10')
  })

  it('normalizes package names to lowercase', () => {
    const manifest = 'Django==4.2.10\nPyYAML==5.4.1\n'
    const findings = scanDeps(manifest, 'requirements.txt')
    expect(findings.length).toBeGreaterThanOrEqual(2)
  })

  it('skips lines without == pin', () => {
    const manifest = 'django>=4.0\nrequests\nflask~=2.0\n'
    const findings = scanDeps(manifest, 'requirements.txt')
    expect(findings).toHaveLength(0)
  })

  it('passes safe pip packages without findings', () => {
    const findings = scanDeps(SAFE_REQUIREMENTS_TXT, 'requirements.txt')
    expect(findings).toHaveLength(0)
  })

  it('handles empty requirements.txt gracefully', () => {
    const findings = scanDeps('', 'requirements.txt')
    expect(findings).toHaveLength(0)
  })

  it('works with path-suffixed filename', () => {
    const findings = scanDeps(VULNERABLE_REQUIREMENTS_TXT, 'backend/requirements.txt')
    expect(findings.length).toBeGreaterThanOrEqual(1)
  })
})

describe('scanDeps — checkId format', () => {
  it('generates check IDs with dep: prefix', () => {
    const findings = scanDeps(VULNERABLE_PACKAGE_JSON, 'package.json')
    for (const f of findings) {
      expect(f.checkId).toMatch(/^dep:/)
    }
  })

  it('includes package name in checkId', () => {
    const findings = scanDeps(VULNERABLE_PACKAGE_JSON, 'package.json')
    const f = findings.find(x => x.title.includes('Prototype Pollution in lodash'))!
    expect(f.checkId).toContain('lodash')
  })
})
