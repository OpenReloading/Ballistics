import type { TargetFace } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { faceAlignment, scoreShot } from '../src/lib/ring-scoring.ts'

const mmq = (value: number) => ({ value })
const mm = 1e-3
/** Well above the scoring tolerance of 1e-9 mm. */
const off = 1e-6

/** A face of the given rings (value, width, height or shape) and the extras of one test. */
function faceOf(
  rings: { value: number; w: number; h?: number; shape?: 'circle' | 'square' }[],
  extra: Partial<TargetFace> = {},
): TargetFace {
  return {
    id: 'test-face',
    name: 'Test face',
    organization: 'Test',
    rings: rings.map((r) => ({
      value: r.value,
      diameter: mmq(r.w),
      ...(r.h && { height: mmq(r.h) }),
      ...(r.shape && { shape: r.shape }),
    })),
    blackDiameter: mmq(rings[0].w),
    events: [{ name: 'Test event', distance: mmq(10000) }],
    provenance: { kind: 'published', sources: [{ title: 'Test rule book' }] },
    ...extra,
  } as TargetFace
}

/** A shot at x, y mm from the face centre, in target m. */
const shot = (x: number, y: number) => ({ x: x * mm, y: y * mm })

describe('scoreShot on an oval face', () => {
  // 9: 100 wide, 60 high; 10: 40 wide, 20 high
  const oval = faceOf([
    { value: 9, w: 100, h: 60 },
    { value: 10, w: 40, h: 20 },
  ])

  it('counts a hole centre on the ring line as inside along both axes', () => {
    expect(scoreShot(oval, shot(50, 0), 0).value).toBe(9)
    expect(scoreShot(oval, shot(-50, 0), 0).value).toBe(9)
    expect(scoreShot(oval, shot(0, 30), 0).value).toBe(9)
    expect(scoreShot(oval, shot(0, -30), 0).value).toBe(9)
    expect(scoreShot(oval, shot(20, 0), 0).value).toBe(10)
    expect(scoreShot(oval, shot(0, 10), 0).value).toBe(10)
  })

  it('counts a hole centre just inside and just outside along both axes', () => {
    expect(scoreShot(oval, shot(50 - off, 0), 0).value).toBe(9)
    expect(scoreShot(oval, shot(50 + off, 0), 0).value).toBe(0)
    expect(scoreShot(oval, shot(0, 30 - off), 0).value).toBe(9)
    expect(scoreShot(oval, shot(0, 30 + off), 0).value).toBe(0)
    expect(scoreShot(oval, shot(20 - off, 0), 0).value).toBe(10)
    expect(scoreShot(oval, shot(20 + off, 0), 0).value).toBe(9)
    expect(scoreShot(oval, shot(0, 10 - off), 0).value).toBe(10)
    expect(scoreShot(oval, shot(0, 10 + off), 0).value).toBe(9)
  })

  it('scores by height on the vertical axis, not by the width', () => {
    // 40 mm above the centre is inside a circle of the width and outside the oval
    expect(scoreShot(oval, shot(0, 40), 0).value).toBe(0)
    expect(scoreShot(oval, shot(40, 0), 0).value).toBe(9)
  })

  it('adds the hole radius along both axes', () => {
    const hole = 4 * mm
    expect(scoreShot(oval, shot(52, 0), hole).value).toBe(9)
    expect(scoreShot(oval, shot(52 + off, 0), hole).value).toBe(0)
    expect(scoreShot(oval, shot(0, 32), hole).value).toBe(9)
    expect(scoreShot(oval, shot(0, 32 + off), hole).value).toBe(0)
  })

  it('touches off the axes when the hole reaches the ellipse, as a brute-force search finds', () => {
    const [a, b] = [50, 30]
    const nearest = (x: number, y: number) => {
      let best = Number.POSITIVE_INFINITY
      for (let i = 0; i <= 200000; i++) {
        const t = (i / 200000) * 2 * Math.PI
        best = Math.min(best, Math.hypot(a * Math.cos(t) - x, b * Math.sin(t) - y))
      }
      return best
    }
    for (const [x, y] of [
      [40, 25],
      [55, 12],
      [20, 38],
      [-45, 30],
      [3, -33],
    ]) {
      const gap = nearest(x, y)
      expect(scoreShot(oval, shot(x, y), 2 * (gap + 1e-3) * mm).value).toBe(9)
      expect(scoreShot(oval, shot(x, y), 2 * (gap - 1e-3) * mm).value).toBe(0)
    }
  })
})

describe('scoreShot on a face with several bulls', () => {
  const rings = [
    { value: 9, w: 20 },
    { value: 10, w: 10 },
  ]
  const bulls = [
    { x: mmq(-8), y: mmq(0), zone: 'left' },
    { x: mmq(8), y: mmq(0), zone: 'right' },
  ]
  const two = faceOf(rings, { bulls })

  it('scores a shot against the nearest bull', () => {
    // 5 mm from the right bull and 11 mm from the left one
    expect(scoreShot(two, shot(3, 0), 0)).toMatchObject({ value: 10, zone: 'right' })
    expect(scoreShot(two, shot(-13, 0), 0)).toMatchObject({ value: 10, zone: 'left' })
  })

  it('scores a shot near each bull by that bull', () => {
    expect(scoreShot(two, shot(-8, 10), 0)).toMatchObject({ value: 9, zone: 'left' })
    expect(scoreShot(two, shot(8, -10 - off), 0)).toMatchObject({ value: 0, zone: 'right' })
    expect(scoreShot(two, shot(8 + 9, 0), 0)).toMatchObject({ value: 9, zone: 'right' })
  })

  it('gives an equidistant shot to the first bull of the record', () => {
    // 9.43 mm from both bulls: ring 9 for either
    expect(scoreShot(two, shot(0, 5), 0)).toMatchObject({ value: 9, zone: 'left' })
    const swapped = faceOf(rings, { bulls: [bulls[1], bulls[0]] })
    expect(scoreShot(swapped, shot(0, 5), 0)).toMatchObject({ value: 9, zone: 'right' })
  })

  it('scores a shot far from every bull as a miss', () => {
    expect(scoreShot(two, shot(0, 100), 0).value).toBe(0)
  })

  it('leaves out the zone for a bull without a label and for a face without bulls', () => {
    const plain = faceOf(rings, { bulls: [{ x: mmq(5), y: mmq(0) }] })
    expect(scoreShot(plain, shot(5, 0), 0)).toEqual({ value: 10, innerTen: false })
    expect(scoreShot(faceOf(rings), shot(0, 0), 0)).toEqual({ value: 10, innerTen: false })
  })
})

describe('scoreShot on a two-zone card', () => {
  const card = faceOf(
    [
      { value: 8, w: 60 },
      { value: 9, w: 30 },
      { value: 10, w: 10 },
    ],
    {
      bulls: [
        { x: mmq(0), y: mmq(50), zone: 'upper' },
        { x: mmq(0), y: mmq(-50), zone: 'lower' },
      ],
      innerTen: { diameter: mmq(4) },
    },
  )

  it('scores each zone by its own bull and names the zone', () => {
    expect(scoreShot(card, shot(0, 52), 0)).toEqual({
      value: 10,
      innerTen: true,
      zone: 'upper',
    })
    expect(scoreShot(card, shot(10, -50), 0)).toEqual({
      value: 9,
      innerTen: false,
      zone: 'lower',
    })
    expect(scoreShot(card, shot(0, 50 - 30), 0)).toMatchObject({ value: 8, zone: 'upper' })
    expect(scoreShot(card, shot(0, 50 - 30 - off), 0)).toMatchObject({ value: 0, zone: 'upper' })
  })

  it('does not score the band between the zones', () => {
    expect(scoreShot(card, shot(0, 0), 0).value).toBe(0)
  })
})

describe('scoreShot with a square area', () => {
  // outer square of 100 mm edge, then a circle of 60 mm
  const square = faceOf([
    { value: 4, w: 100, shape: 'square' },
    { value: 5, w: 60 },
  ])

  it('counts a hole centre on the edge as inside and just outside as outside', () => {
    for (const [x, y] of [
      [50, 0],
      [-50, 10],
      [0, 50],
      [20, -50],
      [50, 50],
    ]) {
      expect(scoreShot(square, shot(x, y), 0).value).toBe(4)
    }
    expect(scoreShot(square, shot(50 + off, 0), 0).value).toBe(0)
    expect(scoreShot(square, shot(0, -50 - off), 0).value).toBe(0)
    expect(scoreShot(square, shot(50 + off, 50), 0).value).toBe(0)
  })

  it('counts the corner of the square, not a circle through it', () => {
    // 70 mm from the centre: outside the circle of the edge, inside the square
    expect(scoreShot(square, shot(49, 49), 0).value).toBe(4)
  })

  it('adds the hole radius to the edge and rounds it at the corner', () => {
    const hole = 4 * mm
    expect(scoreShot(square, shot(52, 0), hole).value).toBe(4)
    expect(scoreShot(square, shot(52 + off, 0), hole).value).toBe(0)
    // 2.83 mm from the corner against a 2 mm hole radius, then 1.98 mm
    expect(scoreShot(square, shot(52, 52), hole).value).toBe(0)
    expect(scoreShot(square, shot(51.4, 51.4), hole).value).toBe(4)
  })

  it('scores the rings inside the square as before', () => {
    expect(scoreShot(square, shot(30, 0), 0).value).toBe(5)
    expect(scoreShot(square, shot(30 + off, 0), 0).value).toBe(4)
  })
})

describe('faceAlignment', () => {
  it('refuses ring marks on a face with several bulls or with oval rings', () => {
    const marks = [
      { ring: 9, x: 0.01, y: 0 },
      { ring: 9, x: -0.01, y: 0 },
      { ring: 10, x: 0, y: 0.005 },
      { ring: 10, x: 0, y: -0.005 },
    ]
    const rings = [
      { value: 9, w: 20 },
      { value: 10, w: 10 },
    ]
    const bulls = faceOf(rings, { bulls: [{ x: mmq(0), y: mmq(0) }] })
    expect(() => faceAlignment(bulls, marks, undefined)).toThrow('one bull')
    const oval = faceOf([
      { value: 9, w: 20, h: 14 },
      { value: 10, w: 10, h: 6 },
    ])
    expect(() => faceAlignment(oval, marks, undefined)).toThrow('circular')
  })
})
