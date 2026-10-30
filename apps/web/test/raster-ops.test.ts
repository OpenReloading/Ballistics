import { describe, expect, it } from 'vitest'
import { upperMedian } from '../src/lib/raster-ops.ts'

describe('upperMedian', () => {
  it('takes the upper of the two middle values and sorts the array in place', () => {
    const v = [4, 1, 3, 2]
    expect(upperMedian(v)).toBe(3)
    expect(v).toEqual([1, 2, 3, 4])
  })

  it('throws for an empty array', () => {
    expect(() => upperMedian([])).toThrow(RangeError)
  })
})
