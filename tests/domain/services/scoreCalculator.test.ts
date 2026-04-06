import { describe, it, expect } from 'vitest'
import { calculateScore } from '@/domain/services/scoreCalculator'

describe('calculateScore', () => {
  it('returns A for zero vulnerabilities', () => {
    expect(calculateScore({ critical: 0, high: 0, medium: 0, low: 0, info: 0 })).toBe('A')
  })

  it('returns B for a few low-severity issues', () => {
    expect(calculateScore({ critical: 0, high: 0, medium: 2, low: 1, info: 3 })).toBe('B')
  })

  it('returns C for moderate issues', () => {
    expect(calculateScore({ critical: 0, high: 2, medium: 1, low: 0, info: 0 })).toBe('C')
  })

  it('returns D for serious issues', () => {
    expect(calculateScore({ critical: 1, high: 2, medium: 3, low: 1, info: 0 })).toBe('D')
  })

  it('returns F for many critical issues', () => {
    expect(calculateScore({ critical: 5, high: 3, medium: 2, low: 1, info: 0 })).toBe('F')
  })

  it('ignores info-level findings in scoring', () => {
    expect(calculateScore({ critical: 0, high: 0, medium: 0, low: 0, info: 100 })).toBe('A')
  })
})
