import { describe, expect, it } from 'vitest'
import {
  applyMatrix,
  type Calibration,
  calibrate,
  circleThrough,
  invertMatrix,
  keepOnPhoto,
  type Point,
  type Reference,
  rectangleCorners,
  solveHomography,
  toImage,
  toTarget,
} from '../src/lib/target-geometry.ts'
import { defined } from './defined.ts'

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const close = (a: Point, b: Point, tol: number) => expect(dist(a, b)).toBeLessThan(tol)

// Target mm (y up) to image px (y down) with perspective: h31 and h32 are not 0.
const truth = [18, 1.5, 3000, -0.8, -17, 3200, 2e-4, -1.5e-4, 1]
const photo = (q: Point) => applyMatrix(truth, q)
const sheet = { width: 300, height: 200 }
const corners = rectangleCorners(sheet.width, sheet.height).map(photo) as [
  Point,
  Point,
  Point,
  Point,
]
const holes = [
  { x: 140, y: 95 },
  { x: 152, y: 103 },
  { x: 147, y: 88 },
  { x: 161, y: 99 },
].map(photo)

describe('solveHomography', () => {
  it('recovers a projective transform from four points within 1e-6 mm', () => {
    const h = solveHomography(corners, rectangleCorners(sheet.width, sheet.height))
    for (const q of [
      { x: 0, y: 0 },
      { x: 150, y: 100 },
      { x: 37.5, y: 181.25 },
      { x: 299, y: 1 },
    ]) {
      close(applyMatrix(h, photo(q)), q, 1e-6)
      close(applyMatrix(invertMatrix(h), q), photo(q), 1e-6)
    }
  })

  it('refuses three collinear points', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 200, y: 200 },
      { x: 0, y: 300 },
    ]
    expect(() => solveHomography(line, rectangleCorners(1, 1))).toThrow()
  })
})

describe('circleThrough', () => {
  it('finds centre and radius', () => {
    const c = circleThrough({ x: 15, y: 2 }, { x: 10, y: 7 }, { x: 5, y: 2 })
    close(c.centre, { x: 10, y: 2 }, 1e-12)
    expect(c.radius).toBeCloseTo(5, 12)
  })

  it('refuses collinear points', () => {
    expect(() => circleThrough({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 })).toThrow()
  })
})

describe('calibrate', () => {
  const origin = { x: 1000, y: 800 }
  const line: Reference = { kind: 'line', a: { x: 0, y: 0 }, b: { x: 600, y: 800 }, length: 100 }

  it('scales from two points with y up and the origin at 0', () => {
    const c = calibrate([line], 0, origin)
    expect(c.factors).toEqual([0.1])
    close(toTarget(c, origin), { x: 0, y: 0 }, 1e-12)
    close(toTarget(c, { x: 1010, y: 780 }), { x: 1, y: 2 }, 1e-12)
    close(toImage(c, { x: 1, y: 2 }), { x: 1010, y: 780 }, 1e-9)
  })

  it('scales from a ring centre and a point on it, or three points on it', () => {
    const centre = { x: 500, y: 500 }
    const ring = (a: number) => ({ x: 500 + 250 * Math.cos(a), y: 500 + 250 * Math.sin(a) })
    const byCentre = calibrate(
      [{ kind: 'ringCentre', centre, edge: ring(1), diameter: 50 }],
      0,
      origin,
    )
    const byEdge = calibrate(
      [{ kind: 'ringEdge', points: [ring(0.2), ring(2), ring(4)], diameter: 50 }],
      0,
      origin,
    )
    expect(byCentre.factors[0]).toBeCloseTo(0.1, 12)
    expect(byEdge.factors[0]).toBeCloseTo(0.1, 12)
  })

  it('averages references and reports their spread', () => {
    const other: Reference = { ...line, b: { x: 0, y: 1000 }, length: 102 }
    const c = calibrate([line, other], 0, origin)
    expect(c.factors).toEqual([0.1, 0.102])
    expect(c.scale).toBeCloseTo(0.101, 12)
    expect(c.spread).toBeCloseTo(0.002 / 0.101, 12)
    expect(calibrate([line], 0, origin).spread).toBe(0)
  })

  it('rectifies a photo taken at an angle from a known rectangle', () => {
    const rect: Reference = { kind: 'rectangle', corners, ...sheet }
    const c = calibrate([rect], 0, photo({ x: 150, y: 100 }))
    for (const [i, q] of [
      { x: 140, y: 95 },
      { x: 152, y: 103 },
    ].entries())
      close(toTarget(c, defined(holes[i])), { x: q.x - 150, y: q.y - 100 }, 1e-6)
    // a ring of 50 mm drawn on the sheet, measured after rectifying
    const ring = (a: number) => photo({ x: 150 + 25 * Math.cos(a), y: 100 + 25 * Math.sin(a) })
    const both = calibrate(
      [rect, { kind: 'ringEdge', points: [ring(0.3), ring(2.1), ring(4.4)], diameter: 50 }],
      0,
      photo({ x: 150, y: 100 }),
    )
    expect(both.factors[0]).toBe(1)
    expect(both.factors[1]).toBeCloseTo(1, 9)
  })

  it('allows one rectangle and refuses lengths of zero', () => {
    const rect: Reference = { kind: 'rectangle', corners, ...sheet }
    expect(() => calibrate([rect, rect], 0, origin)).toThrow()
    expect(() => calibrate([{ ...line, b: line.a }], 0, origin)).toThrow()
    expect(() => calibrate([], 0, origin)).toThrow()
  })
})

describe('keepOnPhoto', () => {
  const rect = { kind: 'rectangle' as const, corners, ...sheet }
  const before = calibrate([rect], 0, photo({ x: 150, y: 100 }))
  const shots = holes.map((p) => toTarget(before, p))
  const pairs = (qs: Point[]) => qs.flatMap((a, i) => qs.slice(i + 1).map((b) => dist(a, b)))
  const check = (after: Calibration, ratio: number) => {
    const moved = shots.map((q) => keepOnPhoto(q, before, after))
    moved.forEach((q, i) => {
      close(toImage(after, q), defined(holes[i]), 1e-9)
    })
    pairs(moved).forEach((d, i) => {
      expect(d).toBeCloseTo(defined(pairs(shots)[i]) * ratio, 9)
    })
    return moved
  }

  it('keeps every shot on its hole when the target is rotated by any angle', () => {
    const angle = (37 * Math.PI) / 180
    const moved = check(calibrate([rect], angle, photo({ x: 150, y: 100 })), 1)
    // target axes turned by +37 degrees: coordinates turn by -37 degrees
    const [c, s] = [Math.cos(-angle), Math.sin(-angle)]
    moved.forEach((q, i) => {
      close(
        q,
        {
          x: c * defined(shots[i]).x - s * defined(shots[i]).y,
          y: s * defined(shots[i]).x + c * defined(shots[i]).y,
        },
        1e-9,
      )
    })
  })

  it('keeps every shot on its hole when the calibration changes', () => {
    check(calibrate([{ ...rect, width: 303, height: 202 }], 0, photo({ x: 150, y: 100 })), 1.01)
  })

  it('keeps target coordinates when nothing changes', () => {
    shots.forEach((q) => {
      close(keepOnPhoto(q, before, before), q, 1e-9)
    })
  })
})
