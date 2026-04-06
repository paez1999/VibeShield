import type { SeveritySummary } from '../entities/vulnerability'

export function calculateScore(summary: SeveritySummary): string {
  const weighted =
    summary.critical * 10 +
    summary.high * 5 +
    summary.medium * 2 +
    summary.low * 0.5

  if (weighted === 0) return 'A'
  if (weighted <= 5) return 'B'
  if (weighted <= 15) return 'C'
  if (weighted <= 30) return 'D'
  return 'F'
}
