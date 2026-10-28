import { describe, expect, it } from 'vitest'
import { percentile } from '../src/stats.ts'

describe('percentile', () => {
  it('interpolates between the closest ranks', () => {
    expect(percentile([0.1, 0.01, 0.04, 0.02, 0.03], 0.5)).toBeCloseTo(0.03, 12)
    expect(percentile([0.01, 0.02, 0.03, 0.04, 0.1], 0.9)).toBeCloseTo(0.076, 12)
    expect(percentile([5], 0.9)).toBe(5)
  })

  it('has none without values', () => {
    expect(percentile([], 0.5)).toBeUndefined()
  })
})
