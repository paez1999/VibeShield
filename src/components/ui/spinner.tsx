'use client'

export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span
      className="inline-block border-[1.5px] border-border2 border-t-red rounded-full animate-spin"
      style={{ width: size, height: size }}
    />
  )
}
