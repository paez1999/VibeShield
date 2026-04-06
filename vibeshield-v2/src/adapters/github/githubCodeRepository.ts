import type { CodeRepository, FileEntry, FileContent, FetchFilesOpts } from '@/domain/ports/codeRepository'
import { RepoNotFoundError, RateLimitError, AccessDeniedError } from '@/shared/errors'
import { Semaphore } from '@/shared/semaphore'
import { writeFile, mkdtemp, rm, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { list } from 'tar'

export class GitHubCodeRepository implements CodeRepository {
  private readonly semaphore: Semaphore
  private readonly baseUrl = 'https://api.github.com'
  private readonly headers: Record<string, string>

  constructor(token: string, concurrency = 10) {
    this.semaphore = new Semaphore(concurrency)
    this.headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
  }

  async resolveRef(repo: string, ref: string): Promise<string | null> {
    const res = await this.request(`/repos/${repo}/git/ref/heads/${ref}`)
    if (!res.ok) {
      if (res.status === 404) return null
      this.handleError(res.status, repo)
    }
    const data = await res.json()
    return data.object.sha
  }

  async fetchTree(repo: string, sha: string): Promise<FileEntry[]> {
    const res = await this.request(`/repos/${repo}/git/trees/${sha}?recursive=1`)
    if (!res.ok) this.handleError(res.status, repo)
    const data = await res.json()
    return data.tree.map((entry: any) => ({
      path: entry.path,
      sha: entry.sha,
      size: entry.size ?? 0,
      type: entry.type as 'blob' | 'tree',
    }))
  }

  async fetchFileContent(repo: string, sha: string): Promise<string> {
    return this.semaphore.run(async () => {
      const res = await this.request(`/repos/${repo}/git/blobs/${sha}`)
      if (!res.ok) this.handleError(res.status, repo)
      const data = await res.json()
      return Buffer.from(data.content, 'base64').toString('utf8')
    })
  }

  async fetchFiles(repo: string, sha: string, opts: FetchFilesOpts): Promise<FileContent[]> {
    let tmpDir: string | undefined
    try {
      const res = await fetch(`${this.baseUrl}/repos/${repo}/tarball/${sha}`, {
        headers: this.headers,
      })
      if (!res.ok) {
        return this.fetchFilesFallback(repo, sha, opts)
      }

      tmpDir = await mkdtemp(join(tmpdir(), 'vs-tar-'))
      const tarPath = join(tmpDir, 'repo.tar.gz')
      const buf = Buffer.from(await res.arrayBuffer())
      await writeFile(tarPath, buf)

      // Collect entry paths from the tarball
      const entries: string[] = []
      await list({
        file: tarPath,
        onReadEntry: (entry) => {
          entries.push(entry.path)
          entry.resume()
        },
      })

      // Extract matching files
      const { extract } = await import('tar')
      await extract({ file: tarPath, cwd: tmpDir })

      const results: FileContent[] = []
      for (const fullPath of entries) {
        if (results.length >= opts.maxFiles) break

        // Strip top-level directory (GitHub wraps in owner-repo-sha/)
        const stripped = fullPath.replace(/^[^/]+\//, '')
        if (!stripped || fullPath.endsWith('/')) continue

        if (opts.skip.test(stripped)) continue
        if (!opts.relevant.test(stripped)) continue

        const fileFull = join(tmpDir, fullPath)
        try {
          const content = await readFile(fileFull, 'utf8')
          if (content.length > opts.maxFileSize) continue
          results.push({ path: stripped, content })
        } catch {
          // Binary files or read errors — skip
        }
      }

      return results
    } catch {
      return this.fetchFilesFallback(repo, sha, opts)
    } finally {
      if (tmpDir) await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  }

  private async fetchFilesFallback(repo: string, sha: string, opts: FetchFilesOpts): Promise<FileContent[]> {
    const tree = await this.fetchTree(repo, sha)
    const filtered = tree.filter(
      (e) => e.type === 'blob' && !opts.skip.test(e.path) && opts.relevant.test(e.path) && e.size <= opts.maxFileSize,
    )
    const capped = filtered.slice(0, opts.maxFiles)
    const results: FileContent[] = []
    for (const entry of capped) {
      const content = await this.fetchFileContent(repo, entry.sha)
      results.push({ path: entry.path, content })
    }
    return results
  }

  private async request(path: string): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      headers: this.headers,
    })
  }

  private handleError(status: number, repo: string): never {
    if (status === 404) throw new RepoNotFoundError(`Repository not found: ${repo}`)
    if (status === 403) throw new AccessDeniedError(`Access denied to ${repo}`)
    if (status === 429) throw new RateLimitError('GitHub API rate limit exceeded')
    throw new Error(`GitHub API error: ${status}`)
  }
}
