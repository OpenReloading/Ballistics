import { describe, expect, it } from 'vitest'
import { expectedExtremeSpread, InputError } from '../src/index.ts'
import { normals } from './random.ts'

/** Extreme spreads of `count` circular normal groups of `n` shots, sigma 1. */
function simulate(n: number, count: number, seed: number): number[] {
  const normal = normals(seed)
  return Array.from({ length: count }, () => {
    const p = Array.from({ length: n }, () => [normal(), normal()] as const)
    let max = 0
    for (const [i, a] of p.entries())
      for (const b of p.slice(i + 1)) max = Math.max(max, Math.hypot(a[0] - b[0], a[1] - b[1]))
    return max
  })
}

describe('expectedExtremeSpread', () => {
  it('matches the closed form for two shots', () => {
    // the distance of two points is sqrt(2) times a Rayleigh variable: mean sqrt(pi)
    expect(expectedExtremeSpread(2).mean / Math.sqrt(Math.PI) - 1).toBeCloseTo(0, 2)
  })

  it('agrees with a fresh seeded simulation within 2 % and covers 90 % within 2 points', () => {
    for (const n of [2, 3, 5, 10, 20]) {
      const t = expectedExtremeSpread(n)
      const groups = simulate(n, 20_000, 7_000 + n)
      const mean = groups.reduce((a, b) => a + b, 0) / groups.length
      expect(Math.abs(mean / t.mean - 1)).toBeLessThan(0.02)
      const inside = groups.filter((v) => v >= t.low && v <= t.high).length / groups.length
      expect(Math.abs(inside - 0.9)).toBeLessThan(0.02)
    }
  })

  it('rises with the shot count and puts the 3-shot mean near 0.79 of the 5-shot mean', () => {
    for (let n = 3; n <= 20; n++)
      expect(expectedExtremeSpread(n).mean).toBeGreaterThan(expectedExtremeSpread(n - 1).mean)
    expect(expectedExtremeSpread(3).mean / expectedExtremeSpread(5).mean).toBeCloseTo(0.786, 2)
  })

  it('rejects a shot count outside 2 to 20', () => {
    for (const n of [1, 21, 2.5, Number.NaN])
      expect(() => expectedExtremeSpread(n)).toThrow(InputError)
  })
})
