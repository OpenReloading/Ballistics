import { seededUniforms } from '@open-reloading/statistics'
import { describe, expect, it } from 'vitest'
import {
  type Conic,
  concentricPlane,
  conicOf,
  type Ellipse,
  ellipseOf,
  ellipsePoint,
  fitEllipse,
  mapConic,
  ransacEllipse,
  sampson,
} from '../src/ellipse.ts'

// The refusals and special cases of the conic code: degenerate, imaginary and centered conics.

const unitCircle: Conic = [1, 0, 1, 0, 0, -1]
const circle = (centreX: number, centreY: number, r: number): Conic =>
  conicOf({ centreX, centreY, semiMajor: r, semiMinor: r, angle: 0 })
const ring = (e: Ellipse, n: number) =>
  Array.from({ length: n }, (_, k) => ellipsePoint(e, (2 * Math.PI * k) / n))

describe('fitEllipse and ellipseOf on what is no ellipse', () => {
  it('fits nothing to one point repeated', () => {
    expect(fitEllipse(Array.from({ length: 6 }, () => ({ x: 1, y: 2 })))).toBeUndefined()
  })

  it('gives no ellipse for a hyperbola or an imaginary conic, and a circle at angle 0', () => {
    expect(ellipseOf([1, 0, -1, 0, 0, -1])).toBeUndefined()
    expect(ellipseOf([1, 0, 1, 0, 0, 1])).toBeUndefined()
    expect(ellipseOf(unitCircle)).toEqual({
      centreX: 0,
      centreY: 0,
      semiMajor: 1,
      semiMinor: 1,
      angle: 0,
    })
  })

  it('puts a point where the conic has no slope infinitely far', () => {
    expect(sampson(unitCircle, { x: 0, y: 0 })).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('ransacEllipse at its limits', () => {
  const truth: Ellipse = { centreX: 50, centreY: 40, semiMajor: 30, semiMinor: 20, angle: 0.3 }

  it('needs six points', () => {
    expect(ransacEllipse(ring(truth, 5), { tolerance: 1, minPoints: 1 })).toBeUndefined()
  })

  it('keeps the sampled fit when the refit is refused', () => {
    let calls = 0
    const fit = ransacEllipse(ring(truth, 50), {
      tolerance: 1,
      minPoints: 6,
      rounds: 1,
      accept: () => calls++ < 1,
    })
    expect(fit?.inliers).toHaveLength(50)
  })

  it('skips samples without a fit and grows the inliers by refitting', () => {
    const rnd = seededUniforms(5)
    const noisy = ring(truth, 80).map((p) => ({
      x: p.x + (rnd() - 0.5),
      y: p.y + (rnd() - 0.5),
    }))
    const repeated = [...noisy, ...Array.from({ length: 80 }, () => ({ x: 0, y: 0 }))]
    const fit = ransacEllipse(
      repeated,
      { tolerance: 0.4, minPoints: 6, rounds: 40 },
      seededUniforms(2),
    )
    expect(fit?.inliers.length).toBeGreaterThan(40)
  })
})

describe('concentricPlane on special pairs', () => {
  it('refuses one conic twice, a degenerate or infinite conic and an imaginary pair', () => {
    expect(concentricPlane(unitCircle, unitCircle)).toBeUndefined()
    expect(concentricPlane([1, 0, 0, 0, 0, 0], unitCircle)).toBeUndefined()
    expect(concentricPlane(unitCircle, [1, 0, 0, 0, 0, 0])).toBeUndefined()
    expect(concentricPlane(unitCircle, [Number.POSITIVE_INFINITY, 0, 1, 0, 0, -1])).toBeUndefined()
    expect(concentricPlane([1, 0, 1, 0, 0, 1], [1, 0, 1, 0, 0, 4])).toBeUndefined()
  })

  it('refuses a pair whose single point lies outside the first conic', () => {
    // the pencil of the unit circle and the parabola y^2 + x = 5/4 has its single point at (2, 0)
    expect(concentricPlane(unitCircle, [0, 0, 1, 1, 0, -1.25])).toBeUndefined()
  })

  it('refuses a pair whose common center lies at infinity', () => {
    expect(concentricPlane([1, 0, -1, 0, 0, 1], [4, 0, -1, 0, 0, 1])).toBeUndefined()
  })

  it('maps circles about the origin onto themselves, also from the negated conic', () => {
    const plane = concentricPlane(unitCircle, circle(0, 0, 0.4))
    expect(plane?.centre).toEqual({ x: 0, y: 0 })
    expect(plane?.ratio).toBeCloseTo(2.5, 12)
    const negated: Conic = [-1, 0, -1, 0, 0, 1]
    expect(concentricPlane(negated, circle(0, 0, 0.4))).toEqual(plane)
  })

  it('finds the center of circles off the origin and of ellipses turned by 45 degrees', () => {
    const off = concentricPlane(circle(2, 0, 1), circle(2, 0, 0.4))
    expect(off?.centre.x).toBeCloseTo(2, 12)
    expect(off?.centre.y).toBeCloseTo(0, 12)
    const turned = concentricPlane([1, 1, 1, 0, 0, -1], [1, 1, 1, 0, 0, -0.16])
    expect(turned?.ratio).toBeCloseTo(2.5, 12)
  })
})

describe('concentricPlane about centers all around the origin', () => {
  it('finds each center', () => {
    for (const [x, y] of [
      [3, 0],
      [0, 3],
      [-3, 0],
      [0, -3],
      [2, -5],
      [-4, 1],
    ] as const) {
      const plane = concentricPlane(circle(x, y, 1), circle(x, y, 0.4))
      expect(plane?.centre.x).toBeCloseTo(x, 9)
      expect(plane?.centre.y).toBeCloseTo(y, 9)
    }
  })
})

describe('mapConic', () => {
  it('gives nothing through a singular map', () => {
    expect(mapConic(unitCircle, [0, 0, 0, 0, 0, 0, 0, 0, 0])).toBeUndefined()
  })
})
