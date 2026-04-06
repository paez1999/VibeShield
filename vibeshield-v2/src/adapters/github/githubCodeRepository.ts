import type { CodeRepository, FileEntry } from '@/domain/ports/codeRepository'
import { RepoNotFoundError, RateLimitError, AccessDeniedError } from '@/shared/errors'
import { Semaphore } from '@/shared/semaphore'

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
