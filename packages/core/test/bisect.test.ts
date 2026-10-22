import { describe, expect, it } from 'vitest'
import { bisect } from '../src/bisect.ts'

describe('shared bisection loop', () => {
  const counted = (root: number) => {
    const calls = { n: 0 }
    return {
      calls,
      below: (x: number) => {
        calls.n++
        return x < root
      },
    }
  }

  it('without the stop rule calls the predicate exactly `iterations` times', () => {
    const { calls, below } = counted(Math.SQRT2)
    const x = bisect(below, 1, 2, 200, false)
    expect(calls.n).toBe(200)
    expect(Math.abs(x - Math.SQRT2)).toBeLessThanOrEqual(Number.EPSILON * 2)
  })

  it('with the stop rule ends once the midpoint equals an end, at the same root', () => {
    const a = counted(Math.SQRT2)
    const b = counted(Math.SQRT2)
    const stopped = bisect(a.below, 1, 2, 200, true)
    const full = bisect(b.below, 1, 2, 200, false)
    expect(a.calls.n).toBeGreaterThan(40)
    expect(a.calls.n).toBeLessThan(60)
    expect(stopped).toBe(full)
  })

  it('returns the midpoint of the bracket left after the iteration cap', () => {
    // root 0.3 in [0, 1]: 0.5 false, 0.25 true, so [0.25, 0.5] and its midpoint
    expect(bisect((x) => x < 0.3, 0, 1, 2, true)).toBe(0.375)
    expect(bisect((x) => x < 0.3, 0, 1, 0, false)).toBe(0.5)
  })

  it('moves the upper end on a false predicate', () => {
    expect(bisect(() => false, 0, 1, 10, false)).toBe(1 / 2 ** 11)
  })
})
