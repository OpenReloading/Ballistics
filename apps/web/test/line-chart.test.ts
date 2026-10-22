import { expect, it } from 'vitest'
import { axisTicks } from '../src/components/line-chart.tsx'

it('keeps whole numbers on a count axis', () => {
  expect(axisTicks(1, 2, true)).toEqual([1, 2])
  expect(axisTicks(1, 3, true)).toEqual([1, 2, 3])
})

it('ends at the data and keeps fractions on other axes', () => {
  expect(axisTicks(1, 2)).toEqual([1, 1.2, 1.4, 1.6, 1.8, 2])
  expect(axisTicks(0, 9).at(-1)).toBeLessThanOrEqual(9)
})
