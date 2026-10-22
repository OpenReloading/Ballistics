import { expect, it } from 'vitest'
import { niceTicks } from '../src/lib/ticks.ts'

it('gives round steps covering the span', () => {
  expect(niceTicks(0, 1000)).toEqual([0, 200, 400, 600, 800, 1000])
  // span 8.25 rounds up to 10, the step 2.5 rounds to 2
  expect(niceTicks(-8.2, 0.05)).toEqual([-10, -8, -6, -4, -2, 0, 2])
  expect(niceTicks(0, 0.3)).toEqual([0, 0.1, 0.2, 0.3])
})

it('widens equal ends and gives no ticks for non-finite input', () => {
  expect(niceTicks(5, 5)).toEqual([4, 4.5, 5, 5.5, 6])
  expect(niceTicks(Number.NaN, 1)).toEqual([])
})
