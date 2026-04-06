'use client'

const VARIANTS = {
  default: 'border-border2 text-muted hover:border-border hover:text-text',
  primary: 'border-red text-red hover:bg-red/10',
  danger:  'border-border2 text-muted hover:border-red hover:text-red',
} as const

type BtnVariant = keyof typeof VARIANTS

export function Btn({ variant = 'default', small, disabled, onClick, children }: {
  variant?: BtnVariant
  small?: boolean
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`bg-transparent border rounded-sm transition-all ${VARIANTS[variant] ?? VARIANTS.default} ${
        small ? 'text-[10px] px-2 py-0.5' : 'text-[11px] px-3 py-1'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {children}
    </button>
  )
}
