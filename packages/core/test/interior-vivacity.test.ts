import { describe, expect, it } from 'vitest'
import {
  dynamicVivacity,
  InputError,
  meanDynamicVivacity,
  type VivacityBurn,
} from '../src/index.ts'

const burn = (a: number): VivacityBurn => ({
  kind: 'vivacity',
  vivacity: 0.6,
  exponent: 1,
  referencePressure: 98066.5,
  form: { kind: 'twoStage', a, m: 0.5, q: 0.5, z1: 0.8 },
})

/** Integral of phi over [0, z] for twoStage with m = q = 0.5, z1 = 0.8, in closed form. */
function phiIntegral(a: number, z: number): number {
  const first = (u: number) => (a === 0 ? u : ((1 + a * u) ** 1.5 - 1) / (1.5 * a))
  if (z <= 0.8) return first(z)
  const phi1 = Math.sqrt(1 + 0.8 * a)
  // phi1 ((1 - z)/0.2)^0.5 integrates to -phi1 0.2 / 1.5 ((1 - z)/0.2)^1.5
  return first(0.8) + ((phi1 * 0.2) / 1.5) * (1 - ((1 - z) / 0.2) ** 1.5)
}

describe('dynamic vivacity', () => {
  it('equals B_a phi(z) / p_ref at closed-form points', () => {
    const k = 0.6 / 98066.5
    expect(dynamicVivacity(burn(0.8), 0)).toBeCloseTo(k, 18)
    expect(dynamicVivacity(burn(0.8), 0.5) / k).toBeCloseTo(Math.sqrt(1.4), 14)
    expect(dynamicVivacity(burn(0.8), 0.8) / k).toBeCloseTo(Math.sqrt(1.64), 14)
    expect(dynamicVivacity(burn(0.8), 0.9) / k).toBeCloseTo(Math.sqrt(1.64 * 0.5), 14)
    expect(dynamicVivacity(burn(0), 0.5) / k).toBeCloseTo(1, 14)
    expect(dynamicVivacity(burn(0), 0.95) / k).toBeCloseTo(Math.sqrt(0.25), 14)
    expect(dynamicVivacity(burn(0), 1)).toBe(0)
  })

  it('mean over 0.1 to 0.9 equals the closed-form integral', () => {
    for (const a of [0, 0.8]) {
      const exact = ((0.6 / 98066.5) * (phiIntegral(a, 0.9) - phiIntegral(a, 0.1))) / 0.8
      expect(meanDynamicVivacity(burn(a)) / exact).toBeCloseTo(1, 10)
    }
    const exact = ((0.6 / 98066.5) * (phiIntegral(0.8, 0.85) - phiIntegral(0.8, 0.2))) / 0.65
    expect(meanDynamicVivacity(burn(0.8), 0.2, 0.85) / exact).toBeCloseTo(1, 10)
  })

  it('rejects an exponent other than 1 and a range outside 0 to 1', () => {
    expect(() => dynamicVivacity({ ...burn(0), exponent: 1.1 }, 0.5)).toThrow(InputError)
    expect(() => meanDynamicVivacity(burn(0), 0.5, 0.4)).toThrow(InputError)
    expect(() => meanDynamicVivacity(burn(0), -0.1, 0.4)).toThrow(InputError)
  })
})
