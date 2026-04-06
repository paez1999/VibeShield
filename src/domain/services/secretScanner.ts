import crypto from 'crypto'

export interface SecretFinding {
  type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  location: string
  locationHash: string
  match: string
}

interface SecretPattern {
  type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  pattern: RegExp
}

const PATTERNS: SecretPattern[] = [
  // Fixed-prefix patterns: no capture group, never allowlisted (the prefix itself is the signal)
  { type: 'aws_access_key', severity: 'critical', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { type: 'github_token', severity: 'critical', pattern: /\bghp_[A-Za-z0-9]{34,36}\b/g },
  { type: 'github_classic_token', severity: 'critical', pattern: /\bgh[ousr]_[A-Za-z0-9]{36,}\b/g },
  { type: 'stripe_secret_key', severity: 'critical', pattern: /\bsk_live_[A-Za-z0-9]{24,}\b/g },
  { type: 'stripe_publishable', severity: 'low', pattern: /\bpk_live_[A-Za-z0-9]{24,}\b/g },
  { type: 'slack_token', severity: 'high', pattern: /\bxox[bpas]-[A-Za-z0-9-]{10,}\b/g },
  { type: 'slack_webhook', severity: 'high', pattern: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/g },
  { type: 'jwt_token', severity: 'high', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { type: 'google_api_key', severity: 'high', pattern: /\bAIza[A-Za-z0-9_\\-]{35}\b/g },
  { type: 'sendgrid_api_key', severity: 'critical', pattern: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g },
  { type: 'twilio_api_key', severity: 'critical', pattern: /\bSK[a-f0-9]{32}\b/g },
  { type: 'private_key', severity: 'critical', pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g },
  // Database URLs: capture the credential portion for allowlist check; match full URL
  { type: 'database_url', severity: 'critical', pattern: /(?:postgres|mysql|mongodb|redis):\/\/([^@\s'"]{4,})@[^\s'"]{4,}/gim },
  // Captured-value patterns: allowlist applied to capture group only
  { type: 'aws_secret_key', severity: 'critical', pattern: /(?:aws_secret|AWS_SECRET)[_\s]*(?:access[_\s]*)?key[_\s]*[=:]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gim },
  { type: 'generic_api_key', severity: 'high', pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]([A-Za-z0-9_\-]{20,})['"]/gim },
  { type: 'generic_secret', severity: 'high', pattern: /(?:secret|token|password|passwd)\s*[:=]\s*['"]([^'"]{12,})['"]/gim },
]

const ALLOWLIST = [
  /example/i, /placeholder/i, /test(?:ing)?/i, /mock/i,
  /dummy/i, /sample/i, /fixture/i, /your[-_]?/i,
  /change[-_]?this/i, /xxx/i, /TODO/i,
]

function isAllowlisted(value: string): boolean {
  return ALLOWLIST.some(p => p.test(value))
}

export function scanSecrets(content: string, filePath: string): SecretFinding[] {
  const findings: SecretFinding[] = []

  for (const pat of PATTERNS) {
    pat.pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pat.pattern.exec(content)) !== null) {
      const capturedValue = match[1]
      const fullMatch = match[0]

      // Only apply allowlist to patterns that have a capture group.
      // Fixed-prefix patterns (AKIA..., ghp_..., sk_live_..., etc.) are
      // always flagged regardless of surrounding words like "example".
      if (capturedValue !== undefined && isAllowlisted(capturedValue)) continue

      const lineNumber = content.slice(0, match.index).split('\n').length
      const location = `${filePath}:${lineNumber}`
      const locationHash = crypto
        .createHash('sha256')
        .update(`${filePath}:${lineNumber}:${pat.type}`)
        .digest('hex')
        .slice(0, 16)

      // Mask the value: show first 8 chars then ****
      const displayValue = capturedValue ?? fullMatch
      findings.push({
        type: pat.type,
        severity: pat.severity,
        location,
        locationHash,
        match: displayValue.slice(0, 8) + '****',
      })
    }
  }

  return findings
}
