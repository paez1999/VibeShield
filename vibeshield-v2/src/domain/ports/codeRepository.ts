export interface FileEntry {
  path: string
  sha: string
  size: number
  type: 'blob' | 'tree'
}

export interface FileContent {
  path: string
  content: string
}

export interface FetchFilesOpts {
  skip: RegExp
  relevant: RegExp
  maxFiles: number
  maxFileSize: number
}

export interface CodeRepository {
  resolveRef(repo: string, ref: string): Promise<string | null>
  fetchTree(repo: string, sha: string): Promise<FileEntry[]>
  fetchFileContent(repo: string, sha: string): Promise<string>
  fetchFiles(repo: string, sha: string, opts: FetchFilesOpts): Promise<FileContent[]>
}
