'use client'

export function PageHeader({ subtitle, title, action }: {
  subtitle: string
  title: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <div className="text-[10px] text-muted tracking-[2px] mb-1">{subtitle}</div>
        <h1 className="font-display font-extrabold text-[22px] text-white">{title}</h1>
      </div>
      {action}
    </div>
  )
}
