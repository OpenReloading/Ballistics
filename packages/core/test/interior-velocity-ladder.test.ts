import { describe, expect, it } from 'vitest'
import { nth } from '../src/errors.ts'
import { InputError, ladderFlatSpots } from '../src/index.ts'

const step = (k: number, mean: number, count = 5, standardDeviation = 5) => ({
  charge: 0.002 + k * 0.0001,
  mean,
  standardDeviation,
  count,
})

describe('ladderFlatSpots', () => {
  it('finds the plateau of a ladder and not a monotone rise', () => {
    // 20 m/s per step, then 1 m/s per step over three steps, then 20 m/s again
    const means = [700, 720, 740, 741, 742, 743, 763, 783]
    const r = ladderFlatSpots(means.map((m, k) => step(k, m)))
    expect(r.flatSpots).toHaveLength(1)
    expect(nth(r.flatSpots, 0).from).toBeCloseTo(0.0022, 12)
    expect(nth(r.flatSpots, 0).to).toBeCloseTo(0.0025, 12)
    expect(nth(r.flatSpots, 0).counts).toEqual([5, 5, 5, 5])
    expect(ladderFlatSpots([700, 720, 740, 760, 780].map((m, k) => step(k, m))).flatSpots).toEqual(
      [],
    )
  })

  it('widens the bands for small string counts', () => {
    const means = [700, 709]
    const wide = ladderFlatSpots(means.map((m, k) => step(k, m, 2)))
    const narrow = ladderFlatSpots(means.map((m, k) => step(k, m, 10)))
    expect(nth(wide.segments, 0).halfWidth).toBeGreaterThan(nth(narrow.segments, 0).halfWidth)
    expect(nth(wide.segments, 0).flat).toBe(true)
    expect(nth(narrow.segments, 0).flat).toBe(false)
  })

  it('takes steps in any order and rejects a string of one shot', () => {
    const r = ladderFlatSpots([step(1, 701), step(0, 700)])
    expect(nth(r.segments, 0).from).toBeLessThan(nth(r.segments, 0).to)
    expect(() => ladderFlatSpots([step(0, 700, 1), step(1, 701)])).toThrow(InputError)
    expect(() => ladderFlatSpots([step(0, 700)])).toThrow(InputError)
  })
})
