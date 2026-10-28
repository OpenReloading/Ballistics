import { describe, expect, it } from 'vitest'
import {
  ellipseProbability,
  hitProbability,
  InputError,
  type PointOffset,
  shotsToHit,
} from '../src/index.ts'

/**
 * 1 - Q1(d / s, r / s), the probability of a circle of radius r for a circular normal of standard
 * deviation s centred d away: the noncentral chi-square distribution of two degrees of freedom as a
 * Poisson mixture of central ones, whose distribution function is 1 - e^-u sum_{i<=j} u^i / i!.
 */
function circleReference(d: number, r: number, s: number): number {
  const lambda = (d / s) ** 2 / 2
  const u = (r / s) ** 2 / 2
  let weight = Math.exp(-lambda)
  let tail = 1
  let term = 1
  let total = 0
  for (let j = 0; j < 400; j++) {
    total += weight * (1 - Math.exp(-u) * tail)
    weight *= lambda / (j + 1)
    term *= u / (j + 1)
    tail += term
  }
  return total
}

/** Seeded uniforms (mulberry32) and a Box-Muller normal over them. */
function normals(seed: number): () => number {
  let a = seed >>> 0
  const u = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (((t ^ (t >>> 14)) >>> 0) + 0.5) / 4294967296
  }
  return () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u())
}

describe('ellipse probability with an offset', () => {
  it('equals the circular reference of the noncentral chi-square mixture', () => {
    const s = 0.01
    for (const d of [0.5, 1, 2, 3, 4])
      for (const r of [0.25, 0.5, 1, 2, 4])
        expect(
          ellipseProbability(r * s, r * s, { horizontal: s, vertical: s }, { dx: d * s, dy: 0 }),
        ).toBeCloseTo(circleReference(d * s, r * s, s), 7)
  })

  it('does not depend on the direction of the offset for a circular dispersion and zone', () => {
    const sigma = { horizontal: 0.01, vertical: 0.01 }
    const along = ellipseProbability(0.02, 0.02, sigma, { dx: 0.025, dy: 0 })
    const up = ellipseProbability(0.02, 0.02, sigma, { dx: 0, dy: -0.025 })
    const diagonal = ellipseProbability(0.02, 0.02, sigma, {
      dx: 0.025 * Math.SQRT1_2,
      dy: 0.025 * Math.SQRT1_2,
    })
    expect(up).toBeCloseTo(along, 8)
    expect(diagonal).toBeCloseTo(along, 8)
  })

  it('agrees with a seeded Monte Carlo within 0.5 percentage points, ellipses and both axes', () => {
    const draw = normals(369)
    const n = 200_000
    const cases: { a: number; b: number; sx: number; sy: number; o: PointOffset }[] = [
      { a: 0.02, b: 0.02, sx: 0.01, sy: 0.01, o: { dx: 0.03, dy: 0.01 } },
      { a: 0.05, b: 0.02, sx: 0.015, sy: 0.008, o: { dx: -0.02, dy: 0.015 } },
      { a: 0.01, b: 0.04, sx: 0.02, sy: 0.02, o: { dx: 0.01, dy: -0.05 } },
      { a: 0.03, b: 0.03, sx: 0.004, sy: 0.012, o: { dx: 0, dy: 0.04 } },
      { a: 0.1, b: 0.1, sx: 0.01, sy: 0.01, o: { dx: 0.05, dy: 0.05 } },
    ]
    for (const c of cases) {
      let hits = 0
      for (let i = 0; i < n; i++) {
        const x = (c.o.dx + c.sx * draw()) / c.a
        const y = (c.o.dy + c.sy * draw()) / c.b
        if (x * x + y * y <= 1) hits++
      }
      const model = ellipseProbability(c.a, c.b, { horizontal: c.sx, vertical: c.sy }, c.o)
      expect(Math.abs(model - hits / n)).toBeLessThan(0.005)
    }
  })

  it('is the centred result for a zero offset, bit for bit', () => {
    const sigma = { horizontal: 0.012, vertical: 0.007 }
    expect(ellipseProbability(0.03, 0.02, sigma, { dx: 0, dy: 0 })).toBe(
      ellipseProbability(0.03, 0.02, sigma),
    )
  })

  it('is zero when the zone lies beyond 8 standard deviations of x, and small beyond y', () => {
    const sigma = { horizontal: 0.001, vertical: 0.001 }
    expect(ellipseProbability(0.01, 0.01, sigma, { dx: 0.1, dy: 0 })).toBe(0)
    expect(ellipseProbability(0.01, 0.01, sigma, { dx: 0, dy: 0.1 })).toBeLessThan(1e-12)
  })

  it('rises and then falls with the dispersion when the offset exceeds the zone radius', () => {
    const r = 0.05
    const offset = { dx: 2 * r, dy: 0 }
    const at = (s: number) => ellipseProbability(r, r, { horizontal: s, vertical: s }, offset)
    const scan = Array.from({ length: 80 }, (_, i) => (0.1 + 0.05 * i) * r)
    const values = scan.map(at)
    const best = values.indexOf(Math.max(...values))
    expect(best).toBeGreaterThan(0)
    expect(best).toBeLessThan(values.length - 1)
    // the same zone without the offset only falls
    const centred = scan.map((s) => ellipseProbability(r, r, { horizontal: s, vertical: s }))
    expect(centred.every((p, i) => i === 0 || p <= (centred[i - 1] ?? 1))).toBe(true)
  })

  it('passes the offset through the zones of a face', () => {
    const zones = [
      { halfWidth: 0.1, halfHeight: 0.1, value: 1 },
      { halfWidth: 0.04, halfHeight: 0.04, value: 2 },
    ]
    const sigma = { horizontal: 0.03, vertical: 0.03 }
    const offset = { dx: 0.03, dy: -0.02 }
    const shifted = hitProbability(zones, sigma, offset)
    expect(shifted.hit).toBeCloseTo(ellipseProbability(0.1, 0.1, sigma, offset), 12)
    expect(shifted.zones.reduce((s, z) => s + z.probability, 0)).toBeCloseTo(shifted.hit, 10)
    expect(shifted.hit).not.toBeCloseTo(hitProbability(zones, sigma).hit, 3)
  })

  it('refuses a non-finite offset', () => {
    const sigma = { horizontal: 0.01, vertical: 0.01 }
    expect(() => ellipseProbability(0.01, 0.01, sigma, { dx: Number.NaN, dy: 0 })).toThrow(
      InputError,
    )
  })
})

describe('shots to a hit', () => {
  it('rounds ln(1 - P) / ln(1 - p) up and gives the mean number of shots to the first hit', () => {
    const r = shotsToHit(0.1, 0.9)
    expect(r.shots).toBe(22)
    expect(r.mean).toBeCloseTo(10, 12)
    expect(Math.log(0.1) / Math.log(0.9)).toBeCloseTo(21.85, 2)
    expect(1 - 0.9 ** r.shots).toBeGreaterThanOrEqual(0.9)
    expect(1 - 0.9 ** (r.shots - 1)).toBeLessThan(0.9)
  })

  it('keeps an exact whole result', () => {
    expect(shotsToHit(0.5, 0.75).shots).toBe(2)
    expect(shotsToHit(0.5, 0.875).shots).toBe(3)
  })

  it('reaches 1 - 1/e after the mean number of shots when p is small', () => {
    const p = 1e-4
    expect(1 - (1 - p) ** (1 / p)).toBeCloseTo(1 - Math.exp(-1), 4)
  })

  it('handles an impossible and a certain hit', () => {
    expect(shotsToHit(0, 0.9)).toEqual({ shots: Infinity, mean: Infinity })
    expect(shotsToHit(1, 0.99)).toEqual({ shots: 1, mean: 1 })
  })

  it('refuses a probability outside its range', () => {
    expect(() => shotsToHit(-0.1, 0.5)).toThrow(InputError)
    expect(() => shotsToHit(1.1, 0.5)).toThrow(InputError)
    expect(() => shotsToHit(0.5, 0)).toThrow(InputError)
    expect(() => shotsToHit(0.5, 1)).toThrow(InputError)
  })
})
