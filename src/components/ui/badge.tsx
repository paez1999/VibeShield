'use client'

const VARIANTS = {
  critical: 'bg-red/10 text-red border-red/25',
  high:     'bg-amber/10 text-amber border-amber/20',
  medium:   'bg-blue/10 text-blue border-blue/20',
  low:      'bg-green/10 text-green border-green/15',
  ok:       'bg-green/10 text-green border-green/20',
  info:     'bg-blue/10 text-blue border-blue/20',
} as const

type BadgeVariant = keyof typeof VARIANTS

export function Badge({ variant = 'info', children }: { variant?: BadgeVariant; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-medium tracking-wider uppercase font-mono border ${VARIANTS[variant] ?? VARIANTS.info}`}>
      {children}
    </span>
  )
}
