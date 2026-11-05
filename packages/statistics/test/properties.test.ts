import { degreesOfFreedom, near, positive, probability, velocities } from '@open-reloading/test-kit'
import { assert, double, integer, property } from 'fast-check'
import { describe, expect, it } from 'vitest'
import { bisect } from '../src/bisect.ts'
import { chiSquareCdf, chiSquareQuantile, chiSquareSurvival } from '../src/chi-square.ts'
import { nth } from '../src/errors.ts'
import { huberCost } from '../src/huber.ts'
import { normalsFrom, seededUniforms } from '../src/random.ts'
import { studentTwoSidedQuantile } from '../src/student-t.ts'
import { velocityStatistics } from '../src/velocity-statistics.ts'

describe('distribution properties', () => {
  it('inverts the chi-square distribution function by its quantile', () => {
    assert(
      property(probability(), degreesOfFreedom(60), (p, df) => {
        expect(chiSquareCdf(chiSquareQuantile(p, df), df)).toEqual(near(p, { absolute: 1e-9 }))
      }),
    )
  })

  it('splits the chi-square probability into the distribution and survival functions', () => {
    assert(
      property(positive(200), degreesOfFreedom(60), (x, df) => {
        expect(chiSquareCdf(x, df) + chiSquareSurvival(x, df)).toEqual(near(1, { absolute: 1e-12 }))
      }),
    )
    expect(chiSquareCdf(0, 3)).toBe(0)
    expect(chiSquareCdf(-1, 3)).toBe(0)
  })

  it('widens the Student t quantile with the level and narrows it with the degrees of freedom', () => {
    // confidence levels: within about 1e-12 of 1 the central mass rounds to 1 and the quantile is noise
    const level = double({ min: 0.01, max: 0.9999, noNaN: true })
    assert(
      property(level, level, degreesOfFreedom(40), (a, b, df) => {
        const [lo, hi] = a < b ? [a, b] : [b, a]
        expect(studentTwoSidedQuantile(lo, df)).toBeLessThanOrEqual(studentTwoSidedQuantile(hi, df))
        expect(studentTwoSidedQuantile(hi, df + 1)).toBeLessThanOrEqual(
          studentTwoSidedQuantile(hi, df),
        )
      }),
    )
  })
})

describe('velocity statistics properties', () => {
  it('keeps the mean between the extremes and the spread and deviation under a shift', () => {
    assert(
      property(velocities(2, 30), positive(100), (v, shift) => {
        const s = defined(velocityStatistics(v))
        const moved = defined(velocityStatistics(v.map((x) => x + shift)))
        expect(s.mean).toBeGreaterThanOrEqual(s.min)
        expect(s.mean).toBeLessThanOrEqual(s.max)
        expect(moved.extremeSpread).toEqual(
          near(s.extremeSpread, { relative: 1e-9, absolute: 1e-9 }),
        )
        expect(moved.standardDeviation).toEqual(
          near(defined(s.standardDeviation), { relative: 1e-6, absolute: 1e-6 }),
        )
      }),
    )
  })
})

describe('numeric helpers', () => {
  it('finds the root of an increasing line inside its bracket', () => {
    assert(
      property(probability(), (root) => {
        expect(bisect((x) => x < root, [0, 1], 60, true)).toEqual(near(root, { absolute: 1e-12 }))
      }),
    )
  })

  it('repeats the generator for a seed and stays in [0, 1)', () => {
    assert(
      property(integer({ min: 0, max: 2 ** 32 - 1 }), (seed) => {
        const a = seededUniforms(seed)
        const b = seededUniforms(seed)
        for (let i = 0; i < 20; i++) {
          const x = a()
          expect(x).toBe(b())
          expect(x >= 0 && x < 1).toBe(true)
        }
      }),
    )
  })

  it('turns two uniforms into one normal number, the radius from the first', () => {
    const u = [0.5, 0.25, 0.9, 0]
    let i = 0
    const draw = normalsFrom(() => u[i++] ?? 0)
    // radius sqrt(-2 ln 0.5) at angle pi / 2, then sqrt(-2 ln 0.1) at angle 0
    expect(draw()).toBeCloseTo(0, 12)
    expect(draw()).toBeCloseTo(Math.sqrt(-2 * Math.log(0.1)), 12)
  })

  it('keeps residuals past the Huber count quadratic', () => {
    expect(huberCost([3, 3], { threshold: 1, count: 1 })).toBe(2 * 3 * 1 - 1 + 9)
  })

  it('refuses an index outside the array', () => {
    expect(() => nth([1, 2], 2)).toThrow('index 2 outside an array of 2')
  })
})

function defined<T>(x: T | undefined): T {
  if (x === undefined) throw new Error('expected a value')
  return x
}
