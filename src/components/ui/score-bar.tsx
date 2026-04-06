'use client'

export function ScoreBar({ score }: { score: number }) {
  const color = score < 40 ? 'bg-red' : score < 70 ? 'bg-amber' : 'bg-green'
  return (
    <div className="h-[5px] bg-border2 rounded-sm overflow-hidden">
      <div
        className={`h-full rounded-sm transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
      />
    </div>
  )
}
