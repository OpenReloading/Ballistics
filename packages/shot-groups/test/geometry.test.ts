import { describe, expect, it } from 'vitest'
import {
  apply3,
  applyMatrix,
  type Calibration,
  calibrate,
  circleThrough,
  det3,
  inv3,
  invertMatrix,
  keepOnPhoto,
  mapMatrix,
  mul3,
  type Point,
  type Reference,
  rectangleCorners,
  solve,
  solveHomography,
  toImage,
  toMatrix,
  toTarget,
  transpose3,
  turnedBox,
  turnPoint,
} from '../src/geometry.ts'
import { defined } from './defined.ts'
import { issueOf } from './issue.ts'

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

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

describe('3 x 3 matrices', () => {
  const a = toMatrix([2, 3, 1, 4, 1, 5, 6, 2, 7])
  const b = toMatrix([1, 0, 2, 3, 1, 0, 0, 4, 1])

  it('takes 9 entries only', () => {
    expect(issueOf(() => toMatrix([1, 2, 3, 4, 5, 6, 7, 8]))).toEqual({
      code: 'matrix-size',
      params: { entries: 8 },
    })
  })

  it('multiplies, transposes, maps and applies row by row', () => {
    expect(mul3(a, b)).toEqual([11, 7, 5, 7, 21, 13, 12, 30, 19])
    expect(transpose3(a)).toEqual([2, 4, 6, 3, 1, 2, 1, 5, 7])
    expect(mapMatrix(a, (v, i) => v * 10 + i)).toEqual([20, 31, 12, 43, 14, 55, 66, 27, 78])
    expect(apply3(a, [2, -2, 3])).toEqual([1, 21, 29])
  })

  it('inverts by the determinant, and not a singular or infinite matrix', () => {
    expect(det3(a)).toBe(2)
    const inverse = defined(inv3(a))
    for (const [i, v] of mul3(a, inverse).entries()) expect(v).toBeCloseTo(i % 4 === 0 ? 1 : 0, 12)
    expect(inv3([1, 2, 3, 2, 4, 6, 0, 0, 1])).toBeUndefined()
    expect(inv3([Number.POSITIVE_INFINITY, 0, 0, 0, 1, 0, 0, 0, 1])).toBeUndefined()
    expect(issueOf(() => invertMatrix([1, 2, 3, 2, 4, 6, 0, 0, 1]))).toEqual({
      code: 'singular-matrix',
      params: {},
    })
  })
})

describe('linear systems', () => {
  it('solves a linear system and refuses a singular one', () => {
    const x = solve(
      [
        [0, 2, 1],
        [1, 1, 0],
        [2, 0, 3],
      ],
      [7, 3, 11],
    )
    expect(x[0]).toBeCloseTo(1, 12)
    expect(x[1]).toBeCloseTo(2, 12)
    expect(x[2]).toBeCloseTo(3, 12)
    expect(
      issueOf(() =>
        solve(
          [
            [1, 2],
            [2, 4],
          ],
          [1, 2],
        ),
      ),
    ).toEqual({ code: 'degenerate-points', params: {} })
  })
})

describe('turning the photo', () => {
  it('turns a point about a centre, counter-clockwise on screen with y down', () => {
    const p = turnPoint({ x: 3, y: 1 }, { x: 1, y: 1 }, Math.PI / 2)
    expect(p.x).toBeCloseTo(1, 12)
    expect(p.y).toBeCloseTo(-1, 12)
    const q = turnPoint({ x: 1, y: 4 }, { x: 1, y: 1 }, Math.PI / 2)
    expect(q.x).toBeCloseTo(4, 12)
    expect(q.y).toBeCloseTo(1, 12)
    // 30 degrees: cos 0.866, sin 0.5 of dx 2 and dy 1
    const r = turnPoint({ x: 3, y: 2 }, { x: 1, y: 1 }, Math.PI / 6)
    expect(r.x).toBeCloseTo(1 + Math.sqrt(3) + 0.5, 12)
    expect(r.y).toBeCloseTo(1 - 1 + Math.sqrt(3) / 2, 12)
  })

  it('boxes a turned photo', () => {
    expect(turnedBox(40, 20, 0)).toEqual({ x: 0, y: 0, w: 40, h: 20 })
    const quarter = turnedBox(40, 20, Math.PI / 2)
    expect(quarter.x).toBeCloseTo(10, 12)
    expect(quarter.y).toBeCloseTo(-10, 12)
    expect(quarter.w).toBeCloseTo(20, 12)
    expect(quarter.h).toBeCloseTo(40, 12)
  })
})

describe('solveHomography', () => {
  it('recovers a projective transform from four points within 1e-6 mm', () => {
    const h = solveHomography(corners, rectangleCorners(sheet.width, sheet.height))
    for (const q of [
      { x: 0, y: 0 },
      { x: 150, y: 100 },
      { x: 37.5, y: 181.25 },
      { x: 299, y: 1 },
    ]) {
      expect(dist(applyMatrix(h, photo(q)), q)).toBeLessThan(1e-6)
      expect(dist(applyMatrix(invertMatrix(h), q), photo(q))).toBeLessThan(1e-6)
    }
  })

  it('refuses three collinear points', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 200, y: 200 },
      { x: 0, y: 300 },
    ]
    expect(issueOf(() => solveHomography(line, rectangleCorners(1, 1)))).toEqual({
      code: 'collinear-points',
      params: {},
    })
    const lastThree = [
      { x: 0, y: 300 },
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 200, y: 200 },
    ]
    expect(issueOf(() => solveHomography(lastThree, rectangleCorners(1, 1)))).toEqual({
      code: 'collinear-points',
      params: {},
    })
  })

  it('takes four point pairs only', () => {
    const four = rectangleCorners(1, 1)
    expect(issueOf(() => solveHomography(four.slice(0, 3), four))).toEqual({
      code: 'four-point-pairs',
      params: {},
    })
    expect(issueOf(() => solveHomography(four, [...four, { x: 2, y: 2 }]))).toEqual({
      code: 'four-point-pairs',
      params: {},
    })
  })
})

describe('circleThrough', () => {
  it('finds centre and radius', () => {
    const c = circleThrough({ x: 15, y: 2 }, { x: 10, y: 7 }, { x: 5, y: 2 })
    expect(dist(c.centre, { x: 10, y: 2 })).toBeLessThan(1e-12)
    expect(c.radius).toBeCloseTo(5, 12)
    const off = circleThrough({ x: 8, y: 9 }, { x: 3, y: 4 }, { x: 13, y: 4 })
    expect(dist(off.centre, { x: 8, y: 4 })).toBeLessThan(1e-12)
  })

  it('refuses collinear points', () => {
    expect(issueOf(() => circleThrough({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }))).toEqual({
      code: 'collinear-points',
      params: {},
    })
    // off the line by 2.25e-6 at 2e6: within 1e-12 of the squared spans (5e12), so on it
    expect(
      issueOf(() => circleThrough({ x: 0, y: 0 }, { x: 1e6, y: 1 }, { x: 2e6, y: 2 + 2.25e-6 })),
    ).toEqual({ code: 'collinear-points', params: {} })
    expect(() =>
      circleThrough({ x: 0, y: 0 }, { x: 1e6, y: 1 }, { x: 2e6, y: 2 + 1e-5 }),
    ).not.toThrow()
  })
})

const origin = { x: 1000, y: 800 }
const line: Reference = { kind: 'line', a: { x: 0, y: 0 }, b: { x: 600, y: 800 }, length: 100 }
/** A point of the 500 px ring about (500, 500) at angle `a`. */
const ringPoint = (a: number) => ({ x: 500 + 250 * Math.cos(a), y: 500 + 250 * Math.sin(a) })

describe('calibrate', () => {
  it('scales from two points with y up and the origin at 0', () => {
    const c = calibrate([line], 0, origin)
    expect(c.factors).toEqual([0.1])
    expect(dist(toTarget(c, origin), { x: 0, y: 0 })).toBeLessThan(1e-12)
    expect(dist(toTarget(c, { x: 1010, y: 780 }), { x: 1, y: 2 })).toBeLessThan(1e-12)
    expect(dist(toImage(c, { x: 1, y: 2 }), { x: 1010, y: 780 })).toBeLessThan(1e-9)
  })

  it('scales from a ring centre and a point on it, or three points on it', () => {
    const centre = { x: 500, y: 500 }
    const byCentre = calibrate(
      [{ kind: 'ringCentre', centre, edge: ringPoint(1), diameter: 50 }],
      0,
      origin,
    )
    const byEdge = calibrate(
      [{ kind: 'ringEdge', points: [ringPoint(0.2), ringPoint(2), ringPoint(4)], diameter: 50 }],
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
})

describe('calibrate on a rectangle', () => {
  it('rectifies a photo taken at an angle from a known rectangle', () => {
    const rect: Reference = { kind: 'rectangle', corners, ...sheet }
    const c = calibrate([rect], 0, photo({ x: 150, y: 100 }))
    for (const [i, q] of [
      { x: 140, y: 95 },
      { x: 152, y: 103 },
    ].entries())
      expect(dist(toTarget(c, defined(holes[i])), { x: q.x - 150, y: q.y - 100 })).toBeLessThan(
        1e-6,
      )
    // a ring of 50 mm drawn on the sheet, measured after rectifying
    const ring = (a: number) => photo({ x: 150 + 25 * Math.cos(a), y: 100 + 25 * Math.sin(a) })
    const both = calibrate(
      [
        rect,
        {
          kind: 'ringEdge',
          points: [ring(0.3), ring(2.1), ring(4.4)],
          diameter: 50,
        },
      ],
      0,
      photo({ x: 150, y: 100 }),
    )
    expect(both.factors[0]).toBe(1)
    expect(both.factors[1]).toBeCloseTo(1, 9)
  })

  it('allows one rectangle and refuses lengths of zero', () => {
    const rect: Reference = { kind: 'rectangle', corners, ...sheet }
    expect(issueOf(() => calibrate([rect, rect], 0, origin))).toEqual({
      code: 'one-rectangle',
      params: {},
    })
    expect(issueOf(() => calibrate([{ ...line, b: line.a }], 0, origin))).toEqual({
      code: 'reference-length',
      params: { reference: 'line' },
    })
    expect(issueOf(() => calibrate([{ ...line, length: 0 }], 0, origin))).toEqual({
      code: 'reference-length',
      params: { reference: 'line' },
    })
    expect(issueOf(() => calibrate([], 0, origin))).toEqual({
      code: 'reference-needed',
      params: {},
    })
  })
})

/** The distances between every two of the points. */
const pairs = (qs: Point[]) => qs.flatMap((a, i) => qs.slice(i + 1).map((b) => dist(a, b)))

describe('keepOnPhoto', () => {
  const rect = { kind: 'rectangle' as const, corners, ...sheet }
  const before = calibrate([rect], 0, photo({ x: 150, y: 100 }))
  const shots = holes.map((p) => toTarget(before, p))
  const check = (after: Calibration, ratio: number) => {
    const moved = shots.map((q) => keepOnPhoto(q, before, after))
    moved.forEach((q, i) => {
      expect(dist(toImage(after, q), defined(holes[i]))).toBeLessThan(1e-9)
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
      expect(
        dist(q, {
          x: c * defined(shots[i]).x - s * defined(shots[i]).y,
          y: s * defined(shots[i]).x + c * defined(shots[i]).y,
        }),
      ).toBeLessThan(1e-9)
    })
  })

  it('keeps every shot on its hole when the calibration changes', () => {
    const moved = check(
      calibrate([{ ...rect, width: 303, height: 202 }], 0, photo({ x: 150, y: 100 })),
      1.01,
    )
    expect(moved).toHaveLength(holes.length)
  })

  it('keeps target coordinates when nothing changes', () => {
    shots.forEach((q) => {
      expect(dist(keepOnPhoto(q, before, before), q)).toBeLessThan(1e-9)
    })
  })
})
