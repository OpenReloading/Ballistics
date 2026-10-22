import { describe, expect, it } from 'vitest'
import {
  assumedBoatTailAngle,
  type BulletDimensions,
  bulletLengthTolerance,
  bulletOutline,
  chamberOf,
  coalRange,
  intrusion,
  jumpNote,
  leadeContact,
  previewDrawn,
  revolutionVolume,
  type SeatingValues,
  seat,
} from '../src/seating/index.ts'

import { sheet } from './sheets.ts'

const deg = Math.PI / 180
/** Water density, g/cm³: the web app passes core's value; `seat` only divides by it. */
const waterDensity = 0.9982

const spec = sheet('cip-308-win-2008-09-23')

const chamber = chamberOf(spec.values) as SeatingValues

/** Fixture bullets, not records: a .308 boat tail with a nose length, a flat base, one with a base-to-ogive. */
const boatTail: BulletDimensions = {
  diameter: 7.823,
  length: 32.69,
  noseLength: 20.193,
  base: { type: 'boat-tail', length: 5.664 },
}
const flat: BulletDimensions = {
  diameter: 7.823,
  length: 30,
  noseLength: 18,
  base: { type: 'flat' },
}
const withOgive: BulletDimensions = { ...boatTail, baseToOgive: 14.3 }

/** The outline of a consistent fixture. */
const drawn = (b: BulletDimensions) => {
  const o = bulletOutline(b)
  if ('reason' in o) throw new Error(o.reason)
  return o
}

const cylinder = (d: number, h: number) => (Math.PI / 4) * d ** 2 * h

describe('chamberOf', () => {
  it('reads the 308 Win. chamber values from the sheet', () => {
    expect(chamber).toMatchObject({
      caseLength: 51.18,
      cartridgeL6: 71.12,
      chamberL3: 51.44,
      G1: 7.87,
      F: 7.62,
      leadeEnd: 6.98,
      leadeStart: 2.89,
      leadeAngle: 1.75,
    })
  })
})

describe('bulletOutline', () => {
  it('draws the boat tail from the assumed angle and flags it, the shank not', () => {
    const o = drawn(boatTail)
    const base = o.points[1]
    expect(base[1]).toBe(0)
    expect(base[0]).toBeCloseTo(7.823 / 2 - 5.664 * Math.tan(assumedBoatTailAngle * deg), 9)
    const shank = o.segments.find((s) => !s.approximate)
    expect(shank?.points).toEqual([
      [7.823 / 2, 5.664],
      [7.823 / 2, 32.69 - 20.193],
    ])
  })

  it('draws a base flat when the record has no boat tail length and says so', () => {
    const o = drawn({ ...boatTail, base: { type: 'boat-tail' } })
    expect(o.points[1]).toEqual([7.823 / 2, 0])
    expect(o.notes.join(' ')).toMatch(/boat tail length/)
  })

  it('assumes a nose without noseLength and flags the whole outline beyond the shank', () => {
    const o = drawn({ diameter: 7.823, length: 30 })
    expect(o.noseAssumed).toBe(true)
    expect(o.notes.join(' ')).toMatch(/nose length/)
  })
})

describe('seatedVolume', () => {
  it('is a cylinder for a flat base seated within the shank', () => {
    const o = drawn(flat)
    expect(revolutionVolume(o.points, 10)).toBeCloseTo(cylinder(7.823, 10), 9)
    expect(revolutionVolume(o.points, 0)).toBe(0)
    expect(revolutionVolume(o.points, -1)).toBe(0)
  })

  it('takes the part of the ogive below the mouth, less than a cylinder', () => {
    const o = drawn(flat)
    const v = revolutionVolume(o.points, 14)
    expect(v).toBeLessThan(cylinder(7.823, 14))
    expect(v).toBeGreaterThan(cylinder(7.823, 12))
  })
})

describe('intrusion', () => {
  /** A flat base with a sharp conical nose (Rt/R 0): every outline point is given. */
  const cone: BulletDimensions = {
    diameter: 8,
    length: 30,
    noseLength: 12,
    meplatDiameter: 0,
    ogive: { radiusRatio: 0 },
    base: { type: 'flat' },
  }
  const tail: BulletDimensions = {
    diameter: 8,
    length: 30,
    noseLength: 12,
    base: { type: 'boat-tail', length: 4, diameter: 6.6 },
  }
  const at = (bullet: BulletDimensions, depth: number, lengthSource: 'measured' | 'estimated') =>
    intrusion({ bullet, caseLength: 50, coal: 50 - depth + bullet.length, lengthSource })

  it('is the cylinder over the seating depth for a flat base', () => {
    const i = at(flat, 10, 'measured')
    expect(i.depth).toBeCloseTo(10, 12)
    expect(i.volume.value).toBeCloseTo(cylinder(7.823, 10) / 1000, 12)
    expect(i.volume.tag).toBe('derived')
  })

  it('is the frustum plus the shank cylinder for a given boat tail', () => {
    const frustum = (Math.PI * 4 * (3.3 ** 2 + 3.3 * 4 + 4 ** 2)) / 3
    const i = at(tail, 10, 'measured')
    expect(i.volume.value).toBeCloseTo((frustum + cylinder(8, 6)) / 1000, 12)
    expect(i.volume.tag).toBe('derived')
  })

  it('is the cone plus the shank cylinder for a conical nose seated whole', () => {
    const i = at(cone, 35, 'measured')
    expect(i.volume.value).toBeCloseTo((cylinder(8, 18) + cylinder(8, 12) / 3) / 1000, 12)
    expect(i.notes.join(' ')).toMatch(/whole bullet/)
  })

  it('grows by the cylinder over 1.5 mm for 1.5 mm more length at fixed COAL', () => {
    const coal = 70
    const short = intrusion({ bullet: flat, caseLength: 50, coal, lengthSource: 'measured' })
    const long = intrusion({
      bullet: { ...flat, length: flat.length + 1.5 },
      caseLength: 50,
      coal,
      lengthSource: 'measured',
    })
    // the mouth lies in the shank (12 mm of 30, nose 18 mm) in both runs
    expect([short.depth, long.depth]).toEqual([10, 11.5])
    expect(long.volume.value - short.volume.value).toBeCloseTo(cylinder(7.823, 1.5) / 1000, 12)
  })

  it('flags an estimated length and widens the bounds', () => {
    const measured = at(flat, 10, 'measured')
    const estimated = at(flat, 10, 'estimated')
    expect(estimated.volume.value).toBe(measured.volume.value)
    expect(estimated.volume.tag).toBe('approximate')
    expect(estimated.notes.join(' ')).toMatch(/estimated/)
    expect(measured.high - measured.volume.value).toBeCloseTo(
      cylinder(7.823, bulletLengthTolerance.measured) / 1000,
      12,
    )
    expect(estimated.high - estimated.low).toBeGreaterThan(measured.high - measured.low)
    expect(estimated.low).toBeGreaterThanOrEqual(0)
  })

  it('clamps the lower bound at 0 and widens a whole-seated bullet upward', () => {
    const out = at(flat, 0.01, 'estimated')
    expect(out.low).toBe(0)
    const whole = at(cone, 40, 'estimated')
    expect(whole.high - whole.volume.value).toBeCloseTo(cylinder(8, 0.15 * 30) / 1000, 12)
  })

  it('throws the outline reason for a bullet that cannot be drawn', () => {
    expect(() => at({ diameter: 8, length: 10, noseLength: 12 }, 5, 'measured')).toThrow(RangeError)
  })
})

describe('leadeContact', () => {
  it('puts the leade contact where the lead cone meets the bullet diameter for the 308 Win. chamber', () => {
    const d = 7.823
    const want = 51.44 + 2.89 + (7.87 - d) / 2 / Math.tan(1.75 * deg)
    const c = leadeContact(chamber, d)
    expect('z' in c && c.z).toBeCloseTo(want, 9)
    expect(want).toBeCloseTo(55.1, 1)
  })

  it('names the missing chamber values', () => {
    const c = leadeContact(
      { ...chamber, leadeStart: undefined, leadeEnd: undefined, leadeAngle: undefined },
      7.823,
    )
    expect(c).toEqual({ missing: ['s or G', 'i'] })
  })

  it('has no contact for a bullet not above F', () => {
    expect(leadeContact(chamber, 7.6)).toEqual({ none: expect.stringMatching(/F/) })
  })
})

describe('seat', () => {
  const base = { chamber, waterCapacity: 3.571, waterDensity, barrelLength: 610 }

  it('moves the bullet base with COAL: seating depth is length - (COAL - L3)', () => {
    for (const coal of [69, 70, 71.12]) {
      const s = seat({ ...base, bullet: flat, by: { kind: 'overallLength', value: coal } })
      expect(s.basePosition).toBeCloseTo(coal - 30, 9)
      expect(s.depth.value).toBeCloseTo(30 - (coal - 51.18), 9)
      expect(s.travel?.value).toBeCloseTo(610 - (coal - 30), 9)
      expect(s.coal).toMatchObject({ value: coal, tag: 'entered' })
    }
  })

  it('gives the volume behind the bullet from the water capacity and the seated bullet', () => {
    const s = seat({ ...base, bullet: flat, by: { kind: 'overallLength', value: 71.12 } })
    const depth = 30 - (71.12 - 51.18)
    expect(s.caseVolume?.value).toBeCloseTo(3.571 / waterDensity, 9)
    expect(s.volumeBehindBullet?.value).toBeCloseTo(
      3.571 / waterDensity - cylinder(7.823, depth) / 1000,
      9,
    )
    expect(s.volumeBehindBullet?.tag).toBe('derived')
  })

  it('with a boat tail the volume is larger and approximate', () => {
    const coal = 71.12
    const tail = seat({ ...base, bullet: boatTail, by: { kind: 'overallLength', value: coal } })
    const noTail = seat({
      ...base,
      bullet: { ...boatTail, base: { type: 'flat' } },
      by: { kind: 'overallLength', value: coal },
    })
    expect(tail.volumeBehindBullet?.value).toBeGreaterThan(
      noTail.volumeBehindBullet?.value as number,
    )
    expect(tail.volumeBehindBullet?.tag).toBe('approximate')
  })

  it('flags the volume approximate over an assumed flat base, also with the seated part before the nose', () => {
    // alpha-30425: base.length without base.type, seated in the shank at COAL 72
    const untyped: BulletDimensions = { ...boatTail, base: { length: 5.664 } }
    for (const bullet of [
      untyped,
      { ...boatTail, base: { type: 'boat-tail' } } as BulletDimensions,
    ]) {
      const s = seat({ ...base, bullet, by: { kind: 'overallLength', value: 72 } })
      expect(s.depth.value).toBeLessThan(bullet.length - (bullet.noseLength as number))
      expect(s.volumeBehindBullet?.tag).toBe('approximate')
    }
    const typedFlat = seat({ ...base, bullet: flat, by: { kind: 'overallLength', value: 70 } })
    expect(typedFlat.volumeBehindBullet?.tag).toBe('derived')
  })

  it('gives an approximate jump from COAL and noseLength with the leade contact of the chamber', () => {
    const coal = 71.12
    const s = seat({ ...base, bullet: boatTail, by: { kind: 'overallLength', value: coal } })
    const zc = 51.44 + 2.89 + (7.87 - 7.823) / 2 / Math.tan(1.75 * deg)
    expect(s.jump.value).toBeCloseTo(zc - (coal - 20.193), 9)
    expect(s.jump.tag).toBe('approximate')
    expect(s.jump.missing).toEqual(['a measured CBTO', 'the bullet base-to-ogive'])
    expect(s.contactCoal).toBeCloseTo(zc + 20.193, 9)
  })

  it('shows no jump without noseLength and names it', () => {
    const s = seat({
      ...base,
      bullet: { diameter: 7.823, length: 30 },
      by: { kind: 'overallLength', value: 70 },
    })
    expect(s.jump.value).toBeUndefined()
    expect(s.jump.missing).toContain('the bullet nose length')
  })

  it('seats from CBTO with the bullet base-to-ogive and calls the jump derived', () => {
    const cbto = 52.8
    const s = seat({ ...base, bullet: withOgive, by: { kind: 'baseToOgive', value: cbto } })
    expect(s.basePosition).toBeCloseTo(cbto - 14.3, 9)
    expect(s.coal).toMatchObject({ tag: 'derived' })
    expect(s.coal.value).toBeCloseTo(cbto - 14.3 + 32.69, 9)
    expect(s.cbto).toMatchObject({ value: cbto, tag: 'entered' })
    expect(s.depth.value).toBeCloseTo(51.18 - (cbto - 14.3), 9)
    const zc = 51.44 + 2.89 + (7.87 - 7.823) / 2 / Math.tan(1.75 * deg)
    expect(s.jump.value).toBeCloseTo(zc - (cbto - 14.3 + 32.69 - 20.193), 9)
    expect(s.jump.tag).toBe('derived')
    expect(s.jump.missing).toEqual([])
  })

  it('notes what is missing first when no jump can be given, no land contact in either mode', () => {
    const { leadeAngle: _, ...noI } = chamber
    const s = seat({
      chamber: noI,
      waterDensity,
      bullet: withOgive,
      by: { kind: 'baseToOgive', value: 52.8 },
    })
    expect(s.jump).toMatchObject({ tag: 'derived', missing: ['chamber i'] })
    expect(s.jump.value).toBeUndefined()
    expect(jumpNote(s.jump)).toBe('not given: missing chamber i')
    const below = seat({
      ...base,
      bullet: { ...withOgive, diameter: 7.5 },
      by: { kind: 'baseToOgive', value: 52 },
    })
    expect(jumpNote(below.jump)).toMatch(/^not given: the bullet does not reach the lands/)
    for (const bullet of [
      { ...boatTail, diameter: 5.7 },
      { ...flat, diameter: 5.7, noseLength: undefined },
    ]) {
      const coal = seat({ ...base, bullet, by: { kind: 'overallLength', value: 70 } })
      expect(coal.jump.missing).toEqual([])
      expect(jumpNote(coal.jump)).toMatch(/^not given: the bullet does not reach the lands/)
    }
  })

  it('notes the basis of a given jump', () => {
    const byCbto = seat({ ...base, bullet: withOgive, by: { kind: 'baseToOgive', value: 52.8 } })
    expect(jumpNote(byCbto.jump)).toBe(
      'derived: from the entered CBTO and the bullet base-to-ogive against the CIP minimum chamber, assuming the same comparator',
    )
    const approx = seat({ ...base, bullet: boatTail, by: { kind: 'overallLength', value: 71.12 } })
    expect(jumpNote(approx.jump)).toBe(
      'approximate: from COAL and the bullet length; missing: a measured CBTO, the bullet base-to-ogive',
    )
  })

  it('refuses CBTO without a bullet base-to-ogive', () => {
    expect(() =>
      seat({ ...base, bullet: boatTail, by: { kind: 'baseToOgive', value: 52 } }),
    ).toThrow(/base-to-ogive/)
  })

  it('throws the reason of a bullet whose dimensions form no outline', () => {
    const bullet = { ...boatTail, noseLength: 40 }
    expect(() => seat({ ...base, bullet, by: { kind: 'overallLength', value: 70 } })).toThrow(
      RangeError,
    )
    expect(() => seat({ ...base, bullet, by: { kind: 'overallLength', value: 70 } })).toThrow(
      /nose length/,
    )
  })

  it('reports contact at the leade without clamping the bullet', () => {
    const at = seat({ ...base, bullet: boatTail, by: { kind: 'overallLength', value: 71.12 } })
    const coal = at.contactCoal as number
    const touching = seat({
      ...base,
      bullet: boatTail,
      by: { kind: 'overallLength', value: coal + 0.5 },
    })
    expect(touching.contact).toBe(true)
    expect(touching.basePosition).toBeCloseTo(coal + 0.5 - 32.69, 9)
    expect(touching.jump.value).toBeCloseTo(-0.5, 9)
    expect(at.contact).toBe(false)
  })

  it('flags COAL above L6', () => {
    const over = seat({ ...base, bullet: flat, by: { kind: 'overallLength', value: 71.2 } })
    const at = seat({ ...base, bullet: flat, by: { kind: 'overallLength', value: 71.12 } })
    expect(over.aboveL6).toBe(true)
    expect(at.aboveL6).toBe(false)
  })

  it('leaves volume and travel out without water capacity or barrel', () => {
    const s = seat({
      chamber,
      waterDensity,
      bullet: flat,
      by: { kind: 'overallLength', value: 70 },
    })
    expect(s.volumeBehindBullet).toBeUndefined()
    expect(s.travel).toBeUndefined()
  })

  it('says when the base is in front of the mouth or the whole bullet is in the case', () => {
    const out = seat({ ...base, bullet: flat, by: { kind: 'overallLength', value: 51.18 + 31 } })
    expect(out.notes.join(' ')).toMatch(/not seated/)
    const deep = seat({ ...base, bullet: flat, by: { kind: 'overallLength', value: 51 } })
    expect(deep.notes.join(' ')).toMatch(/whole bullet/)
  })
})

describe('coalRange', () => {
  it('runs from a quarter of the bullet seated to past L6 and the leade contact', () => {
    const [lo, hi] = coalRange(chamber, boatTail, 75.3)
    expect(lo).toBeCloseTo(Math.floor((51.18 + 0.25 * 32.69) * 10) / 10, 9)
    expect(hi).toBeGreaterThan(75.3)
    const [, plain] = coalRange(chamber, flat)
    expect(plain).toBeGreaterThan(71.12)
  })
})

describe('previewDrawn', () => {
  it('draws both sides without dimensions and runs the bore past the tip', () => {
    const drawn = previewDrawn(spec.values, 'I', 80)
    if ('missing' in drawn) throw new Error('not drawn')
    expect(drawn.map((d) => d.side)).toEqual(['cartridge', 'chamber'])
    for (const { p } of drawn) expect(p.annotation.dimensions).toEqual([])
    const bore = drawn[1].p.points.at(-1)
    expect(bore).toEqual([7.62 / 2, 80])
  })

  it('names the missing values', () => {
    const values = spec.values.filter((v) => v.symbol !== 'P1')
    expect(previewDrawn(values, 'I', 80)).toEqual({ missing: ['cartridge P1', 'chamber P1'] })
  })
})
