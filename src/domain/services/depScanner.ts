import { createHash } from 'crypto'

interface DepFinding {
  checkId: string
  locationHash: string
  title: string
  description: string
  category: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  location: string
  codeSnippet: string
  fix: string
  source: string
}

// Known vulnerable packages (curated list — same approach as V1)
const KNOWN_VULNS: Record<string, { below: string; severity: DepFinding['severity']; title: string; description: string; fix: string }[]> = {
  // npm
  'lodash': [{ below: '4.17.21', severity: 'high', title: 'Prototype Pollution in lodash', description: 'lodash before 4.17.21 is vulnerable to Prototype Pollution via the set, setWith, and zipObjectDeep functions.', fix: 'Upgrade lodash to >= 4.17.21' }],
  'minimist': [{ below: '1.2.6', severity: 'medium', title: 'Prototype Pollution in minimist', description: 'minimist before 1.2.6 is vulnerable to Prototype Pollution.', fix: 'Upgrade minimist to >= 1.2.6' }],
  'axios': [{ below: '1.6.0', severity: 'high', title: 'SSRF in axios', description: 'axios before 1.6.0 is vulnerable to Server-Side Request Forgery when used with a proxy.', fix: 'Upgrade axios to >= 1.6.0' }],
  'express': [{ below: '4.19.2', severity: 'medium', title: 'Open Redirect in express', description: 'express before 4.19.2 is vulnerable to open redirect via malformed URLs.', fix: 'Upgrade express to >= 4.19.2' }],
  'jsonwebtoken': [{ below: '9.0.0', severity: 'critical', title: 'JWT verification bypass in jsonwebtoken', description: 'jsonwebtoken before 9.0.0 allows attackers to bypass verification with specially crafted tokens.', fix: 'Upgrade jsonwebtoken to >= 9.0.0' }],
  'tar': [{ below: '6.2.1', severity: 'high', title: 'Path traversal in tar', description: 'tar before 6.2.1 allows arbitrary file creation via path traversal.', fix: 'Upgrade tar to >= 6.2.1' }],
  'semver': [{ below: '7.5.2', severity: 'medium', title: 'ReDoS in semver', description: 'semver before 7.5.2 is vulnerable to Regular Expression Denial of Service.', fix: 'Upgrade semver to >= 7.5.2' }],
  'node-fetch': [{ below: '2.6.7', severity: 'high', title: 'Exposure of Sensitive Information in node-fetch', description: 'node-fetch before 2.6.7 may expose sensitive headers on redirect to a third-party domain.', fix: 'Upgrade node-fetch to >= 2.6.7' }],
  'qs': [{ below: '6.10.3', severity: 'high', title: 'Prototype Pollution in qs', description: 'qs before 6.10.3 is vulnerable to Prototype Pollution via the __proto__ key.', fix: 'Upgrade qs to >= 6.10.3' }],
  'glob-parent': [{ below: '5.1.2', severity: 'high', title: 'ReDoS in glob-parent', description: 'glob-parent before 5.1.2 is vulnerable to Regular Expression Denial of Service.', fix: 'Upgrade glob-parent to >= 5.1.2' }],
  'path-parse': [{ below: '1.0.7', severity: 'medium', title: 'ReDoS in path-parse', description: 'path-parse before 1.0.7 is vulnerable to Regular Expression Denial of Service.', fix: 'Upgrade path-parse to >= 1.0.7' }],
  'underscore': [{ below: '1.13.6', severity: 'high', title: 'Arbitrary Code Execution in underscore', description: 'underscore before 1.13.6 allows arbitrary code execution via the template function.', fix: 'Upgrade underscore to >= 1.13.6' }],
  'shell-quote': [{ below: '1.7.3', severity: 'critical', title: 'Command Injection in shell-quote', description: 'shell-quote before 1.7.3 allows command injection via unescaped characters.', fix: 'Upgrade shell-quote to >= 1.7.3' }],
  'moment': [{ below: '2.29.4', severity: 'medium', title: 'Path Traversal in moment', description: 'moment before 2.29.4 is vulnerable to path traversal in moment.locale.', fix: 'Upgrade moment to >= 2.29.4 or migrate to dayjs/date-fns' }],
  // pip
  'django': [{ below: '4.2.11', severity: 'high', title: 'SQL Injection in Django', description: 'Django before 4.2.11 is vulnerable to SQL injection in certain query constructs.', fix: 'Upgrade Django to >= 4.2.11' }],
  'flask': [{ below: '2.3.2', severity: 'medium', title: 'Information Disclosure in Flask', description: 'Flask before 2.3.2 may expose debug information in production.', fix: 'Upgrade Flask to >= 2.3.2' }],
  'requests': [{ below: '2.31.0', severity: 'medium', title: 'Information Leak in requests', description: 'requests before 2.31.0 may leak Proxy-Authorization header on redirects.', fix: 'Upgrade requests to >= 2.31.0' }],
  'pillow': [{ below: '10.0.1', severity: 'high', title: 'Buffer Overflow in Pillow', description: 'Pillow before 10.0.1 is vulnerable to buffer overflow in image processing.', fix: 'Upgrade Pillow to >= 10.0.1' }],
  'cryptography': [{ below: '41.0.6', severity: 'high', title: 'NULL Pointer Dereference in cryptography', description: 'cryptography before 41.0.6 is vulnerable to a NULL-pointer dereference in PKCS12 parsing.', fix: 'Upgrade cryptography to >= 41.0.6' }],
  'pyyaml': [{ below: '6.0.1', severity: 'critical', title: 'Arbitrary Code Execution in PyYAML', description: 'PyYAML before 6.0.1 allows arbitrary code execution via yaml.load with untrusted input.', fix: 'Upgrade PyYAML to >= 6.0.1 and use yaml.safe_load' }],
}

/** Simple semver comparison: is `version` < `threshold`? */
function isBelow(version: string, threshold: string): boolean {
  const parse = (v: string) => v.replace(/^[~^>=<]*/,'').split('.').map(n => parseInt(n, 10) || 0)
  const a = parse(version)
  const b = parse(threshold)
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) < (b[i] ?? 0)) return true
    if ((a[i] ?? 0) > (b[i] ?? 0)) return false
  }
  return false
}

export function scanDeps(manifest: string, filename: string): DepFinding[] {
  const findings: DepFinding[] = []

  if (filename === 'package.json' || filename.endsWith('/package.json')) {
    try {
      const pkg = JSON.parse(manifest)
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
      for (const [name, rawVersion] of Object.entries(allDeps)) {
        const version = String(rawVersion)
        const vulns = KNOWN_VULNS[name]
        if (!vulns) continue
        for (const vuln of vulns) {
          if (isBelow(version, vuln.below)) {
            const loc = `${filename}:${name}@${version}`
            findings.push({
              checkId: `dep:${name}:${vuln.title.replace(/\s+/g, '-').toLowerCase()}`,
              locationHash: createHash('sha256').update(loc).digest('hex').slice(0, 16),
              title: vuln.title,
              description: `${vuln.description} (installed: ${version}, fixed in: ${vuln.below})`,
              category: 'Vulnerable Dependency',
              severity: vuln.severity,
              location: loc,
              codeSnippet: `"${name}": "${version}"`,
              fix: vuln.fix,
              source: 'Dependency scan',
            })
          }
        }
      }
    } catch { /* invalid JSON — skip */ }
  }

  if (filename === 'requirements.txt' || filename.endsWith('/requirements.txt')) {
    const lines = manifest.split('\n')
    for (const line of lines) {
      const match = line.match(/^([a-zA-Z0-9_-]+)==([0-9.]+)/)
      if (!match) continue
      const [, name, version] = match
      const normalizedName = name.toLowerCase()
      const vulns = KNOWN_VULNS[normalizedName]
      if (!vulns) continue
      for (const vuln of vulns) {
        if (isBelow(version, vuln.below)) {
          const loc = `${filename}:${normalizedName}==${version}`
          findings.push({
            checkId: `dep:${normalizedName}:${vuln.title.replace(/\s+/g, '-').toLowerCase()}`,
            locationHash: createHash('sha256').update(loc).digest('hex').slice(0, 16),
            title: vuln.title,
            description: `${vuln.description} (installed: ${version}, fixed in: ${vuln.below})`,
            category: 'Vulnerable Dependency',
            severity: vuln.severity,
            location: loc,
            codeSnippet: `${normalizedName}==${version}`,
            fix: vuln.fix,
            source: 'Dependency scan',
          })
        }
      }
    }
  }

  return findings
}
