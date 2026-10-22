import { describe, expect, it } from 'vitest'
import {
  boreResistance,
  cartridgeBulletDiameterMm,
  cartridgeGrooveDiameterMm,
  oversizePercent,
} from '../src/index.ts'

const c = { bulletDiameterMm: 7.85, boreAreaMm2: 47.51, grooveDiameterMm: 7.82 }
const terms = { stress: 0.42e6, oversize: 1.3, engraving: 0.89 }

describe('bore-resistance law of the load-table fit', () => {
  it('takes the oversize over Z in percent, 0 when negative, none without Z or above 5 %', () => {
    expect(oversizePercent(c)).toBeCloseTo((100 * 0.03) / 7.82, 12)
    expect(oversizePercent({ ...c, bulletDiameterMm: 7.8 })).toBe(0)
    expect(oversizePercent({ ...c, bulletDiameterMm: 9 })).toBeUndefined()
    expect(oversizePercent({ bulletDiameterMm: 7.85 })).toBeUndefined()
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
    expect(boreResistance({ ...terms, engraving: 0 }, c, 30, 30e6)?.engraving).toBeUndefined()
    expect(boreResistance({ ...terms, stress: 0 }, c, 30, 30e6)?.friction).toBeUndefined()
    expect(boreResistance({ stress: 0, oversize: 1.3, engraving: 0 }, c, 30, 30e6)).toBeUndefined()
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
