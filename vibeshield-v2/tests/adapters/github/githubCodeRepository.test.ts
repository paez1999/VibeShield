import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GitHubCodeRepository } from '@/adapters/github/githubCodeRepository'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('GitHubCodeRepository', () => {
  let repo: GitHubCodeRepository

  beforeEach(() => {
    mockFetch.mockReset()
    repo = new GitHubCodeRepository('fake-token', 10)
  })

  describe('resolveRef', () => {
    it('returns SHA when branch exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ object: { sha: 'abc123' } }),
      })
      const sha = await repo.resolveRef('owner/repo', 'main')
      expect(sha).toBe('abc123')
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/git/ref/heads/main',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer fake-token' }),
        })
      )
    })

    it('returns null when branch does not exist (404)', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
      const sha = await repo.resolveRef('owner/repo', 'nonexistent')
      expect(sha).toBeNull()
    })
  })

  describe('fetchTree', () => {
    it('returns file entries from tree', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tree: [
            { path: 'src/app.js', sha: 'sha1', size: 100, type: 'blob' },
            { path: 'src/utils', sha: 'sha2', size: 0, type: 'tree' },
          ],
        }),
      })
      const tree = await repo.fetchTree('owner/repo', 'abc123')
      expect(tree).toHaveLength(2)
      expect(tree[0]).toEqual({ path: 'src/app.js', sha: 'sha1', size: 100, type: 'blob' })
    })

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
      await expect(repo.fetchTree('owner/repo', 'abc')).rejects.toThrow()
    })
  })

  describe('fetchFileContent', () => {
    it('decodes base64 content from blob', async () => {
      const content = Buffer.from('console.log("hello")').toString('base64')
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content }),
      })
      const result = await repo.fetchFileContent('owner/repo', 'sha1')
      expect(result).toBe('console.log("hello")')
    })
  })

  describe('error handling', () => {
    it('throws AccessDeniedError on 403', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403 })
      await expect(repo.fetchTree('owner/repo', 'sha'))
        .rejects.toThrow('Access denied')
    })

    it('throws RateLimitError on 429', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 429 })
      await expect(repo.fetchTree('owner/repo', 'sha'))
        .rejects.toThrow('rate limit')
    })
  })
})
