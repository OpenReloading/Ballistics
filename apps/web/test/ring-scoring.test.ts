import { readRecords } from '@open-reloading/data'
import type { TargetFace } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { english } from '../src/i18n/translate.ts'
import {
  faceAlignment,
  fitRings,
  onFace,
  onSheet,
  ringPath,
  scoredHoleDiameter,
  scoreGroup,
  scoreGroupOnFace,
  scoreShot,
  usesOwnTenthRule,
} from '../src/lib/ring-scoring.ts'
import { defined } from './defined.ts'

const faces = readRecords().bundle.targetFaces
const face = (id: string) => faces.find((f) => f.id === id) as TargetFace

const airRifle = face('issf-10m-air-rifle')
const airPistol = face('issf-10m-air-pistol')
const rifle50 = face('issf-50m-rifle')
const rifle300 = face('issf-300m-rifle')
const rapidFire = face('issf-25m-rapid-fire-pistol')
const precision25 = face('issf-25m-precision-50m-pistol')

/** A shot `d` mm from the centre at `deg` degrees, in target m. */
const at = (d: number, deg = 0) => ({
  x: d * 1e-3 * Math.cos((deg * Math.PI) / 180),
  y: d * 1e-3 * Math.sin((deg * Math.PI) / 180),
})
const mm = 1e-3
/** Well above the scoring tolerance of 1e-9 mm. */
const off = 1e-6

describe('scoreShot', () => {
  it('scores the 10 m air rifle 10 ring by the 4.5 mm hole touching the 0.5 mm dot', () => {
    // 0.25 mm dot radius + 2.25 mm hole radius
    expect(scoreShot(airRifle, at(2.5), 4.5 * mm).value).toBe(10)
    expect(scoreShot(airRifle, at(2.5 - off, 135), 4.5 * mm).value).toBe(10)
    expect(scoreShot(airRifle, at(2.5 + off, 135), 4.5 * mm).value).toBe(9)
  })

  it('counts an air rifle inner ten only when the hole covers the dot', () => {
    expect(scoreShot(airRifle, at(0), 4.5 * mm)).toEqual({
      value: 10,
      decimal: 10.9,
      innerTen: true,
    })
    expect(scoreShot(airRifle, at(2.0, 60), 4.5 * mm).innerTen).toBe(true)
    const beyond = scoreShot(airRifle, at(2.0 + off, 60), 4.5 * mm)
    expect(beyond).toMatchObject({ value: 10, innerTen: false })
  })

  it('counts an air pistol inner ten when the hole touches the 5 mm ring', () => {
    expect(scoreShot(airPistol, at(4.75, 200), 4.5 * mm).innerTen).toBe(true)
    expect(scoreShot(airPistol, at(4.75 + off, 200), 4.5 * mm)).toMatchObject({
      value: 10,
      innerTen: false,
    })
    expect(scoreShot(airPistol, at(8.0), 4.5 * mm).value).toBe(10)
    expect(scoreShot(airPistol, at(8.0 + off), 4.5 * mm).value).toBe(9)
  })

  it('scores the outermost ring on touch and 0 outside it', () => {
    expect(scoreShot(airRifle, at(25), 4.5 * mm)).toEqual({ value: 1, decimal: 1, innerTen: false })
    expect(scoreShot(airRifle, at(25 + off), 4.5 * mm)).toEqual({
      value: 0,
      decimal: 0,
      innerTen: false,
    })
    // rapid-fire: rings 5 to 10 only, 5 ring 500 mm, 5.6 mm gauge
    expect(scoreShot(rapidFire, at(252.8), 5.6 * mm).value).toBe(5)
    expect(scoreShot(rapidFire, at(252.8 + off), 5.6 * mm).value).toBe(0)
  })

  it('uses the gauge diameter, not the bullet, where the event fixes one', () => {
    const gauge = scoredHoleDiameter(rifle300.events[0], 6.7 * mm)
    expect(gauge).toBeCloseTo(8 * mm, 12)
    expect(
      scoredHoleDiameter({ id: 'no-gauge', name: 'No gauge', distance: { value: 1 } }, 6.7 * mm),
    ).toBe(6.7 * mm)
    // the gauge of the discipline's mapping where the event has none; the event's gauge first
    expect(
      scoredHoleDiameter(
        { id: 'no-gauge', name: 'No gauge', distance: { value: 1 } },
        6.7 * mm,
        9.65,
      ),
    ).toBe(9.65 * mm)
    expect(scoredHoleDiameter(rifle300.events[0], 6.7 * mm, 9.65)).toBeCloseTo(8 * mm, 12)
    // 50 mm 10 ring radius + 4 mm gauge radius; inner ten 25 + 4
    expect(scoreShot(rifle300, at(54), gauge).value).toBe(10)
    expect(scoreShot(rifle300, at(54 + off), gauge).value).toBe(9)
    expect(scoreShot(rifle300, at(29), gauge).innerTen).toBe(true)
    expect(scoreShot(rifle300, at(29 + off), gauge).innerTen).toBe(false)
  })

  it('gives tenths of the ring width inward from the touching edge', () => {
    // air rifle: tenths of 0.25 mm, 10.9 within 0.25 mm
    expect(scoreShot(airRifle, at(0.25), 4.5 * mm).decimal).toBe(10.9)
    expect(scoreShot(airRifle, at(0.25 + off), 4.5 * mm).decimal).toBe(10.8)
    expect(scoreShot(airRifle, at(2.5 - off), 4.5 * mm).decimal).toBe(10)
    expect(scoreShot(airRifle, at(2.5 + off), 4.5 * mm).decimal).toBe(9.9)
    expect(scoreShot(airRifle, at(5.0), 4.5 * mm).decimal).toBe(9)
    // 50 m rifle: tenths of 0.8 mm, 10.9 within 0.8 mm
    expect(scoreShot(rifle50, at(0.8), 5.6 * mm).decimal).toBe(10.9)
    expect(scoreShot(rifle50, at(0.8 + off), 5.6 * mm).decimal).toBe(10.8)
    expect(scoreShot(rifle50, at(8.0), 5.6 * mm).decimal).toBe(10)
    expect(scoreShot(rifle50, at(12.0), 5.6 * mm).decimal).toBe(9.5)
  })
})

describe('scoreGroup', () => {
  it('totals values, decimals and inner tens, and follows a moved shot', () => {
    const shots = [at(0), at(3.0, 90), at(24, 180)]
    const before = scoreGroup(airRifle, shots, 4.5 * mm)
    expect(before.shots.map((s) => s.value)).toEqual([10, 9, 1])
    expect(before).toMatchObject({ total: 20, decimalTotal: 22.1, innerTenCount: 1 })
    const moved = scoreGroup(
      airRifle,
      [defined(shots[0]), at(1.0, 90), defined(shots[2])],
      4.5 * mm,
    )
    expect(moved.shots.map((s) => s.value)).toEqual([10, 10, 1])
    expect(moved).toMatchObject({ total: 21, decimalTotal: 22.9, innerTenCount: 2 })
  })

  it('leaves out decimals on a face without them or where the rule book does not state them', () => {
    for (const plain of [
      { ...airRifle, decimal: false },
      { ...airRifle, decimal: undefined },
    ]) {
      expect(scoreShot(plain, at(0), 4.5 * mm)).toEqual({ value: 10, innerTen: true })
      expect(scoreGroup(plain, [at(0)], 4.5 * mm).decimalTotal).toBeUndefined()
    }
  })
})

describe('fitRings', () => {
  const centre = { x: 0.012, y: -0.004 }
  /** 2 % calibration error: sheet m per face mm. */
  const scale = 1.02e-3
  const marks = (diameter: number, degrees: number[], noise = 0) => ({
    diameter,
    points: degrees.map((deg, i) => {
      const r = (diameter / 2) * scale + (i % 2 ? noise : -noise)
      const a = (deg * Math.PI) / 180
      return { x: centre.x + r * Math.cos(a), y: centre.y + r * Math.sin(a) }
    }),
  })

  it('stays within the mark noise', () => {
    const noise = 0.05e-3
    const fit = fitRings(
      [marks(15.5, [0, 72, 144, 216, 288], noise), marks(35.5, [36, 108, 180, 252, 324], noise)],
      english.t,
    )
    expect(Math.hypot(fit.centre.x - centre.x, fit.centre.y - centre.y)).toBeLessThan(noise)
    expect(Math.abs(fit.scale / scale - 1)).toBeLessThan(0.01)
    expect(fit.rmsMisfit).toBeLessThan(2 * noise)
  })

  it('refuses marks on one ring or fewer than four points', () => {
    expect(() => fitRings([marks(5.5, [0, 90, 180, 270])], english.t)).toThrow(/two rings/)
    expect(() => fitRings([marks(5.5, [0, 90]), marks(25.5, [45])], english.t)).toThrow(
      /four points/,
    )
    expect(() =>
      fitRings([marks(5.5, [0, 90, 180, 270]), { diameter: 25.5, points: [] }], english.t),
    ).toThrow(/two rings/)
  })

  it('fits four points on two rings', () => {
    const fit = fitRings([marks(15.5, [0, 120]), marks(35.5, [60, 240])], english.t)
    expect(fit.centre.x).toBeCloseTo(centre.x, 12)
    expect(fit.centre.y).toBeCloseTo(centre.y, 12)
    expect(fit.scale).toBeCloseTo(scale, 12)
  })

  it('refuses points on one spot and an inner ring marked outside an outer one', () => {
    const spot = { x: 0.01, y: 0.01 }
    expect(() =>
      fitRings(
        [
          { diameter: 10, points: [spot, spot] },
          { diameter: 20, points: [spot, spot] },
        ],
        english.t,
      ),
    ).toThrow('Points are degenerate')
    // the 15.5 mm ring marked where the 35.5 mm ring is, and the other way round
    const swapped = [
      { diameter: 35.5, points: marks(15.5, [0, 90, 180, 270]).points },
      { diameter: 15.5, points: marks(35.5, [45, 135, 225, 315]).points },
    ]
    expect(() => fitRings(swapped, english.t)).toThrow('Points are degenerate')
  })
})

describe('face on the sheet (target m) and face m', () => {
  it('maps a sheet point to the face and back, at the calibrated scale and at another', () => {
    for (const a of [
      { centre: { x: 0.01, y: -0.02 }, scale: 1 },
      { centre: { x: -0.003, y: 0.004 }, scale: 1.02 },
    ]) {
      const p = { x: 0.025, y: 0.011 }
      const q = onFace(a, p)
      expect(q.x).toBeCloseTo((p.x - a.centre.x) / a.scale, 15)
      expect(q.y).toBeCloseTo((p.y - a.centre.y) / a.scale, 15)
      const back = onSheet(a, q)
      expect(back.x).toBeCloseTo(p.x, 15)
      expect(back.y).toBeCloseTo(p.y, 15)
    }
  })

  it('centres the face on the point of aim at the calibrated scale without marks', () => {
    expect(faceAlignment(rifle50, undefined, { x: 0.002, y: 0.003 }, english.t)).toEqual({
      centre: { x: 0.002, y: 0.003 },
      scale: 1,
    })
    expect(faceAlignment(rifle50, undefined, undefined, english.t)).toEqual({
      centre: { x: 0, y: 0 },
      scale: 1,
    })
  })

  it('fits the face to marks on its rings: sheet m per face m, about 1 on a true calibration', () => {
    const centre = { x: 0.012, y: -0.004 }
    const scale = 1.02
    // the 8 ring (42.4 mm) and the 6 ring (74.4 mm) of the 50 m rifle face
    const marks = (
      [
        [8, 0],
        [8, 120],
        [8, 240],
        [6, 60],
        [6, 200],
      ] satisfies [number, number][]
    ).map(([ring, deg]) => {
      const d = ring === 8 ? 42.4 : 74.4
      const a = (deg * Math.PI) / 180
      const r = (d / 2) * 1e-3 * scale
      return { ring, x: centre.x + r * Math.cos(a), y: centre.y + r * Math.sin(a) }
    })
    const a = faceAlignment(rifle50, marks, { x: 1, y: 1 }, english.t)
    expect(a.centre.x).toBeCloseTo(centre.x, 12)
    expect(a.centre.y).toBeCloseTo(centre.y, 12)
    expect(a.scale).toBeCloseTo(scale, 10)
    expect(a.rms).toBeLessThan(1e-12)
    expect(() =>
      faceAlignment(rifle50, [{ ring: 11, x: 0, y: 0 }, ...marks], undefined, english.t),
    ).toThrow(/ring 11/)
  })

  it('draws a ring as a closed polyline on the sheet', () => {
    const path = ringPath({ centre: { x: 0.01, y: 0 }, scale: 1.02 }, 42.4)
    expect(path.length).toBeGreaterThanOrEqual(64)
    for (const p of path) expect(Math.hypot(p.x - 0.01, p.y)).toBeCloseTo(0.0212 * 1.02, 12)
    // counter-clockwise from the right, 5 degrees apart
    const r = 0.0212 * 1.02
    for (const [i, x, y] of [
      [0, 0.01 + r, 0],
      [18, 0.01, r],
      [36, 0.01 - r, 0],
      [54, 0.01, -r],
    ] satisfies [number, number, number][]) {
      expect(defined(path[i]).x).toBeCloseTo(x, 12)
      expect(defined(path[i]).y).toBeCloseTo(y, 12)
    }
  })
})

describe('usesOwnTenthRule', () => {
  it('holds where the 10 zone is wider than a ring: 300 m and both 25 m faces', () => {
    expect(usesOwnTenthRule(rifle300, 8 * mm)).toBe(true)
    expect(usesOwnTenthRule(rapidFire, 5.6 * mm)).toBe(true)
    expect(usesOwnTenthRule(precision25, 9.65 * mm)).toBe(true)
    expect(usesOwnTenthRule(airRifle, 4.5 * mm)).toBe(false)
    expect(usesOwnTenthRule(rifle50, 5.6 * mm)).toBe(false)
    expect(usesOwnTenthRule(airPistol, 4.5 * mm)).toBe(false)
  })
})

describe('scoreGroupOnFace', () => {
  const group = {
    shots: [
      { ...at(0), placement: 'placed' as const },
      { ...at(9, 90), placement: 'placed' as const },
      { ...at(1, 45), placement: 'placed' as const, excluded: true },
    ],
  }

  it('scores every shot with the event gauge; the totals leave excluded shots out', () => {
    const s = scoreGroupOnFace(
      rifle50,
      { id: rifle50.id, event: '50m-rifle-prone' },
      group,
      undefined,
      english.t,
    )
    if ('error' in s) throw new Error(s.error)
    expect(s.hole).toBeCloseTo(5.6e-3, 15)
    expect(s.score.shots.map((x) => x.value)).toEqual([10, 9, 10])
    expect(s.score).toMatchObject({ total: 19, innerTenCount: 1 })
    // 9 mm out: 13.2 + 2.8 - 9 = 7 mm into the 8 mm wide 9 ring, 9.8
    expect(s.score.decimalTotal).toBeCloseTo(10.9 + 9.8, 10)
    expect(s.usesOwnTenthRule).toBe(false)
  })

  it('takes the bullet diameter without an event and follows a moved shot', () => {
    const f = { id: rifle50.id }
    expect(scoreGroupOnFace(rifle50, f, group, undefined, english.t)).toEqual({
      error: 'No hole size: set Marker, or choose a discipline or event with a gauge.',
    })
    const s = scoreGroupOnFace(rifle50, f, group, 7.82e-3, english.t)
    if ('error' in s) throw new Error(s.error)
    expect(s.hole).toBe(7.82e-3)
    expect(scoreGroupOnFace(rifle50, f, group, 0, english.t)).toEqual({
      error: 'No hole size: set Marker, or choose a discipline or event with a gauge.',
    })
    const moved = scoreGroupOnFace(
      rifle50,
      f,
      { shots: [defined(group.shots[0]), { ...at(30, 90), placement: 'placed' as const }] },
      7.82e-3,
      english.t,
    )
    if ('error' in moved) throw new Error(moved.error)
    expect(moved.score.total).toBeLessThan(s.score.total)
  })

  it('says so when the marks do not fit', () => {
    const marks = [0, 1, 2, 3].map((i) => ({ ring: 8 + (i % 2), x: 0, y: 0 }))
    expect(scoreGroupOnFace(rifle50, { id: rifle50.id, marks }, group, 5e-3, english.t)).toEqual({
      error: 'The ring marks do not fit: Points are degenerate. Mark them again.',
    })
  })
})
