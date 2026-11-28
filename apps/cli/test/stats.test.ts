import { expect, it } from 'vitest'
import { percentile } from '../src/stats.ts'

it('sorts the values first and has no percentile without values', () => {
  expect(percentile([0.1, 0.01, 0.04, 0.02, 0.03], 0.5)).toBeCloseTo(0.03, 12)
  expect(percentile([], 0.5)).toBeUndefined()
})
