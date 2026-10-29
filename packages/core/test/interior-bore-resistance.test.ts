import { describe, expect, it } from 'vitest'
import {
  boreArea,
  boreResistance,
  cartridgeBulletDiameterMm,
  cartridgeGrooveDiameterMm,
  oversizePercent,
  recordResistance,
} from '../src/index.ts'

const c = { bulletDiameterMm: 7.85, boreAreaMm2: 47.51, grooveDiameterMm: 7.82 }
const terms = { stress: 0.42e6, oversize: 1.3, engraving: 0.89 }

describe('bore-resistance law of the load-table fit', () => {
  it('takes the oversize over Z in percent, 0 when negative, none without Z or above 5 %', () => {
    expect(oversizePercent(c)).toBeCloseTo((100 * 0.03) / 7.82, 12)
    expect(oversizePercent({ ...c, bulletDiameterMm: 7.8 })).toBe(0)
    expect(oversizePercent({ ...c, bulletDiameterMm: 9 })).toBeUndefined()
    expect(oversizePercent({ bulletDiameterMm: 7.85 })).toBeUndefined()
    expect(oversizePercent({ bulletDiameterMm: 10.5, grooveDiameterMm: 10 })).toBe(5)
  })

  it('gives friction from the side area and engraving falling to 0 over the bearing length', () => {
    const r = boreResistance(terms, c, 30, 30e6)
    const o = (100 * 0.03) / 7.82
    expect(r?.friction).toBeCloseTo(((0.42e6 * Math.PI * 7.85 * 30) / 47.51) * (1 + 1.3 * o), 6)
    expect(r?.engraving).toEqual([
      { travel: 0, pressure: 0.89 * 30e6 },
      { travel: 0.03, pressure: 0 },
    ])
  })

  it('leaves a term out at 0 and gives nothing when both are 0', () => {
    const noEngraving = boreResistance({ ...terms, engraving: 0 }, c, 30, 30e6)
    expect(noEngraving?.engraving).toBeUndefined()
    expect(noEngraving?.friction).toBeGreaterThan(0)
    const noFriction = boreResistance({ ...terms, stress: 0 }, c, 30, 30e6)
    expect(noFriction?.friction).toBeUndefined()
    expect(noFriction?.engraving).toHaveLength(2)
    expect(boreResistance({ stress: 0, oversize: 1.3, engraving: 0 }, c, 30, 30e6)).toBeUndefined()
  })
})

describe('bore area', () => {
  it('takes the area Q, else the circle of the mean of F and Z, else the circle of F', () => {
    expect(boreArea({ area: 47.51, boreDiameter: 7.62, grooveDiameter: 7.82 })).toBe(47.51)
    expect(boreArea({ boreDiameter: 7.62, grooveDiameter: 7.82 })).toBeCloseTo(
      (Math.PI / 4) * 7.72 ** 2,
      12,
    )
    expect(boreArea({ boreDiameter: 7.62 })).toBeCloseTo((Math.PI / 4) * 7.62 ** 2, 12)
  })
})

describe('bore resistance of a record for a run', () => {
  const law = {
    interior: { resistance: { stress: { value: 4.2 }, oversize: 1.3, engraving: 0.89 } },
  }
  const run = {
    boreDiameter: 7.62e-3,
    boreArea: 47.51e-6,
    startPressure: 30e6,
    cartridge: { g1: 7.85, z: 7.82 },
    bulletLengthMm: 30,
  }

  it('gives nothing and misses nothing for a record without the law', () => {
    expect(recordResistance({}, run)).toEqual({ missing: [] })
    expect(recordResistance({ interior: {} }, run)).toEqual({ missing: [] })
  })

  it('names what the run lacks', () => {
    const { cartridge: _, bulletLengthMm: __, ...bare } = run
    expect(recordResistance(law, bare)).toEqual({
      missing: ['a cartridge record', 'a bullet length'],
    })
    expect(recordResistance(law, { ...run, bulletLengthMm: undefined })).toEqual({
      missing: ['a bullet length'],
    })
    expect(recordResistance(law, { ...run, cartridge: undefined })).toEqual({
      missing: ['a cartridge record'],
    })
  })

  it('converts the record and the run to the law: stress from bar, area to mm2, G1 or the bore', () => {
    expect(recordResistance(law, run)).toEqual({
      resistance: boreResistance(terms, c, 30, 30e6),
      missing: [],
    })
    const noG1 = recordResistance(law, { ...run, cartridge: { z: 7.82 } }).resistance
    expect(noG1).toEqual(boreResistance(terms, { ...c, bulletDiameterMm: 7.62 }, 30, 30e6))
  })
})

describe('G1 and Z of a cartridge record', () => {
  const v = (side: string, symbol: string, value?: number) => ({ side, symbol, value })
  const cartridge = {
    values: [
      v('cartridge', 'G1', 7.9),
      v('cartridge', 'G1', 7.85),
      v('chamber', 'Z', 7.82),
      v('chamber', 'Z', 7.9),
    ],
  }

  it('takes the smallest cartridge-side G1 and the first chamber Z of the CIP sheet', () => {
    expect(cartridgeBulletDiameterMm(cartridge)).toBe(7.85)
    expect(cartridgeGrooveDiameterMm(cartridge)).toBe(7.82)
  })

  it('gives none without a value', () => {
    const none = { values: [v('chamber', 'Z')] }
    expect(cartridgeBulletDiameterMm(none)).toBeUndefined()
    expect(cartridgeGrooveDiameterMm(none)).toBeUndefined()
  })
})
