import { NextRequest } from 'next/server'
import { jsonOk, jsonError, handleApiError } from '@/lib/api-utils'
import { scanCode } from '@/domain/services/codeScanner'
import { scanSecrets } from '@/domain/services/secretScanner'
import { calculateScore } from '@/domain/services/scoreCalculator'
import type { SeveritySummary } from '@/domain/entities/vulnerability'
import { z } from 'zod'

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 5       // max requests per window
const RATE_LIMIT_WINDOW = 60_000  // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key)
  }
}, 5 * 60_000)

const PublicScanSchema = z.object({
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  ref: z.string().default('main'),
})

const SKIP = /node_modules|\.git|dist\/|build\/|\.png$|\.jpg$|\.gif$|\.ico$|\.lock$|\.min\.js$/i
const RELEVANT = /\.(js|jsx|ts|tsx|py|rb|php|go|java|cs|env|json|ya?ml|toml|tf|sh|sql)$|^\.env/i
const MAX_FILES = 50
const MAX_FILE_SIZE = 128 * 1024

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown'
    if (!checkRateLimit(ip)) {
      return jsonError('Rate limit exceeded. Try again in a minute.', 429)
    }

    const body = await req.json()
    const parsed = PublicScanSchema.safeParse(body)
    if (!parsed.success) return jsonError('Invalid parameters. Expected: { repo: "owner/repo" }', 400)

    const { repo, ref } = parsed.data
    const githubToken = process.env.GITHUB_TOKEN
    if (!githubToken) return jsonError('Scanning service not configured', 503)

    const base = 'https://api.github.com'
    const headers = {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
    }

    // Resolve ref
    const refRes = await fetch(`${base}/repos/${repo}/git/ref/heads/${ref}`, { headers })
    if (!refRes.ok) {
      if (refRes.status === 404) return jsonError(`Repository or branch not found: ${repo}@${ref}`, 404)
      return jsonError('GitHub API error', 502)
    }
    const refData = await refRes.json()
    const sha = refData.object.sha

    // Fetch tree
    const treeRes = await fetch(`${base}/repos/${repo}/git/trees/${sha}?recursive=1`, { headers })
    if (!treeRes.ok) return jsonError('Failed to fetch repository tree', 502)
    const treeData = await treeRes.json()

    const scannable = treeData.tree
      .filter((f: any) =>
        f.type === 'blob'
        && !SKIP.test(f.path)
        && RELEVANT.test(f.path)
        && (f.size ?? 0) <= MAX_FILE_SIZE
      )
      .slice(0, MAX_FILES)

    // Fetch and scan files
    const summary: SeveritySummary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
    let totalFindings = 0

    for (const file of scannable) {
      const blobRes = await fetch(`${base}/repos/${repo}/git/blobs/${file.sha}`, { headers })
      if (!blobRes.ok) continue
      const blobData = await blobRes.json()
      const content = Buffer.from(blobData.content, 'base64').toString('utf8')

      const codeFindings = scanCode(content, file.path)
      const secretFindings = scanSecrets(content, file.path)

      for (const f of codeFindings) {
        const sev = f.severity as keyof SeveritySummary
        if (sev in summary) summary[sev]++
        totalFindings++
      }
      for (const f of secretFindings) {
        const sev = f.severity as keyof SeveritySummary
        if (sev in summary) summary[sev]++
        totalFindings++
      }
    }

    const score = calculateScore(summary)

    return jsonOk({
      score,
      summary,
      totalFindings,
      filesScanned: scannable.length,
      repo,
      ref,
    })
  } catch (err) {
    return handleApiError(err)
  }
}
