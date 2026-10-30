import { describe, expect, it } from 'vitest'
import { type InteriorLoad, type InteriorRun, interior } from '../src/index.ts'

const base: InteriorLoad = {
  chamber: { volume: 3.4e-6, boreArea: 3.75e-5, boreDiameter: 7e-3 },
  barrel: { length: 0.6, twist: 0.254 },
  bullet: { mass: 0.0095 },
  charge: 0.0028,
  propellant: {
    specificEnergy: 3.9e6,
    gamma: 1.23,
    density: 1600,
    covolume: 1e-3,
    burn: {
      kind: 'geometric',
      coefficient: 7e-9,
      exponent: 0.9,
      grain: { shape: 'sevenPerf', diameter: 1.25e-3, perforationDiameter: 1.5e-4, length: 2e-3 },
    },
    temperatureSensitivity: { reference: 294.15, cold: 0, hot: 0 },
  },
  propellantTemperature: 314.15,
  ignitionPressure: 5e6,
  startPressure: 25e6,
}

const withEnergy = (energyTemperature: number | undefined, temperature = 314.15): InteriorLoad => ({
  ...base,
  propellant: { ...base.propellant, energyTemperature },
  propellantTemperature: temperature,
})

function run(load: InteriorLoad): InteriorRun {
  const r = interior(load)
  if (!r.valid) throw new Error(r.reason)
  return r
}

describe('energy temperature', () => {
  it('leaves the run unchanged at 0 and when omitted', () => {
    const plain = run(withEnergy(undefined))
    const zero = run(withEnergy(0))
    expect(zero.muzzleVelocity).toBe(plain.muzzleVelocity)
    expect(zero.peakBreechPressure).toBe(plain.peakBreechPressure)
  })

  it('has no effect at the reference temperature', () => {
    const plain = run(withEnergy(0, 294.15))
    const same = run(withEnergy(3e-4, 294.15))
    expect(same.muzzleVelocity).toBe(plain.muzzleVelocity)
  })

  it('raises muzzle velocity and peak pressure above the reference and lowers them below', () => {
    const plain = run(withEnergy(0))
    const hot = run(withEnergy(3e-4))
    expect(hot.muzzleVelocity).toBeGreaterThan(plain.muzzleVelocity)
    expect(hot.peakBreechPressure).toBeGreaterThan(plain.peakBreechPressure)
    const coldPlain = run(withEnergy(0, 274.15))
    const cold = run(withEnergy(3e-4, 274.15))
    expect(cold.muzzleVelocity).toBeLessThan(coldPlain.muzzleVelocity)
    expect(cold.peakBreechPressure).toBeLessThan(coldPlain.peakBreechPressure)
  })

  it('equals a run with the specific energy scaled by the factor', () => {
    const factor = Math.exp(3e-4 * 20)
    const scaled = run({
      ...base,
      propellant: { ...base.propellant, specificEnergy: base.propellant.specificEnergy * factor },
    })
    const viaOption = run(withEnergy(3e-4))
    expect(viaOption.muzzleVelocity).toBeCloseTo(scaled.muzzleVelocity, 9)
    expect(viaOption.peakBreechPressure).toBeCloseTo(scaled.peakBreechPressure, 3)
    expect(viaOption.efficiency).toBeCloseTo(scaled.efficiency, 12)
  })

  it('refuses a value without a reference temperature or that is not finite', () => {
    const { temperatureSensitivity: _, ...noSensitivity } = base.propellant
    expect(
      interior({ ...base, propellant: { ...noSensitivity, energyTemperature: 3e-4 } }),
    ).toMatchObject({ valid: false, reason: 'input', field: 'propellant.energyTemperature' })
    expect(interior(withEnergy(Number.NaN))).toMatchObject({
      valid: false,
      reason: 'input',
      field: 'propellant.energyTemperature',
    })
    expect(
      interior({ ...base, propellant: { ...noSensitivity, energyTemperature: 0 } }).valid,
    ).toBe(true)
  })
})
