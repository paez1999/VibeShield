export interface FileEntry {
  path: string
  sha: string
  size: number
  type: 'blob' | 'tree'
}

export interface CodeRepository {
  resolveRef(repo: string, ref: string): Promise<string | null>
  fetchTree(repo: string, sha: string): Promise<FileEntry[]>
  fetchFileContent(repo: string, sha: string): Promise<string>
}
