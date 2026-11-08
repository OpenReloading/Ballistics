import { expect, it } from 'vitest'
import { percentile } from '../src/percentile.ts'

it('interpolates between the closest ranks of sorted values', () => {
  expect(percentile([0.01, 0.02, 0.03, 0.04, 0.1], 0.5)).toBeCloseTo(0.03, 12)
  expect(percentile([0.01, 0.02, 0.03, 0.04, 0.1], 0.9)).toBeCloseTo(0.076, 12)
  expect(percentile([5], 0.9)).toBe(5)
})
