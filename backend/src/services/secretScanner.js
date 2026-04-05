import crypto from 'crypto'

export const SECRET_PATTERNS = [
    { type: 'aws_access_key', severity: 'critical', pattern: /(?:^|[^A-Z0-9])(AKIA[0-9A-Z]{16})(?:[^A-Z0-9]|$)/gm },
    { type: 'aws_secret_key', severity: 'critical', pattern: /(?:aws_secret|AWS_SECRET)[_\s]*(?:access[_\s]*)?key[_\s]*[=:]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gim },
    { type: 'jwt_secret', severity: 'critical', pattern: /(?:jwt[_\s]*secret|JWT_SECRET)\s*[=:]\s*['"]?([A-Za-z0-9_\-\.+/]{20,})['"]?/gim },
    { type: 'jwt_token', severity: 'high', pattern: /(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/gm },
    { type: 'github_token', severity: 'critical', pattern: /(gh[pousr]_[A-Za-z0-9_]{36,})/gm },
    { type: 'github_classic_token', severity: 'critical', pattern: /(ghp_[A-Za-z0-9]{36})/gm },
    { type: 'stripe_secret_key', severity: 'critical', pattern: /(sk_live_[A-Za-z0-9]{24,})/gm },
    { type: 'stripe_publishable', severity: 'low', pattern: /(pk_live_[A-Za-z0-9]{24,})/gm },
    { type: 'slack_token', severity: 'high', pattern: /(xox[baprs]-[A-Za-z0-9\-]{10,})/gm },
    { type: 'slack_webhook', severity: 'high', pattern: /(https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+)/gm },
    { type: 'sendgrid_api_key', severity: 'high', pattern: /(SG\.[A-Za-z0-9_\-]{22}\.[A-Za-z0-9_\-]{43})/gm },
    { type: 'spotify_client_secret', severity: 'high', pattern: /(?:spotify[_\s]*(?:client[_\s]*)?secret)\s*[=:]\s*['"]?([A-Za-z0-9]{32})['"]?/gim },
    { type: 'private_key', severity: 'critical', pattern: /(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/gm },
    { type: 'generic_api_key', severity: 'medium', pattern: /(?:api[_\s]*key|apikey|api_secret)\s*[=:]\s*['"]?([A-Za-z0-9_\-]{20,64})['"]?/gim },
    { type: 'hardcoded_password', severity: 'medium', pattern: /(?:password|passwd|pwd)\s*[=:]\s*['"]([^'"]{8,})['"](?!\s*#\s*example)/gim },
]

const ALLOWLIST = [
    /example/i, /placeholder/i, /your[_-]?(?:api[_-]?)?key[_-]?here/i,
    /xxxx/i, /changeme/i, /\$\{[^}]+\}/, /process\.env\./, /os\.environ/, /getenv/i,
]

const isAllowlisted = v => ALLOWLIST.some(p => p.test(v))
const hashSecret = v => crypto.createHash('sha256').update(v).digest('hex')

export function scanText(content, location = 'unknown') {
    const findings = []
    const seen = new Set()

    for (const { type, severity, pattern } of SECRET_PATTERNS) {
        pattern.lastIndex = 0
        let match
        while ((match = pattern.exec(content)) !== null) {
            const raw = match[1] ?? match[0]
            if (!raw || isAllowlisted(raw)) continue
            const hash = hashSecret(raw)
            if (seen.has(hash)) continue
            seen.add(hash)
            const line = content.slice(0, match.index).split('\n').length
            findings.push({ type, severity, hash, location: `${location}:${line}` })
        }
    }
    return findings
}

export function scanFiles(files) {
    return files.flatMap(({ path, content }) => scanText(content, path))
}