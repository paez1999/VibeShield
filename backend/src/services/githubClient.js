import { Octokit }                    from '@octokit/rest'
import { writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir }                    from 'node:os'
import { join }                      from 'node:path'
import { list }                      from 'tar'

/**
 * Returns an Octokit instance.
 * Authenticated (5 000 req/hr) if GITHUB_TOKEN is set,
 * unauthenticated (60 req/hr, public repos only) otherwise.
 */
export function createOctokit() {
  const opts = { userAgent: 'VibeShield/1.0' }
  if (process.env.GITHUB_TOKEN) opts.auth = process.env.GITHUB_TOKEN
  return new Octokit(opts)
}

/**
 * Parse "owner/repo" into { owner, repo }.
 * Throws 400 if invalid.
 */
export function parseRepo(fullName) {
  const [owner, repo] = (fullName || '').split('/')
  if (!owner || !repo) {
    const err = new Error('Invalid repo (expected owner/repo)')
    err.status = 400
    throw err
  }
  return { owner, repo }
}

/**
 * Download the repo tarball for a given SHA and return matching file contents.
 *
 * Costs exactly 1 GitHub API request (the tarball redirect) instead of 1 per
 * file.  The actual archive download comes from GitHub's CDN and is not
 * rate-limited.
 *
 * @param {string} owner
 * @param {string} repoName
 * @param {string} sha       - Full or partial commit SHA / branch / tag
 * @param {object} opts
 * @param {RegExp} opts.skip      - Paths matching this are skipped
 * @param {RegExp} opts.relevant  - Only paths matching this are kept
 * @param {number} opts.maxSizeKb - Max file size in KB (default 256)
 * @param {number} opts.maxFiles  - Max files to return (default 150)
 * @returns {Promise<Array<{path: string, content: string}>>}
 */
export async function fetchRepoFiles(owner, repoName, sha, {
  skip, relevant, maxSizeKb = 256, maxFiles = 150,
} = {}) {
  const token = process.env.GITHUB_TOKEN
  const url   = `https://api.github.com/repos/${owner}/${repoName}/tarball/${sha}`

  const res = await fetch(url, {
    headers: {
      'User-Agent':           'VibeShield/1.0',
      'X-GitHub-Api-Version': '2022-11-28',
      Accept:                 'application/vnd.github+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(90_000),
  })

  if (!res.ok) {
    const err = new Error(`GitHub tarball ${res.status} for ${owner}/${repoName}@${sha}`)
    err.status = res.status === 404 ? 404 : 502
    throw err
  }

  const repo    = `${owner}/${repoName}`
  // Write to a temp file — tar v7 uses Minipass streams internally which are
  // incompatible with the standard Node.js stream pipeline for input; the
  // file-based API is reliable and well-tested.
  const tmpPath = join(tmpdir(), `vs-${Date.now()}-${Math.random().toString(36).slice(2)}.tar.gz`)

  try {
    writeFileSync(tmpPath, Buffer.from(await res.arrayBuffer()))

    const fileContents = []
    await list({
      file: tmpPath,
      onentry(entry) {
        // GitHub tarballs wrap everything in a top-level "owner-repo-sha/" dir
        const filePath  = entry.path.replace(/^[^/]+\//, '')
        const sizeBytes = entry.size ?? 0

        if (
          !filePath ||
          entry.type !== 'File' ||
          sizeBytes > maxSizeKb * 1024 ||
          fileContents.length >= maxFiles ||
          (skip     &&  skip.test(filePath)) ||
          (relevant && !relevant.test(filePath))
        ) {
          entry.resume()   // must drain each entry or the parser stalls
          return
        }

        const chunks = []
        entry.on('data', c  => chunks.push(c))
        entry.on('end',  () => {
          if (fileContents.length < maxFiles) {
            fileContents.push({
              path:    `${repo}:${sha.slice(0, 7)}:${filePath}`,
              content: Buffer.concat(chunks).toString('utf8'),
            })
          }
        })
        entry.on('error', () => entry.resume())  // skip unreadable entries
      },
    })

    return fileContents
  } finally {
    try { unlinkSync(tmpPath) } catch {}  // always clean up
  }
}
