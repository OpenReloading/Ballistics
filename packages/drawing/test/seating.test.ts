import { describe, expect, it } from 'vitest'
import {
  assumedBoatTailAngle,
  type BulletDimensions,
  bulletLengthTolerance,
  bulletOutline,
  chamberOf,
  coalRange,
  estimateIntrusion,
  intrusion,
  jumpNote,
  landsContactCoal,
  leadeContact,
  previewDrawn,
  revolutionVolume,
  type SeatingValues,
  seat,
} from '../src/seating/index.ts'
import { defined } from './defined.ts'
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

  it('gives no values without a cartridge L3 and leaves out the chamber values a sheet lacks', () => {
    const l3 = { side: 'cartridge', symbol: 'L3', quantity: 'length', value: 51.18 } as const
    expect(
      chamberOf(spec.values.filter((v) => !(v.side === 'cartridge' && v.symbol === 'L3'))),
    ).toBeUndefined()
    expect(chamberOf([l3])).toEqual({
      caseLength: 51.18,
      cartridgeL6: undefined,
      chamberL3: undefined,
      G1: undefined,
      F: undefined,
      leadeEnd: undefined,
      leadeStart: undefined,
      leadeAngle: undefined,
    })
  })
})

describe('bulletOutline', () => {
  it('draws the boat tail from the assumed angle and flags it, the shank not', () => {
    const o = drawn(boatTail)
    const base = defined(o.points[1])
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

describe('hollow base', () => {
  /** A flat-faced cylinder under a sharp cone, a cavity of diameter 5 in the base: depth 2.5. */
  const hollow = (type: 'conical-hollow-base' | 'rounded-hollow-base'): BulletDimensions => ({
    diameter: 8,
    length: 30,
    noseLength: 12,
    meplatDiameter: 0,
    ogive: { radiusRatio: 0 },
    base: { type, cavityDiameter: 5 },
  })
  const solid: BulletDimensions = { ...hollow('conical-hollow-base'), base: { type: 'flat' } }
  const [rc, a] = [2.5, 4]
  /** The cone cavity below z = c, 0 <= c <= its depth rc. */
  const coneBelow = (c: number) => (Math.PI * rc ** 3 * (1 - (1 - c / rc) ** 3)) / 3
  const below = (bullet: BulletDimensions, depth: number, caseLength = 50) =>
    intrusion({
      bullet,
      caseLength,
      coal: caseLength - depth + bullet.length,
      lengthSource: 'measured',
    })

  it('cylinder with a conical cavity: the cylinder less the cone, once the mouth is past the cavity', () => {
    const i = below(hollow('conical-hollow-base'), 10)
    expect(i.volume.value).toBeCloseTo((cylinder(8, 10) - (Math.PI * rc ** 3) / 3) / 1000, 12)
  })

  it('cylinder with a spherical-cap cavity: the cylinder less the hemisphere, within the sampling error', () => {
    const hemisphere = (2 / 3) * Math.PI * rc ** 3
    const i = below(hollow('rounded-hollow-base'), 10)
    const taken = cylinder(8, 10) - i.volume.value * 1000
    expect(taken).toBeLessThan(hemisphere)
    expect(taken).toBeGreaterThan(hemisphere * 0.997)
  })

  it('counts only the cavity below the mouth when the mouth is inside the cavity', () => {
    const i = below(hollow('conical-hollow-base'), 1)
    expect(i.volume.value).toBeCloseTo((cylinder(8, 1) - coneBelow(1)) / 1000, 12)
  })

  it('1.5 mm more length at fixed COAL adds the cylinder of that length, solid or hollow, past the cavity', () => {
    for (const bullet of [solid, hollow('conical-hollow-base'), hollow('rounded-hollow-base')]) {
      const [short, long] = [below(bullet, 10).volume.value, below(bullet, 11.5).volume.value]
      expect(long - short).toBeCloseTo((Math.PI * a ** 2 * 1.5) / 1000, 12)
    }
  })

  it('1.5 mm more length at fixed COAL adds less when the mouth is inside the cavity', () => {
    const volume = (depth: number) => below(hollow('conical-hollow-base'), depth).volume.value
    const [short, long] = [volume(0.5), volume(2)]
    const expected = cylinder(8, 1.5) - (coneBelow(2) - coneBelow(0.5))
    expect(long - short).toBeCloseTo(expected / 1000, 12)
    expect(expected).toBeLessThan(cylinder(8, 1.5))
  })

  it('flags the volume approximate once the mouth passes the base, whatever the length source', () => {
    expect(below(hollow('conical-hollow-base'), 10).volume.tag).toBe('approximate')
    expect(below(solid, 10).volume.tag).toBe('derived')
    expect(below(hollow('conical-hollow-base'), -2).volume.tag).toBe('derived')
  })

  it('leaves the volume behind the bullet to the free volume of the cavity', () => {
    const water = 40
    const seated = (bullet: BulletDimensions) =>
      seat({
        bullet,
        chamber,
        waterCapacity: water,
        waterDensity,
        by: { kind: 'overallLength', value: 60 },
      })
    const [h, s] = [seated(hollow('conical-hollow-base')), seated(solid)]
    const [vh, vs] = [h.volumeBehindBullet?.value, s.volumeBehindBullet?.value] as [number, number]
    expect(vh - vs).toBeCloseTo((Math.PI * rc ** 3) / 3 / 1000, 9)
    expect(h.volumeBehindBullet?.tag).toBe('approximate')
    expect(s.volumeBehindBullet?.tag).toBe('derived')
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

  describe('with a measured lands contact', () => {
    it('gives the jump from the measured CBTO, in either seating mode', () => {
      const lands = { baseToOgive: 53.1 }
      const byCbto = seat({
        ...base,
        bullet: withOgive,
        lands,
        by: { kind: 'baseToOgive', value: 52.8 },
      })
      expect(byCbto.jump).toMatchObject({ tag: 'derived', missing: [], source: 'lands' })
      expect(byCbto.jump.value).toBeCloseTo(0.3, 9)
      expect(byCbto.contact).toBe(false)
      const coal = 52.8 - 14.3 + 32.69
      const byCoal = seat({
        ...base,
        bullet: withOgive,
        lands,
        by: { kind: 'overallLength', value: coal },
      })
      expect(byCoal.jump.value).toBeCloseTo(0.3, 9)
      expect(byCoal.contactCoal).toBeCloseTo(53.1 - 14.3 + 32.69, 9)
      expect(jumpNote(byCoal.jump)).toBe(
        'derived: from the measured lands contact of the firearm and the entered length',
      )
    })

    it('gives the jump from the measured COAL and needs no nose length or chamber value', () => {
      const bare: BulletDimensions = { diameter: 7.823, length: 30 }
      const { leadeAngle: _, ...noI } = chamber
      const s = seat({
        chamber: noI,
        waterDensity,
        bullet: bare,
        lands: { overallLength: 70.5 },
        by: { kind: 'overallLength', value: 70 },
      })
      expect(s.jump.value).toBeCloseTo(0.5, 9)
      expect(s.jump.source).toBe('lands')
      expect(s.contactCoal).toBeCloseTo(70.5, 9)
    })

    it('is in contact at or past the measured length and prefers the CBTO when both are given', () => {
      const lands = { baseToOgive: 53.1, overallLength: 99 }
      const at = seat({
        ...base,
        bullet: withOgive,
        lands,
        by: { kind: 'baseToOgive', value: 53.1 },
      })
      expect(at.jump.value).toBeCloseTo(0, 9)
      expect(at.contact).toBe(true)
      const past = seat({
        ...base,
        bullet: withOgive,
        lands,
        by: { kind: 'baseToOgive', value: 53.4 },
      })
      expect(past.jump.value).toBeCloseTo(-0.3, 9)
      expect(past.contact).toBe(true)
    })

    it('keeps the chamber jump for a CBTO contact on a bullet without a base-to-ogive', () => {
      const s = seat({
        ...base,
        bullet: boatTail,
        lands: { baseToOgive: 53.1 },
        by: { kind: 'overallLength', value: 71.12 },
      })
      expect(s.jump.source).toBe('chamber')
      expect(s.jump.tag).toBe('approximate')
      expect(landsContactCoal(boatTail, { baseToOgive: 53.1 })).toBeUndefined()
      expect(landsContactCoal(withOgive, { baseToOgive: 53.1 })).toBeCloseTo(53.1 - 14.3 + 32.69, 9)
    })
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

  it('gives no volume behind the bullet for a base behind the case head or a bullet that fills the case', () => {
    const short = { ...chamber, caseLength: 50 }
    const behind = seat({
      chamber: short,
      waterCapacity: 3,
      waterDensity: 1,
      bullet: { ...flat, length: 80 },
      by: { kind: 'overallLength', value: 60 },
    })
    expect(behind.depth.value).toBeCloseTo(70, 9)
    expect(behind.volumeBehindBullet).toBeUndefined()
    expect(behind.caseVolume?.value).toBe(3)
    expect(behind.notes.join(' ')).toMatch(/behind the case head/)
    const full = seat({
      chamber: short,
      waterCapacity: 0.1,
      waterDensity: 1,
      bullet: flat,
      by: { kind: 'overallLength', value: 55 },
    })
    expect(full.volumeBehindBullet).toBeUndefined()
    expect(full.notes.join(' ')).toMatch(/takes the whole case volume/)
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
    const bore = defined(drawn[1]).p.points.at(-1)
    expect(bore).toEqual([7.62 / 2, 80])
  })

  it('names the missing values', () => {
    const values = spec.values.filter((v) => v.symbol !== 'P1')
    expect(previewDrawn(values, 'I', 80)).toEqual({ missing: ['cartridge P1', 'chamber P1'] })
  })
})

describe('estimateIntrusion', () => {
  const density = { value: 7.3, error: 0.214 }
  const [diameter, coal, caseLength] = [7.823, 71.12, 51.18]
  const area = (Math.PI / 4) * diameter ** 2
  /** The mass of a bullet of length `length` (mm) and effective density `rho` (g/cm³). */
  const massOf = (length: number, rho: number) => (rho * area * length) / 1000
  const truth = (b: BulletDimensions) =>
    intrusion({ bullet: b, caseLength, coal, lengthSource: 'measured' }).volume.value

  it('takes the length from the mass over the effective density and the cylinder area', () => {
    const e = estimateIntrusion({ diameter, mass: massOf(30, 7.3), density, caseLength, coal })
    expect(e.length).toBeCloseTo(30, 9)
    expect(e.volume.tag).toBe('approximate')
    expect(e.notes.join(' ')).toMatch(/estimated/)
    // the point is the volume of the outline of that length, as for a bullet with it
    expect(e.volume.value).toBeCloseTo(truth({ diameter, length: 30 }), 9)
  })

  it('bounds the volume by the length error and keeps a bullet inside the band of its class', () => {
    // a bullet whose effective density is at either end of the band of the length error
    for (const factor of [1 - density.error, 1 + density.error]) {
      for (const base of [flat, boatTail]) {
        const mass = massOf(base.length, density.value * factor)
        const e = estimateIntrusion({ diameter, mass, density, caseLength, coal })
        expect(e.low).toBeLessThan(e.volume.value)
        expect(e.high).toBeGreaterThan(e.volume.value)
        // the volume of the same length, with the proportions the outline assumes
        const v = truth({ diameter, length: base.length })
        expect(v).toBeGreaterThanOrEqual(e.low - 1e-9)
        expect(v).toBeLessThanOrEqual(e.high + 1e-9)
      }
    }
  })

  it('takes the whole bullet when it is seated wholly below the mouth', () => {
    const e = estimateIntrusion({ diameter, mass: massOf(30, 7.3), density, caseLength, coal: 40 })
    expect(e.volume.value).toBeGreaterThan(0)
    expect(e.notes.join(' ')).toMatch(/whole bullet/)
  })

  it('gives no volume for a bullet that stays out of the case', () => {
    const e = estimateIntrusion({ diameter, mass: massOf(30, 7.3), density, caseLength, coal: 90 })
    expect(e.volume.value).toBe(0)
  })
})
