import { NextResponse } from 'next/server'
import { DomainError, ScanLimitError, BranchNotFoundError, RepoNotFoundError, RateLimitError, AccessDeniedError } from '@/domain/errors'

export function jsonOk(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof Error) {
    if (err.message === 'UNAUTHORIZED') return jsonError('Authentication required', 401)
    if (err.message === 'NO_ORG') return jsonError('No organization found. Complete setup first.', 403)
  }
  if (err instanceof ScanLimitError) return jsonError(err.message, 429)
  if (err instanceof BranchNotFoundError) return jsonError(err.message, 404)
  if (err instanceof RepoNotFoundError) return jsonError(err.message, 404)
  if (err instanceof RateLimitError) return jsonError(err.message, 503)
  if (err instanceof AccessDeniedError) return jsonError(err.message, 403)
  if (err instanceof DomainError) return jsonError(err.message, 400)
  if (err instanceof Error) {
    console.error('[api]', err.message)
  }
  return jsonError('Internal server error', 500)
}
