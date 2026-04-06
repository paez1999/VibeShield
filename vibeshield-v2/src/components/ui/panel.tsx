'use client'

export function Panel({ title, action, children, className = '' }: {
  title?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`bg-surface border border-border rounded-lg overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-xs text-white font-medium">{title}</span>
          {action && <span className="text-[11px] text-muted">{action}</span>}
        </div>
      )}
      {children}
    </div>
  )
}
