export abstract class DomainError extends Error {
  abstract readonly code: string
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class ScanLimitError extends DomainError {
  readonly code = 'SCAN_LIMIT_REACHED'
}
export class BranchNotFoundError extends DomainError {
  readonly code = 'BRANCH_NOT_FOUND'
}
export class RepoNotFoundError extends DomainError {
  readonly code = 'REPO_NOT_FOUND'
}
export class RateLimitError extends DomainError {
  readonly code = 'RATE_LIMITED'
}
export class AccessDeniedError extends DomainError {
  readonly code = 'ACCESS_DENIED'
}
export class ScanFailedError extends DomainError {
  readonly code = 'SCAN_FAILED'
}
