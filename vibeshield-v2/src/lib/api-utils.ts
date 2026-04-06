import { NextResponse } from 'next/server'

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
    if (err.message.includes('SCAN_LIMIT')) return jsonError(err.message, 429)
    if (err.message.includes('NOT_FOUND')) return jsonError(err.message, 404)
    console.error('[api]', err.message)
  }
  return jsonError('Internal server error', 500)
}
