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

  it('gives the slope and the Welch band with whole degrees of freedom rounded down', () => {
    // va = vb = 1 (m/s)2: Welch df = 4 / (1/3 + 1/8) = 8.7, so 8; the pooled 11 would differ
    const r = ladderFlatSpots([step(0, 700, 4, 2), step(1, 709, 9, 3)])
    const s = nth(r.segments, 0)
    expect(s.slope).toBeCloseTo(9 / 0.0001, 6)
    // t of 8 degrees of freedom at 0.975 (t table)
    expect((s.halfWidth * 0.0001) / Math.SQRT2).toBeCloseTo(2.306004, 5)
    expect(s.counts).toEqual([4, 9])
  })

  it('calls a band of width 0 flat when the means are equal', () => {
    const r = ladderFlatSpots([step(0, 700, 5, 0), step(1, 700, 5, 0)])
    expect(nth(r.segments, 0).halfWidth).toBe(0)
    expect(nth(r.segments, 0).flat).toBe(true)
    expect(r.flatSpots).toHaveLength(1)
  })

  it('keeps flat runs apart and closes a run at the top of the ladder', () => {
    const r = ladderFlatSpots([700, 701, 730, 731].map((m, k) => step(k, m)))
    expect(r.segments.map((s) => s.flat)).toEqual([true, false, true])
    expect(r.flatSpots).toHaveLength(2)
    expect(nth(r.flatSpots, 0).to).toBeCloseTo(0.0021, 12)
    expect(nth(r.flatSpots, 1).from).toBeCloseTo(0.0022, 12)
    expect(nth(r.flatSpots, 1).to).toBeCloseTo(0.0023, 12)
  })

  it('names the field it rejects', () => {
    const ok = step(1, 701)
    expect(() => ladderFlatSpots([ok])).toThrow('a ladder needs at least two strings')
    for (const charge of [0, -0.001, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => ladderFlatSpots([{ ...step(0, 700), charge }, ok])).toThrow(
        'charge must be positive',
      )
    expect(() => ladderFlatSpots([step(0, Number.NaN), ok])).toThrow('mean must be finite')
    for (const sd of [-1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => ladderFlatSpots([step(0, 700, 5, sd), ok])).toThrow(
        'standard deviation must be 0 or more',
      )
    for (const count of [1, 2.5])
      expect(() => ladderFlatSpots([step(0, 700, count), ok])).toThrow(
        'each string needs at least two shots',
      )
    expect(() => ladderFlatSpots([step(1, 700), ok])).toThrow('charges must differ')
  })
})
