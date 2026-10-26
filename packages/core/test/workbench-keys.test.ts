import { describe, expect, it } from 'vitest'
import { type PowderInteriorRecord, powderModelValues } from '../src/index.ts'

const interior = {
  energy: { value: 3.9e6 },
  gamma: 1.24,
  density: { value: 1.6 },
  covolume: { value: 1e-3 },
  vivacity: { value: 2.5 },
  pressureExponent: 0.8,
  referencePressure: { value: 1000 },
  ignitionPressure: { value: 200 },
  burnForm: { a: { value: 0.1 }, m: 1.2, q: 0.9, z1: 0.7 },
} satisfies NonNullable<PowderInteriorRecord['interior']>

describe('powderModelValues', () => {
  it('gives a record without model parameters no values', () => {
    expect(powderModelValues({})).toBeUndefined()
  })

  it('converts the stored g/cm3 and bar to the workbench SI values', () => {
    const values = powderModelValues({ interior: { ...interior, startPressure: { value: 250 } } })
    expect(values).toMatchObject({
      density: 1600,
      referencePressure: 1e8,
      ignitionPressure: 2e7,
      startPressure: 2.5e7,
      formA: 0.1,
      formM: 1.2,
      formQ: 0.9,
      formZ1: 0.7,
    })
  })

  it('takes the fit rule for the start pressure of a record without one', () => {
    expect(powderModelValues({ interior })?.startPressure).toBe(30e6)
  })
})
