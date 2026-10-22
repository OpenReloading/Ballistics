import { describe, expect, it } from 'vitest'
import {
  aerodynamicJump,
  dynamicStabilityFactor,
  isStable,
  millerStability,
  radPerMoa,
  spinDrift,
} from '../src/index.ts'

const inch = 0.0254
const base = {
  mass: 0.01,
  diameter: 0.0078,
  length: 0.032,
  twist: 0.254,
  velocity: 2800 * 0.3048,
  air: { altitude: 0, pressure: 29.92 * 3386.389, temperature: 288.15, humidity: 0 },
}

describe('Miller stability', () => {
  it('has unit corrections at 2800 ft/s, 59 degF and 29.92 inHg', () => {
    // 30 m / (t^2 d^3 l (1 + l^2)): m = 154.3236 gr, d = 7.8 / 25.4 in, t = 254 / 7.8, l = 32 / 7.8
    expect(millerStability(base)).toBeCloseTo(2.060918, 6)
  })

  it('scales with twist, velocity and density', () => {
    const sg = millerStability(base)
    expect(millerStability({ ...base, twist: 2 * base.twist }) / sg).toBeCloseTo(0.25, 12)
    expect(millerStability({ ...base, velocity: 8 * base.velocity }) / sg).toBeCloseTo(2, 12)
    const warm = { ...base.air, temperature: 1.1 * 288.15, pressure: 0.9 * base.air.pressure }
    expect(millerStability({ ...base, air: warm }) / sg).toBeCloseTo(1.1 / 0.9, 12)
    expect(() => millerStability({ ...base, twist: 0 })).toThrow(RangeError)
  })
})

describe('dynamic stability', () => {
  it('computes the factor of linear theory', () => {
    const c = {
      liftSlope: 2,
      drag: 0.5,
      magnusMoment: 0,
      pitchDamping: -3,
      mass: 0.01,
      diameter: 0.01,
      axialInertia: 1e-7,
      transverseInertia: 1e-6,
    }
    expect(dynamicStabilityFactor(c)).toBeCloseTo(4 / 4.5, 12)
    expect(dynamicStabilityFactor({ ...c, drag: 0, pitchDamping: 0 })).toBe(2)
  })

  it('tests the stability band at its edges', () => {
    expect(isStable(2, 0)).toBe(false)
    expect(isStable(2, 1)).toBe(true)
    expect(isStable(2, 2)).toBe(false)
    expect(isStable(1, 1)).toBe(false)
  })
})

describe('spin drift and jump', () => {
  it('drifts toward the twist hand', () => {
    expect(spinDrift(1.8, 0, 'right')).toBe(0)
    expect(spinDrift(1.8, 1, 'right')).toBeCloseTo(1.25 * 3 * inch, 12)
    expect(spinDrift(1.8, 1, 'left')).toBeCloseTo(-1.25 * 3 * inch, 12)
    expect(spinDrift(1.8, 2, 'right')).toBeCloseTo(1.25 * 3 * 2 ** 1.83 * inch, 12)
  })

  it('jumps linearly in crosswind, signed by hand and wind side', () => {
    expect(aerodynamicJump(2, 4, 0, 'right')).toBeCloseTo(0, 15)
    const perMph = 0.01 * 2 - 0.0024 * 4 + 0.032
    expect(aerodynamicJump(2, 4, 0.44704, 'right')).toBeCloseTo(-perMph * radPerMoa, 15)
    expect(aerodynamicJump(2, 4, 2 * 0.44704, 'right')).toBeCloseTo(-2 * perMph * radPerMoa, 15)
    // right-hand twist, wind blowing to the right: down (BRL-MR-3877 eq. (12))
    expect(aerodynamicJump(2, 4, 3, 'right')).toBeLessThan(0)
    expect(aerodynamicJump(2, 4, -3, 'right')).toBeGreaterThan(0)
    expect(aerodynamicJump(2, 4, 3, 'left')).toBeGreaterThan(0)
    expect(aerodynamicJump(2, 4, -3, 'left')).toBeLessThan(0)
  })
})
