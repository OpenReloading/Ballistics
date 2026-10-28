import { describe, expect, it } from 'vitest'
import { InputError, shotsNeeded, velocityStatistics } from '../src/index.ts'
import { normals } from './random.ts'

const defined = <T>(x: T | undefined): T => {
  if (x === undefined) throw new Error('expected a value')
  return x
}

describe('velocityStatistics', () => {
  it('gives the mean, the n - 1 standard deviation and the extreme spread', () => {
    const s = defined(velocityStatistics([790, 800, 810, 800]))
    expect(s.count).toBe(4)
    expect(s.mean).toBe(800)
    expect(s.standardDeviation).toBeCloseTo(Math.sqrt(200 / 3), 12)
    expect(s.extremeSpread).toBe(20)
    expect(s.min).toBe(790)
    expect(s.max).toBe(810)
    expect(s.confidenceLevel).toBe(0.95)
  })

  it('gives the interval from the chi-square table values of 9 degrees of freedom', () => {
    // 10 shots, s = 1: sqrt(9 / 19.0228) and sqrt(9 / 2.7004) (chi-square table, 0.975 and 0.025)
    const v = [-1.5, -1.2, -0.8, -0.5, -0.2, 0.2, 0.5, 0.8, 1.2, 1.5]
    const s = defined(velocityStatistics(v))
    const sd = defined(s.standardDeviation)
    const i = defined(s.standardDeviationInterval)
    expect(i.lower / sd).toBeCloseTo(0.68781, 4)
    expect(i.upper / sd).toBeCloseTo(1.82559, 4)
    // a lower level is a narrower interval inside the wider one
    const j = defined(defined(velocityStatistics(v, 0.9)).standardDeviationInterval)
    expect(j.lower).toBeGreaterThan(i.lower)
    expect(j.upper).toBeLessThan(i.upper)
  })

  it('leaves out what the shot count does not support', () => {
    expect(velocityStatistics([])).toBeUndefined()
    const one = defined(velocityStatistics([800]))
    expect(one.standardDeviation).toBeUndefined()
    expect(one.extremeSpread).toBe(0)
    const two = defined(velocityStatistics([800, 802]))
    expect(two.standardDeviation).toBeDefined()
    expect(two.standardDeviationInterval).toBeUndefined()
    expect(defined(velocityStatistics([800, 802, 801])).standardDeviationInterval).toBeDefined()
  })

  it('rejects a level outside (0, 1) and a velocity that is not finite', () => {
    expect(() => velocityStatistics([1, 2, 3], 1)).toThrow(InputError)
    expect(() => velocityStatistics([1, 2, 3], 0)).toThrow(InputError)
    expect(() => velocityStatistics([1, Number.NaN])).toThrow(InputError)
  })

  // seeded normal strings: the interval holds its level at every shot count
  it.each([
    [0.95, 3],
    [0.95, 5],
    [0.95, 10],
    [0.95, 30],
    [0.9, 5],
    [0.9, 10],
  ])('covers the true SD at level %f over seeded normal strings of %i shots', (level, n) => {
    const sigma = 4
    const seeds = 1500
    let covered = 0
    for (let seed = 1; seed <= seeds; seed++) {
      const draw = normals(seed * 1000 + n)
      const v = Array.from({ length: n }, () => 800 + sigma * draw())
      const i = defined(defined(velocityStatistics(v, level)).standardDeviationInterval)
      if (i.lower <= sigma && sigma <= i.upper) covered++
    }
    // three binomial standard deviations around the level
    expect(Math.abs(covered / seeds - level)).toBeLessThan(
      3 * Math.sqrt((level * (1 - level)) / seeds),
    )
  })
})

describe('shotsNeeded', () => {
  it.each([
    [0.5, 0.9, 9],
    [0.5, 0.95, 12],
    [0.3, 0.9, 19],
    [0.3, 0.95, 26],
    [0.2, 0.9, 38],
    [0.2, 0.95, 53],
  ])('relative half-width %f at level %f needs %i shots', (width, level, n) => {
    expect(shotsNeeded(width, level)).toBe(n)
  })

  it('is the first shot count that is narrow enough, and 95 % by default', () => {
    const halfWidth = (n: number) => {
      const s = defined(velocityStatistics(Array.from({ length: n }, (_, k) => k - n / 2 + 0.5)))
      const sd = defined(s.standardDeviation)
      const i = defined(s.standardDeviationInterval)
      return (i.upper - i.lower) / 2 / sd
    }
    const n = shotsNeeded(0.25)
    expect(halfWidth(n)).toBeLessThanOrEqual(0.25)
    expect(halfWidth(n - 1)).toBeGreaterThan(0.25)
  })

  it('starts at 3 shots for a wide interval and refuses a width it cannot search', () => {
    expect(shotsNeeded(100)).toBe(3)
    expect(() => shotsNeeded(0.001)).toThrow(InputError)
    expect(() => shotsNeeded(0.2, 1)).toThrow(InputError)
  })
})
