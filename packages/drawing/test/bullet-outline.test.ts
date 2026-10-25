import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  assumedBoatTailAngle,
  type BulletDimensions,
  bulletOutline,
  type Outline,
} from '../src/bullet/index.ts'
import { profileCrossesItself, triangleArea2 } from '../src/bullet/outline.ts'
import type { SectionPoint } from '../src/core/types.ts'
import { defined } from './defined.ts'

const deg = Math.PI / 180
const d = 7.823
const a = d / 2

/** The outline of a consistent input; fails the test on a reason. */
function drawn(b: BulletDimensions, given?: 'sourced' | 'entered'): Outline {
  const o = bulletOutline(b, given)
  if ('reason' in o) throw new Error(o.reason)
  return o
}

const reason = (b: BulletDimensions) => {
  const o = bulletOutline(b)
  return 'reason' in o ? o.reason : undefined
}

/** Points of the nose: after the shank end, before the tip on the axis. */
const nose = (o: Outline) =>
  o.points.filter(([r, z]) => z > (o.points.at(-1)?.[1] ?? 0) - o.noseLength && r > 0)

/** Centre and radius of the circle through three points, [r, z]. */
function circle([p, q, s]: [SectionPoint, SectionPoint, SectionPoint]): {
  c: SectionPoint
  r: number
} {
  const [ax, ay, bx, by, cx, cy] = [...p, ...q, ...s]
  const k = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
  const ux =
    ((ax ** 2 + ay ** 2) * (by - cy) +
      (bx ** 2 + by ** 2) * (cy - ay) +
      (cx ** 2 + cy ** 2) * (ay - by)) /
    k
  const uy =
    ((ax ** 2 + ay ** 2) * (cx - bx) +
      (bx ** 2 + by ** 2) * (ax - cx) +
      (cx ** 2 + cy ** 2) * (bx - ax)) /
    k
  return { c: [ux, uy], r: Math.hypot(ax - ux, ay - uy) }
}

const dist = (p: SectionPoint, q: SectionPoint) => Math.hypot(p[0] - q[0], p[1] - q[1])
/** The invariants every outline keeps. */
function expectValid(o: Outline, b: BulletDimensions) {
  expect(o.points.length).toBeGreaterThan(3)
  expect(o.tags.length).toBe(o.points.length)
  expect(o.points[0]).toEqual([0, 0])
  expect(o.points.at(-1)?.[0]).toBe(0)
  expect(o.points.at(-1)?.[1]).toBeCloseTo(b.length, 9)
  for (let k = 1; k < o.points.length; k++)
    expect(defined(o.points[k])[1]).toBeGreaterThanOrEqual(defined(o.points[k - 1])[1])
  for (const [r] of o.points) {
    expect(r).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThanOrEqual(b.diameter / 2 + 1e-9)
  }
  expect(profileCrossesItself(o.points)).toBe(false)
  // no spike: two edges in a row never run back along one line
  for (let k = 2; k < o.points.length; k++) {
    const [p, q, s] = [defined(o.points[k - 2]), defined(o.points[k - 1]), defined(o.points[k])]
    const dot = (q[0] - p[0]) * (s[0] - q[0]) + (q[1] - p[1]) * (s[1] - q[1])
    expect(Math.abs(triangleArea2(p, q, s)) < 1e-12 && dot < 0).toBe(false)
  }
  expect(o.volume).toBeGreaterThan(0)
  expect(o.areaCentreZ).toBeGreaterThan(0)
  expect(o.areaCentreZ).toBeLessThan(b.length)
}

const base: BulletDimensions = {
  diameter: d,
  length: 32.69,
  noseLength: 20.193,
  base: { type: 'flat' },
}
/** Tangent radius over a nose n and drop k (McCoy, ARBRL-TR-02293, 1981, PDF p. 13). */
const tangentRadius = (n: number, k: number) => (n ** 2 + k ** 2) / (2 * k)

describe('nose forms', () => {
  it('tangent: every nose point lies on the circle of radius Rt centred level with the shank end', () => {
    const b = { ...base, meplatDiameter: 1, ogive: { form: 'tangent' } }
    const o = drawn(b)
    const k = a - 0.5
    const rt = tangentRadius(20.193, k)
    const z0 = 32.69 - 20.193
    const centre: SectionPoint = [a - rt, z0]
    for (const p of nose(o)) expect(dist(p, centre)).toBeCloseTo(rt, 9)
    expect(o.points.at(-2)).toEqual([0.5, 32.69])
    expect(o.tags.filter((t) => t === 'approximate')).toEqual([])
  })

  it('tangent: Rt/R 1 and no form give the same points', () => {
    const one = drawn({ ...base, ogive: { radiusRatio: 1 } })
    const plain = drawn(base)
    expect(one.points.length).toBe(plain.points.length)
    one.points.forEach((p, j) => {
      expect(p[0]).toBeCloseTo(defined(plain.points[j])[0], 9)
    })
    expect(plain.notes.join(' ')).toMatch(/assumed tangent ogive/)
  })

  it('secant: Rt/R 0.5 puts the nose on a circle of radius 2 Rt through both ends, with a kink at the shank', () => {
    const o = drawn({ ...base, meplatDiameter: 0, ogive: { form: 'secant', radiusRatio: 0.5 } })
    const rt = tangentRadius(20.193, a)
    const pts = nose(o)
    const fit = circle([defined(pts[0]), defined(pts[10]), defined(pts[20])])
    expect(fit.r).toBeCloseTo(2 * rt, 6)
    for (const p of [[a, 32.69 - 20.193] as SectionPoint, ...pts, [0, 32.69] as SectionPoint])
      expect(dist(p, fit.c)).toBeCloseTo(2 * rt, 6)
    // the first nose chord leaves the shank inward at a finite angle
    const z0 = 32.69 - 20.193
    expect((a - defined(pts[0])[0]) / (defined(pts[0])[1] - z0)).toBeGreaterThan(0.05)
  })

  it('secant: the radius and Rt/R give the same nose; a disagreeing pair is refused', () => {
    const rt = tangentRadius(20.193, a)
    const byRatio = drawn({ ...base, ogive: { radiusRatio: 0.5 } })
    const byRadius = drawn({ ...base, ogive: { radius: 2 * rt } })
    byRatio.points.forEach((p, j) => {
      expect(p[0]).toBeCloseTo(defined(byRadius.points[j])[0], 9)
    })
    expect(reason({ ...base, ogive: { radius: 2 * rt, radiusRatio: 0.7 } })).toMatch(/Rt\/R/)
  })

  it('cone at Rt/R 0: volume and area centre of a cylinder and a cone', () => {
    const [s, n] = [12.497, 20.193]
    const o = drawn({ ...base, meplatDiameter: 0, ogive: { radiusRatio: 0 } })
    for (const [r, z] of nose(o)) expect(r).toBeCloseTo(a * (1 - (z - s) / n), 9)
    expect(o.volume).toBeCloseTo((Math.PI * d ** 2 * s) / 4 + (Math.PI * d ** 2 * n) / 12, 6)
    expect(o.area).toBeCloseTo(d * s + (d * n) / 2, 9)
    expect(o.areaCentreZ).toBeCloseTo(
      ((d * s ** 2) / 2 + ((d * n) / 2) * (s + n / 3)) / (d * s + (d * n) / 2),
      9,
    )
  })

  it('hybrid: a blend arc tangent to the shank joins a secant arc of radius R internally tangent', () => {
    const o = drawn({ ...base, meplatDiameter: 0, ogive: { form: 'hybrid', radiusRatio: 0.5 } })
    const rt = tangentRadius(20.193, a)
    const pts = nose(o)
    const first = circle([defined(pts[0]), defined(pts[1]), defined(pts[2])])
    const last = circle([defined(pts.at(-3)), defined(pts.at(-2)), defined(pts.at(-1))])
    expect(first.r).toBeCloseTo(rt / 2, 6)
    expect(first.c[1]).toBeCloseTo(32.69 - 20.193, 6)
    expect(last.r).toBeCloseTo(2 * rt, 4)
    expect(dist(first.c, last.c)).toBeCloseTo(2 * rt - rt / 2, 4)
    expect(o.notes.join(' ')).toMatch(/blend radius is assumed/)
    expect(o.tags).toContain('approximate')
  })

  it('round nose: a hemisphere of radius a on a cylinder', () => {
    const s = 10
    const o = drawn({
      diameter: d,
      length: s + a,
      noseLength: a,
      meplatDiameter: 0,
      base: { type: 'flat' },
      ogive: { form: 'round-nose' },
    })
    for (const p of nose(o)) expect(dist(p, [0, s])).toBeCloseTo(a, 9)
    const exact = Math.PI * a ** 2 * s + (2 / 3) * Math.PI * a ** 3
    expect(Math.abs(o.volume / exact - 1)).toBeLessThan(2e-3)
  })

  it('flat nose: a quarter ellipse to a meplat of 0.6 d unless given', () => {
    const o = drawn({
      diameter: d,
      length: 20,
      noseLength: 4,
      base: { type: 'flat' },
      ogive: { form: 'flat-nose' },
    })
    expect(o.points.at(-2)).toEqual([0.3 * d, 20])
    expect(o.notes.join(' ')).toMatch(/meplat is assumed: 0.6 d/)
  })
})

describe('base', () => {
  it('boat tail from length and base diameter: the angle is derived, the volume a frustum and cylinder', () => {
    const o = drawn({ ...base, base: { type: 'boat-tail', length: 5, diameter: 6.5 } }, 'entered')
    expect(o.points[1]).toEqual([3.25, 0])
    expect(o.tags.slice(0, 3)).toEqual(['entered', 'entered', 'entered'])
    expect(o.notes.join(' ')).not.toMatch(/angle/)
    const frustum = (Math.PI * 5 * (3.25 ** 2 + 3.25 * a + a ** 2)) / 3
    const shank = Math.PI * a ** 2 * (32.69 - 20.193 - 5)
    const head = drawn(base).volume - Math.PI * a ** 2 * (32.69 - 20.193)
    expect(o.volume).toBeCloseTo(frustum + shank + head, 6)
    expect(o.bearingLength).toBeCloseTo(32.69 - 20.193 - 5, 9)
  })

  it('boat tail from length and angle, and from diameter and angle', () => {
    const byAngle = drawn({ ...base, base: { type: 'boat-tail', length: 5, angle: 7 } })
    expect(defined(byAngle.points[1])[0]).toBeCloseTo(a - 5 * Math.tan(7 * deg), 9)
    expect(byAngle.tags[1]).toBe('derived')
    const byDiameter = drawn({ ...base, base: { type: 'boat-tail', diameter: 6.5, angle: 7 } })
    expect(defined(byDiameter.points[2])[1]).toBeCloseTo((a - 3.25) / Math.tan(7 * deg), 9)
    expect(byDiameter.tags[2]).toBe('derived')
  })

  it('assumes the angle from the length alone and flags the base', () => {
    const o = drawn({ ...base, base: { type: 'boat-tail', length: 5 } })
    expect(defined(o.points[1])[0]).toBeCloseTo(a - 5 * Math.tan(assumedBoatTailAngle * deg), 9)
    expect(o.tags[1]).toBe('approximate')
    expect(defined(o.segments[0]).approximate).toBe(true)
    expect(o.approximate[0]).toEqual([0, 5])
  })

  it('refuses a length, diameter and angle that disagree', () => {
    expect(
      reason({ ...base, base: { type: 'boat-tail', length: 5, diameter: 6.5, angle: 3 } }),
    ).toMatch(/disagree/)
    const implied = Math.atan((a - 3.25) / 5) / deg
    expect(
      reason({
        ...base,
        base: { type: 'boat-tail', length: 5, diameter: 6.5, angle: implied + 0.4 },
      }),
    ).toBeUndefined()
  })

  it('rebated boat tail: steps out at the end of the cone by an assumed depth', () => {
    const o = drawn({ ...base, base: { type: 'rebated-boat-tail', length: 5, diameter: 6.5 } })
    expect(o.points[2]).toEqual([a - 0.015 * d, 5])
    expect(o.points[3]).toEqual([a, 5])
    expect(o.tags[2]).toBe('approximate')
    expect(o.notes.join(' ')).toMatch(/rebate depth is assumed/)
  })
})

describe('hollow base', () => {
  const body: BulletDimensions = {
    diameter: 8,
    length: 30,
    noseLength: 12,
    meplatDiameter: 0,
    ogive: { radiusRatio: 0 },
  }
  const hollow = (type: 'conical-hollow-base' | 'rounded-hollow-base', cavityDiameter = 5) => ({
    ...body,
    base: { type, cavityDiameter },
  })
  const solid = drawn({ ...body, base: { type: 'flat' } })

  it('conical cavity: the cone as deep as it is wide at the opening comes off the volume', () => {
    const o = drawn(hollow('conical-hollow-base'), 'entered')
    expect(o.cavity).toEqual({ radius: 2.5, depth: 2.5 })
    expect(o.points.slice(0, o.baseEdge + 1)).toEqual([
      [0, 2.5],
      [2.5, 0],
      [4, 0],
    ])
    expect(o.volume).toBeCloseTo(solid.volume - (Math.PI * 2.5 ** 2 * 2.5) / 3, 9)
    // the full section loses the triangle of base 2 rc and height rc
    expect(o.area).toBeCloseTo(solid.area - 2.5 ** 2, 9)
    expect(profileCrossesItself(o.points)).toBe(false)
  })

  it('rounded cavity: a hemisphere of the opening radius, within the sampling error of its volume', () => {
    const o = drawn(hollow('rounded-hollow-base'), 'entered')
    expect(o.cavity).toEqual({ radius: 2.5, depth: 2.5 })
    for (const [r, z] of o.points.slice(0, o.baseEdge - 1))
      expect(Math.hypot(r, z)).toBeCloseTo(2.5, 12)
    const hemisphere = (2 / 3) * Math.PI * 2.5 ** 3
    const cut = solid.volume - o.volume
    expect(cut).toBeLessThan(hemisphere)
    expect(cut).toBeGreaterThan(hemisphere * 0.997)
  })

  it('draws the cavity as an assumed shape and the base face as given', () => {
    const o = drawn(hollow('conical-hollow-base'), 'entered')
    expect(o.tags.slice(0, 3)).toEqual(['approximate', 'entered', 'entered'])
    expect(o.segments[0]).toEqual({
      points: [
        [0, 2.5],
        [2.5, 0],
      ],
      approximate: true,
    })
    expect(defined(o.segments[1]).approximate).toBe(false)
    expect(o.notes.join(' ')).toMatch(/cavity depth is assumed/)
  })

  it('takes the boat-tail dimensions of a hollow base that gives them', () => {
    const o = drawn(
      {
        ...hollow('conical-hollow-base'),
        base: { type: 'conical-hollow-base', length: 3, diameter: 6.5, cavityDiameter: 4 },
      },
      'entered',
    )
    expect(o.points[o.baseEdge]).toEqual([3.25, 0])
    expect(o.points[o.baseEdge + 1]).toEqual([4, 3])
    expect(o.cavity?.radius).toBe(2)
  })

  it('without a cavity diameter the base is flat and the notes say so', () => {
    const o = drawn({ ...body, base: { type: 'rounded-hollow-base' } })
    const flat = drawn({ ...body, base: { type: 'flat' } })
    expect(o.points).toEqual(flat.points)
    expect(o.volume).toBe(flat.volume)
    expect(o.cavity).toBeUndefined()
    expect(o.baseEdge).toBe(1)
    expect(o.notes.join(' ')).toMatch(/no cavity diameter/)
  })

  it('refuses a cavity as wide as the base face or as deep as the bullet is long', () => {
    expect(reason(hollow('conical-hollow-base', 8))).toMatch(/cavity diameter/)
    expect(
      reason({
        ...hollow('conical-hollow-base', 5),
        base: { type: 'conical-hollow-base', length: 3, diameter: 5, cavityDiameter: 5 },
      }),
    ).toMatch(/cavity diameter/)
    expect(
      reason({ ...hollow('rounded-hollow-base', 5), length: 2.5, noseLength: 1 }),
    ).toBeDefined()
  })
})

describe('lengths, tips and cannelure', () => {
  it('derives the nose length from tail, bearing and length', () => {
    const o = drawn({
      diameter: d,
      length: 32.69,
      bearingLength: 6.833,
      base: { type: 'boat-tail', length: 5.664, diameter: 6.4 },
    })
    expect(o.noseLength).toBeCloseTo(20.193, 9)
    expect(o.noseAssumed).toBe(false)
  })

  it('refuses tail, bearing and nose that do not add up to the length', () => {
    expect(
      reason({
        ...base,
        bearingLength: 9,
        base: { type: 'boat-tail', length: 5.664, diameter: 6.4 },
      }),
    ).toMatch(/do not add up/)
  })

  it('assumes a nose of min(2 d, 0.6 length) without a nose length', () => {
    const o = drawn({ diameter: d, length: 30 })
    expect(o.noseAssumed).toBe(true)
    expect(o.noseLength).toBeCloseTo(2 * d, 9)
    expect(o.tags.at(-2)).toBe('approximate')
  })

  it('polymer tip: a point on the nose curve at length less tip length', () => {
    const o = drawn({ ...base, tip: { type: 'polymer-tip', length: 4 } })
    expect(o.tipStart).toBeCloseTo(28.69, 9)
    expect(o.points.some(([, z]) => Math.abs(z - 28.69) < 1e-12)).toBe(true)
    const assumed = drawn({ ...base, tip: { type: 'polymer-tip' } })
    expect(assumed.tipStart).toBeCloseTo(32.69 - 0.2 * 20.193, 9)
    expect(assumed.notes.join(' ')).toMatch(/polymer tip length is assumed/)
  })

  it('hollow point: the mouth is a point on the meplat line; the meplat defaults to 0.15 d', () => {
    const o = drawn({ ...base, tip: { type: 'hollow-point', mouthDiameter: 0.8 } })
    expect(o.points.slice(-3)).toEqual([
      [0.075 * d, 32.69],
      [0.4, 32.69],
      [0, 32.69],
    ])
    expect(o.tags.at(-3)).toBe('approximate')
    expect(o.tags.at(-2)).toBe('sourced')
  })

  it('cannelure: a groove on the shank takes out an annulus', () => {
    const groove = { start: 8, width: 1, depth: 0.2 }
    const o = drawn({ ...base, cannelure: groove }, 'entered')
    expect(o.points.slice(2, 6)).toEqual([
      [a, 8],
      [a - 0.2, 8],
      [a - 0.2, 9],
      [a, 9],
    ])
    expect(drawn(base).volume - o.volume).toBeCloseTo(Math.PI * (a ** 2 - (a - 0.2) ** 2), 9)
    expect(reason({ ...base, cannelure: { start: 12, width: 1 } })).toMatch(/cannelure/)
  })
})

describe('refused input', () => {
  it.each<[string, BulletDimensions, RegExp]>([
    ['nose longer than the bullet', { ...base, noseLength: 40 }, /nose length/],
    ['meplat as wide as the diameter', { ...base, meplatDiameter: d }, /meplat/],
    [
      'base diameter as wide as the diameter',
      { ...base, base: { type: 'boat-tail', length: 5, diameter: d } },
      /base diameter/,
    ],
    [
      'tangent form with Rt/R 0.5',
      { ...base, ogive: { form: 'tangent', radiusRatio: 0.5 } },
      /tangent ogive/,
    ],
    [
      'radius below the tangent radius',
      { ...base, ogive: { form: 'secant', radius: 10 } },
      /below the tangent radius/,
    ],
    [
      'nose shorter than its drop',
      { ...base, noseLength: 2, ogive: { form: 'tangent' } },
      /radial drop/,
    ],
    ['unknown form', { ...base, ogive: { form: 'spire' } }, /Unknown nose form/],
    [
      'polymer tip as long as the nose',
      { ...base, tip: { type: 'polymer-tip', length: 20.193 } },
      /polymer tip/,
    ],
    [
      'mouth wider than the meplat',
      { ...base, meplatDiameter: 1, tip: { type: 'hollow-point', mouthDiameter: 2 } },
      /mouth/,
    ],
    ['zero diameter', { ...base, diameter: 0 }, /positive/],
    ['cannelure at the base', { ...base, cannelure: { start: 0, width: 1 } }, /cannelure/],
    [
      'cannelure at the end of a rebated tail',
      {
        ...base,
        base: { type: 'rebated-boat-tail', length: 5, diameter: 6.5 },
        cannelure: { start: 5, width: 1 },
      },
      /cannelure/,
    ],
  ])('%s', (_, b, want) => {
    expect(reason(b)).toMatch(want)
    // the refusal names at least one field, each a path of the input
    const o = bulletOutline(b)
    const fields = 'fields' in o ? o.fields : []
    expect(fields.length).toBeGreaterThan(0)
    for (const f of fields) expect(paths).toContain(f)
  })

  it('names the nose, the length and the boat tail for a nose above the length less the tail', () => {
    expect(
      bulletOutline({ ...base, noseLength: 30, base: { type: 'boat-tail', length: 5 } }),
    ).toEqual({
      reason: expect.stringContaining('less the boat tail'),
      fields: ['noseLength', 'length', 'base.length'],
    })
  })
})

/** Record paths of every `BulletDimensions` field. */
const paths = [
  'diameter',
  'length',
  'noseLength',
  'baseToOgive',
  'bearingLength',
  'meplatDiameter',
  'base.type',
  'base.length',
  'base.diameter',
  'base.angle',
  'ogive.form',
  'ogive.radius',
  'ogive.radiusRatio',
  'tip.type',
  'tip.length',
  'tip.mouthDiameter',
  'cannelure.start',
  'cannelure.width',
  'cannelure.depth',
]

/** Bullet record JSON to the outline input, as the seating preview maps it. */
type Stored = { value: number }
interface BulletJson {
  diameter: Stored
  length?: Stored
  noseLength?: Stored
  baseToOgive?: Stored
  bearingLength?: Stored
  meplatDiameter?: Stored
  base?: {
    type?: 'flat' | 'boat-tail' | 'rebated-boat-tail'
    length?: Stored
    diameter?: Stored
    angle?: Stored
  }
  ogive?: { form?: string; radius?: Stored; radiusRatio?: Stored }
  tip?: { type: string; length?: Stored; mouthDiameter?: Stored }
}

function shapeOf(r: BulletJson): BulletDimensions | undefined {
  if (!r.length) return
  const v = (q?: { value: number }) => q?.value
  const pick = <T extends object>(o: T) =>
    Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined)) as T
  return pick({
    diameter: r.diameter.value,
    length: r.length.value,
    noseLength: v(r.noseLength),
    baseToOgive: v(r.baseToOgive),
    bearingLength: v(r.bearingLength),
    meplatDiameter: v(r.meplatDiameter),
    base:
      r.base &&
      pick({
        type: r.base.type,
        length: v(r.base.length),
        diameter: v(r.base.diameter),
        angle: v(r.base.angle),
      }),
    ogive:
      r.ogive &&
      pick({ form: r.ogive.form, radius: v(r.ogive.radius), radiusRatio: v(r.ogive.radiusRatio) }),
    tip:
      r.tip &&
      pick({ type: r.tip.type, length: v(r.tip.length), mouthDiameter: v(r.tip.mouthDiameter) }),
  })
}

const bulletDir = new URL('../../data/records/bullets/', import.meta.url)

describe('records', () => {
  it('every committed bullet record with a length gives a valid outline', () => {
    const dir = bulletDir
    let count = 0
    for (const f of readdirSync(dir)) {
      const shape = shapeOf(JSON.parse(readFileSync(new URL(f, dir), 'utf8')))
      if (!shape) continue
      const o = bulletOutline(shape)
      expect('reason' in o ? `${f}: ${o.reason}` : '').toBe('')
      if (!('reason' in o)) expectValid(o, shape)
      count++
    }
    expect(count).toBeGreaterThan(0)
  })
})

/** Seeded pseudo random numbers in [0, 1) (mulberry32). */
function random(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('crossing check', () => {
  it('finds a crossing and passes a plain profile', () => {
    expect(
      profileCrossesItself([
        [0, 0],
        [2, 0],
        [0, 2],
        [2, 2],
        [0, 3],
      ]),
    ).toBe(true)
    expect(
      profileCrossesItself([
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 3],
      ]),
    ).toBe(false)
  })
})

describe('random input', () => {
  const rnd = random(115)
  // the index is below the length, and a list may hold undefined
  const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)] as T
  const maybe = <T>(x: T) => (rnd() < 0.5 ? x : undefined)

  const meplatShare = (form: string | undefined, tipType: string | undefined) => {
    if (form === 'flat-nose') return 0.6
    return tipType === 'hollow-point' || tipType === 'soft-point' ? 0.15 : 0
  }
  const validBase = (
    type: NonNullable<BulletDimensions['base']>['type'],
    tail: number,
    dia: number,
  ) => ({
    type,
    ...(tail > 0 && { length: tail }),
    ...(tail > 0 && rnd() < 0.5 && { diameter: dia * (0.75 + 0.2 * rnd()) }),
  })
  const validOgive = (form: string) => ({
    form,
    ...((form === 'secant' || form === 'hybrid') &&
      rnd() < 0.7 && { radiusRatio: form === 'hybrid' ? 0.3 + 0.6 * rnd() : rnd() }),
  })
  const arbitraryBase = () => ({
    type: pick(['flat', 'boat-tail', 'rebated-boat-tail'] as const),
    ...(rnd() < 0.6 && { length: 8 * rnd() }),
    ...(rnd() < 0.4 && { diameter: 10 * rnd() }),
    ...(rnd() < 0.4 && { angle: 20 * rnd() }),
  })
  const arbitraryOgive = () => ({
    form: pick(['tangent', 'secant', 'hybrid', 'round-nose', 'flat-nose']),
    ...(rnd() < 0.5 && { radiusRatio: rnd() }),
    ...(rnd() < 0.3 && { radius: 60 * rnd() }),
  })
  const arbitraryTip = () => ({
    type: pick(['hollow-point', 'polymer-tip', 'soft-point']),
    ...(rnd() < 0.5 && { length: 10 * rnd(), mouthDiameter: 3 * rnd() }),
  })

  /** A consistent input: every part fits the length and every radius is below the bullet radius. */
  function valid(): BulletDimensions {
    const dia = 4 + 10 * rnd()
    const len = dia * (1.5 + 4 * rnd())
    const r = dia / 2
    const type = pick(['flat', 'boat-tail', 'rebated-boat-tail', undefined] as const)
    const tail = type && type !== 'flat' ? len * 0.2 * rnd() : 0
    const form = pick(['tangent', 'secant', 'hybrid', 'round-nose', 'flat-nose', undefined])
    const tipType = pick([
      'hollow-point',
      'polymer-tip',
      'soft-point',
      'full-metal-jacket',
      undefined,
    ])
    const meplat = maybe(dia * 0.4 * rnd())
    const share = meplatShare(form, tipType)
    const drop = r - (meplat ?? share * dia) / 2
    const room = len - tail
    // ogive forms need a nose at least as long as the radial drop
    const n = Math.min(room, Math.max(drop * 1.01, room * (0.2 + 0.8 * rnd())))
    if (n < drop * 1.01 && form !== 'round-nose' && form !== 'flat-nose') return valid()
    const groove =
      rnd() < 0.3 && room - n > 1
        ? { start: tail + 0.2 * (room - n), width: 0.3 * (room - n) }
        : undefined
    return {
      diameter: dia,
      length: len,
      noseLength: n,
      ...(meplat !== undefined && { meplatDiameter: meplat }),
      ...(type && { base: validBase(type, tail, dia) }),
      ...(form && { ogive: validOgive(form) }),
      ...(tipType && { tip: { type: tipType } }),
      ...(groove && { cannelure: groove }),
    }
  }

  it('consistent input always gives a closed outline that rises in z and does not cross itself', () => {
    for (let j = 0; j < 400; j++) {
      const b = valid()
      const o = bulletOutline(b)
      expect('reason' in o ? `${JSON.stringify(b)}: ${o.reason}` : '').toBe('')
      if (!('reason' in o)) expectValid(o, b)
    }
  })

  it('arbitrary input gives a reason or a valid outline, never a broken one', () => {
    for (let j = 0; j < 400; j++) {
      const len = 40 * rnd()
      const b: BulletDimensions = {
        diameter: 12 * rnd() - 1,
        length: len,
        ...(rnd() < 0.7 && { noseLength: 1.2 * len * rnd() }),
        ...(rnd() < 0.3 && { bearingLength: len * rnd() }),
        ...(rnd() < 0.4 && { meplatDiameter: 8 * rnd() }),
        ...(rnd() < 0.6 && { base: arbitraryBase() }),
        ...(rnd() < 0.6 && { ogive: arbitraryOgive() }),
        ...(rnd() < 0.5 && { tip: arbitraryTip() }),
        ...(rnd() < 0.3 && { cannelure: { start: len * rnd(), width: 2 * rnd() } }),
      }
      const o = bulletOutline(b)
      if (!('reason' in o)) expectValid(o, b)
    }
  })
})
