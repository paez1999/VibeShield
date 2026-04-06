import { execFile }         from 'child_process'
import { writeFile, mkdir, rm } from 'fs/promises'
import { mkdtempSync }      from 'fs'
import { join, dirname }    from 'path'
import { tmpdir }           from 'os'
import { promisify }        from 'util'

const execFileAsync = promisify(execFile)

// Semgrep severity → VibeShield severity
const SEV = { ERROR: 'high', WARNING: 'medium', INFO: 'low' }

// Guess category from Semgrep check_id
const CATEGORY_PATTERNS = [
  [/sqli|sql.inject/i,          'SQL Injection'],
  [/xss|cross.site.script/i,    'XSS'],
  [/path.travers|directory.trav/i, 'Path Traversal'],
  [/command.inject|code.inject/i,  'Command Injection'],
  [/ssrf/i,                     'SSRF'],
  [/weak.crypto|md5|sha1/i,     'Weak crypto'],
  [/broken.auth|hardcod.pass|hardcod.secret/i, 'Broken auth'],
  [/prototype.pollut/i,         'Prototype Pollution'],
  [/idor|insecure.direct/i,     'IDOR'],
  [/mass.assign/i,              'Mass assignment'],
  [/info.disclos|stack.trace/i, 'Info disclosure'],
  [/rate.limit/i,               'No rate limit'],
  [/insecure.cookie|cookie.secure/i, 'Insecure cookies'],
]

function guessCategory(checkId) {
  for (const [re, cat] of CATEGORY_PATTERNS) {
    if (re.test(checkId)) return cat
  }
  return 'Code vulnerability'
}

/**
 * Run Semgrep on an array of { path, content } file objects.
 * Returns findings in VibeShield format, or [] if Semgrep is unavailable.
 */
export async function runSemgrep(fileContents) {
  if (!fileContents.length) return []

  const dir     = mkdtempSync(join(tmpdir(), 'vs-'))
  const pathMap = new Map()   // relPath inside tmpdir → original filePath

  try {
    // Write files preserving directory structure so Semgrep gets full context
    await Promise.all(fileContents.map(async ({ path: filePath, content }) => {
      // filePath format: "owner/repo:sha7:src/utils.js"  or just "src/utils.js"
      const parts   = filePath.split(':')
      const relPath = parts.length >= 3 ? parts.slice(2).join('/') : parts[parts.length - 1]
      const dest    = join(dir, relPath)
      await mkdir(dirname(dest), { recursive: true })
      await writeFile(dest, content, 'utf8')
      pathMap.set(relPath, filePath)
    }))

    // Run Semgrep — p/owasp-top-ten covers the most impactful rules
    // p/nodejs adds Node.js-specific checks (prototype pollution, ReDoS, etc.)
    let stdout
    try {
      ;({ stdout } = await execFileAsync(
        'semgrep',
        [
          '--config', 'p/owasp-top-ten',
          '--config', 'p/nodejs',
          '--json',
          '--no-git-ignore',
          '--timeout', '30',
          '--max-memory', '512',
          dir,
        ],
        { timeout: 90_000, maxBuffer: 10 * 1024 * 1024 },
      ))
    } catch (err) {
      // Exit code 1 = findings found — stdout still has valid JSON
      if (err.stdout) {
        stdout = err.stdout
      } else if (err.code === 'ENOENT') {
        console.warn('[semgrep] binary not found — skipping')
        return []
      } else {
        console.warn('[semgrep] error:', err.message)
        return []
      }
    }

    const parsed = JSON.parse(stdout)
    if (!Array.isArray(parsed.results)) return []

    return parsed.results.map(r => {
      // Map temp path back to original
      const relPath    = r.path.startsWith(dir) ? r.path.slice(dir.length + 1) : r.path
      const origPath   = pathMap.get(relPath) || relPath
      const category   = guessCategory(r.check_id)
      const severity   = SEV[r.extra?.severity] || 'medium'
      const firstLine  = (r.extra?.message || '').split('\n')[0].slice(0, 120)
      const cwe        = r.extra?.metadata?.cwe?.[0] ?? null

      return {
        title:       firstLine || `Issue: ${r.check_id.split('.').pop()}`,
        description: r.extra?.message || '',
        fix:         r.extra?.fix ?? r.extra?.metadata?.fix_guidance ?? null,
        category,
        severity,
        location:    `${origPath}:${r.start?.line ?? '?'}`,
        codeSnippet: r.extra?.lines?.trim() || null,
        source:      'Code scan',
        checkId:     r.check_id,
        cwe,
      }
    })
  } catch (err) {
    console.warn('[semgrep] unexpected error:', err.message)
    return []
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
