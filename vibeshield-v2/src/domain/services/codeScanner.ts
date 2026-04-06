import crypto from 'crypto'
import { getChecksForFile } from './checks'

const SKIP_FILES = /\.min\.js$|\.map$|\.lock$|dist\/|build\/|\.d\.ts$/i
const MAX_FINDINGS_PER_FILE = 100

export interface CodeFinding {
  id: string
  checkId: string
  locationHash: string
  title: string
  description: string
  fix: string
  category: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  location: string
  codeSnippet: string
  source: string
}

export function scanCode(content: string, filePath: string): CodeFinding[] {
  if (SKIP_FILES.test(filePath)) return []

  const checks = getChecksForFile(filePath)
  const lines = content.split('\n')
  const findings: CodeFinding[] = []

  for (const check of checks) {
    if (findings.length >= MAX_FINDINGS_PER_FILE) break

    check.pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = check.pattern.exec(content)) !== null) {
      if (findings.length >= MAX_FINDINGS_PER_FILE) break

      const lineNumber = content.slice(0, match.index).split('\n').length
      const codeLine = (lines[lineNumber - 1] ?? '').trim()
      const location = `${filePath}:${lineNumber}`
      const locationHash = crypto
        .createHash('sha256')
        .update(`${filePath}:${lineNumber}:${check.id}`)
        .digest('hex')
        .slice(0, 16)

      findings.push({
        id: `${check.id}-${crypto.randomBytes(4).toString('hex')}`,
        checkId: check.id,
        locationHash,
        title: check.title,
        description: check.description,
        fix: check.fix,
        category: check.category,
        severity: check.severity,
        location,
        codeSnippet: codeLine.slice(0, 200),
        source: 'Code scan',
      })
    }
  }

  return findings
}
