'use client'

export function Empty({ message = 'No data' }: { message?: string }) {
  return <div className="p-10 text-center text-muted text-xs">{message}</div>
}
