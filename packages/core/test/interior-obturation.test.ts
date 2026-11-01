import { describe, expect, it } from 'vitest'
import {
  castHarderThanPeak,
  obturationPressurePerBrinell,
  plainBaseCastHardness,
} from '../src/interior/obturation.ts'

const cast = (hardness?: number, gasCheck?: boolean) => ({
  structure: 'cast',
  ...(gasCheck !== undefined && { gasCheck }),
  core: {
    material: 'lead-alloy',
    ...(hardness !== undefined && { hardness: { value: hardness } }),
  },
})

describe('obturation of a plain-base cast bullet', () => {
  it('is 1422 psi per Brinell number, BHN 12 about 118 MPa and BHN 22 about 216 MPa', () => {
    expect(obturationPressurePerBrinell).toBeCloseTo(9.80434e6, -2)
    expect((12 * obturationPressurePerBrinell) / 1e6).toBeCloseTo(117.7, 1)
    expect((22 * obturationPressurePerBrinell) / 1e6).toBeCloseTo(215.7, 1)
  })

  it('reads the hardness only of a cast bullet without a gas check', () => {
    expect(plainBaseCastHardness(cast(18))).toBe(18)
    expect(plainBaseCastHardness(cast(18, false))).toBe(18)
    expect(plainBaseCastHardness(cast(18, true))).toBeUndefined()
    expect(plainBaseCastHardness(cast())).toBeUndefined()
    expect(plainBaseCastHardness({ ...cast(18), structure: 'swaged' })).toBeUndefined()
    expect(plainBaseCastHardness(undefined)).toBeUndefined()
  })

  it('compares the obturation pressure with the peak', () => {
    // BHN 18 is about 176 MPa: above a 150 MPa peak, below a 232 MPa peak.
    expect(castHarderThanPeak(18, 150e6)).toBe(true)
    expect(castHarderThanPeak(18, 232e6)).toBe(false)
  })
})
