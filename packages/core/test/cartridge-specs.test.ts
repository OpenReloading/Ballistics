import { describe, expect, it } from 'vitest'
import { cartridgeDiameters } from '../src/index.ts'

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

  it('gives none when F or Z is missing', () => {
    const g1 = v('cartridge', 'G1', 7.85)
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
