import { describe, expect, it } from 'vitest'
import { ipscPowerFactor, powerFactor } from '../src/lib/power-factor.ts'
import { kilogramsPerGrain, metersPerFoot } from '../src/lib/units.ts'

describe('mipFactor', () => {
  it('converts a bullet stored in kg, here 124 gr at 360 m/s: 0.1 * 8.03506 g * 360 m/s', () => {
    expect(powerFactor(124 * kilogramsPerGrain, 360)).toBeCloseTo(289.26, 2)
  })
})

describe('ipscPowerFactor', () => {
  it('is grains times ft/s over 1000: 124 gr at 1100 ft/s is 136.4', () => {
    expect(ipscPowerFactor(124 * kilogramsPerGrain, 1100 * metersPerFoot)).toBeCloseTo(136.4, 9)
  })
})
