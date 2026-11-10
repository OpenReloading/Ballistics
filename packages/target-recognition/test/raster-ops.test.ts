import { describe, expect, it } from 'vitest'
import { upperMedian } from '../src/raster-ops.ts'

describe('upperMedian', () => {
  it('takes the upper of the two middle values', () => {
    const v = [4, 1, 3, 2]
    expect(upperMedian(v)).toBe(3)
  })

  it('throws for an empty array', () => {
    expect(() => upperMedian([])).toThrow(RangeError)
  })
})
