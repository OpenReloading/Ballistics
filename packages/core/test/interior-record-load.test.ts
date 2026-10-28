import { describe, expect, it } from 'vitest'
import {
  InputError,
  interior,
  interiorLoad,
  powderModelValues,
  type RecordPowder,
  type RecordRun,
  recordLoad,
  recordResistance,
  ValueError,
} from '../src/index.ts'

const cartridge = {
  values: [
    { side: 'cartridge', symbol: 'G1', value: 7.85 },
    { side: 'chamber', symbol: 'F', value: 7.62 },
    { side: 'chamber', symbol: 'F', value: 7.5, variant: 'other' },
    { side: 'chamber', symbol: 'Z', value: 7.82 },
    { side: 'chamber', symbol: 'Q', value: 47.51 },
    { side: 'chamber', symbol: 'u', value: 305 },
  ],
}

const powder: RecordPowder = {
  interior: {
    energy: { value: 3950000 },
    gamma: 1.215,
    density: { value: 1.6 },
    covolume: { value: 0.00097 },
    vivacity: { value: 0.612 },
    pressureExponent: 1,
    referencePressure: { value: 0.980665 },
    ignitionPressure: { value: 50 },
    propellantTemperature: { value: 21 },
    resistance: { stress: { value: 4.2 }, oversize: 1.3, engraving: 0 },
    burnForm: { a: { value: 0.05 }, m: 0.5, q: 0.5, z1: 0.8 },
  },
}

const sensitive: RecordPowder = {
  ...powder,
  temperatureSensitivity: {
    reference: { value: 294.15 },
    cold: { value: 0.002 },
    hot: { value: 0.001 },
  },
}

const run: RecordRun = {
  cartridge,
  powder,
  bullet: { mass: 0.010886, lengthMm: 30.5 },
  charge: 0.0024,
  volume: 3.1e-6,
  travel: 0.58,
}

describe('recordLoad', () => {
  it('gives the load the workbench steps build from the same records', () => {
    const model = powderModelValues(powder) as Record<string, number>
    const base = interiorLoad({
      ...model,
      bulletMass: run.bullet.mass,
      charge: run.charge,
      volume: run.volume,
      travel: run.travel,
      boreDiameter: 7.62e-3,
      twist: 0.305,
      boreArea: 47.51e-6,
      propellantTemperature: 294.15,
    })
    const { resistance } = recordResistance(powder, {
      boreDiameter: base.chamber.boreDiameter,
      boreArea: base.chamber.boreArea,
      startPressure: base.startPressure,
      cartridge: { g1: 7.85, z: 7.82 },
      bulletLengthMm: 30.5,
    })
    expect(resistance).toBeDefined()
    expect(recordLoad(run)).toEqual({ ...base, resistance })
  })

  it('runs in the model and takes the temperature of the run', () => {
    const withSensitivity = { ...run, powder: sensitive }
    const cold = interior(recordLoad({ ...withSensitivity, temperature: 253.15 }))
    const warm = interior(recordLoad(withSensitivity))
    if (!cold.valid || !warm.valid) throw new Error('run refused')
    expect(warm.muzzleVelocity).toBeGreaterThan(300)
    expect(cold.muzzleVelocity).toBeLessThan(warm.muzzleVelocity)
  })

  it('takes the bore area from the circle of F and Z without Q', () => {
    const noQ = { values: cartridge.values.filter((v) => v.symbol !== 'Q') }
    const { chamber } = recordLoad({ ...run, cartridge: noQ })
    expect(chamber.boreArea).toBeCloseTo((Math.PI / 4) * ((7.62e-3 + 7.82e-3) / 2) ** 2, 12)
  })

  it('ignores a variant of Q and Z like one of F and u', () => {
    const withVariants = {
      values: [
        { side: 'chamber', symbol: 'Q', value: 1, variant: 'other' },
        { side: 'chamber', symbol: 'Z', value: 1, variant: 'other' },
        ...cartridge.values,
      ],
    }
    expect(recordLoad({ ...run, cartridge: withVariants })).toEqual(recordLoad(run))
  })

  it('adds the temperature sensitivity of the record', () => {
    expect(recordLoad({ ...run, powder: sensitive }).propellant.temperatureSensitivity).toEqual({
      reference: 294.15,
      cold: 0.002,
      hot: 0.001,
    })
  })

  it('refuses a missing value, a powder without a model and a resistance law without a bullet length', () => {
    const noF = { values: cartridge.values.filter((v) => v.symbol !== 'F' || v.variant) }
    expect(() => recordLoad({ ...run, cartridge: noF })).toThrow(
      expect.objectContaining({ field: 'boreDiameter' }),
    )
    expect(() => recordLoad({ ...run, cartridge: noF })).toThrow(ValueError)
    expect(() => recordLoad({ ...run, powder: {} })).toThrow(InputError)
    expect(() => recordLoad({ ...run, bullet: { mass: 0.01 } })).toThrow(/a bullet length/)
  })
})
