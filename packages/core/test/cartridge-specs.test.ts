import { describe, expect, it } from 'vitest'
import {
  cartridgeBoreAreaMm2,
  cartridgeBulletDiameterMm,
  cartridgeDiameters,
  cartridgeGrooveDiameterMm,
} from '../src/index.ts'

const v = (side: string, symbol: string, value?: number) => ({ side, symbol, value })

describe('diameters of a cartridge record', () => {
  it('takes the smallest G1, F and Z', () => {
    const cartridge = {
      values: [
        v('cartridge', 'G1', 7.9),
        v('cartridge', 'G1', 7.85),
        v('chamber', 'F', 7.6),
        v('chamber', 'F', 7.55),
        v('chamber', 'Z', 7.9),
        v('chamber', 'Z', 7.82),
      ],
    }
    expect(cartridgeDiameters(cartridge)).toEqual({ g1: 7.85, land: 7.55, groove: 7.82 })
  })

  it('gives none when G1, F or Z is missing', () => {
    const g1 = v('cartridge', 'G1', 7.85)
    expect(
      cartridgeDiameters({ values: [v('chamber', 'F', 7.55), v('chamber', 'Z', 7.82)] }),
    ).toBeUndefined()
    expect(cartridgeDiameters({ values: [g1, v('chamber', 'Z', 7.82)] })).toBeUndefined()
    expect(cartridgeDiameters({ values: [g1, v('chamber', 'F', 7.55)] })).toBeUndefined()
  })

  it('ignores a value without a number and one on the other side', () => {
    const cartridge = {
      values: [
        v('cartridge', 'G1', 7.85),
        v('chamber', 'F', undefined),
        v('cartridge', 'F', 7.55),
        v('chamber', 'Z', 7.82),
      ],
    }
    expect(cartridgeDiameters(cartridge)).toBeUndefined()
  })
})

describe('single values of a cartridge record', () => {
  const cartridge = {
    values: [
      v('chamber', 'G1', 7.7),
      v('cartridge', 'G1', 7.9),
      v('cartridge', 'G1', 7.85),
      v('cartridge', 'Z', 7.5),
      v('chamber', 'F', 7.4),
      v('chamber', 'Z', undefined),
      v('chamber', 'Z', 7.9),
      v('chamber', 'Z', 7.82),
      v('cartridge', 'Q', 40),
      v('chamber', 'Q', undefined),
      v('chamber', 'Q', 47.5),
      v('chamber', 'Q', 47.1),
    ],
  }

  it('takes the smallest cartridge-side G1', () => {
    expect(cartridgeBulletDiameterMm(cartridge)).toBe(7.85)
  })

  it('takes the first chamber-side Z and Q with a number', () => {
    expect(cartridgeGrooveDiameterMm(cartridge)).toBe(7.9)
    expect(cartridgeBoreAreaMm2(cartridge)).toBe(47.5)
  })

  it('gives none without a value', () => {
    const empty = { values: [v('cartridge', 'Z', 7.5), v('cartridge', 'Q', 40)] }
    expect(cartridgeBulletDiameterMm(empty)).toBeUndefined()
    expect(cartridgeGrooveDiameterMm(empty)).toBeUndefined()
    expect(cartridgeBoreAreaMm2(empty)).toBeUndefined()
  })
})
