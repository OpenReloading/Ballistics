import { interiorValueKeys } from '@open-reloading/core'
import { expect, it } from 'vitest'
import { english } from '../src/i18n/translate.ts'
import { fieldError, fieldValueFromText } from '../src/lib/field-spec.ts'
import { burnFormError, interiorBody, interiorFields } from '../src/lib/interior-input.ts'
import { presetUnits } from '../src/lib/units.ts'

/** A synthetic load typed in metric display units; the numbers are made up. */
const text: Record<string, string> = {
  volume: '3.4',
  boreDiameter: '6.91',
  travel: '600',
  twist: '0',
  bulletMass: '9.5',
  charge: '2.8',
  propellantEnergy: '3.9',
  gamma: '1.23',
  density: '1.6',
  covolume: '0.625',
  vivacity: '0.64',
  exponent: '1',
  referencePressure: '0.980665',
  propellantTemperature: '21',
  ignitionPressure: '10',
  startPressure: '0',
}

const values = Object.fromEntries(
  interiorFields.map((f) => [
    f.key,
    fieldValueFromText(f.quantity, presetUnits('metric-grams'), text[f.key] ?? '').si,
  ]),
)

it('converts the display units to SI', () => {
  const { load } = interiorBody(values)
  expect(load.chamber.volume).toBeCloseTo(3.4e-6, 15)
  expect(load.barrel.length).toBeCloseTo(0.6, 12)
  expect(load.charge).toBeCloseTo(2.8e-3, 12)
  expect(load.propellant.specificEnergy).toBeCloseTo(3.9e6, 6)
  expect(load.propellant.density).toBeCloseTo(1600, 9)
  expect(load.propellant.covolume).toBeCloseTo(6.25e-4, 12)
  expect(load.propellant.burn).toEqual({
    kind: 'vivacity',
    vivacity: 0.64,
    exponent: 1,
    referencePressure: 98066.5,
    form: { kind: 'constant' },
  })
  expect(load.propellantTemperature).toBeCloseTo(294.15, 9)
  expect(load.ignitionPressure).toBeCloseTo(1e6, 6)
})

it('defaults the bore area to the circle of the bore diameter and keeps a given one', () => {
  const d = 6.91e-3
  expect(interiorBody(values).load.chamber.boreArea).toBeCloseTo((Math.PI * d ** 2) / 4, 15)
  expect(interiorBody({ ...values, boreArea: 3.75e-5 }).load.chamber.boreArea).toBe(3.75e-5)
})

it('adds the cartridge only when one is chosen', () => {
  expect(interiorBody(values)).not.toHaveProperty('cartridge')
  expect(interiorBody(values, '').model).toBe('m3')
  expect(interiorBody(values, '').cartridge).toBeUndefined()
  expect(interiorBody(values, '308-win').cartridge).toBe('308-win')
})

it('names a missing field', () => {
  expect(() => interiorBody({ ...values, charge: undefined })).toThrow('Charge mass')
})

it('sends the two-stage form when a, m, q and z1 are set, the constant form when none is', () => {
  const form = { formA: 0.8, formM: 0.5, formQ: 0.5, formZ1: 0.8 }
  expect(interiorBody({ ...values, ...form }).load.propellant.burn).toMatchObject({
    form: { kind: 'twoStage', a: 0.8, m: 0.5, q: 0.5, z1: 0.8 },
  })
  expect(interiorBody(values).load.propellant.burn).toMatchObject({ form: { kind: 'constant' } })
  expect(() => interiorBody({ ...values, formA: 0.8 })).toThrow('m, q, z1')
})

it('flags the empty burn form fields of a partly filled form', () => {
  expect(burnFormError({ formA: 0 }, 'formM', english.t)).toMatch(/burn form/)
  expect(burnFormError({ formA: 0 }, 'formA', english.t)).toBeUndefined()
  expect(burnFormError({}, 'formM', english.t)).toBeUndefined()
  expect(
    burnFormError({ formA: 0, formM: 1, formQ: 0, formZ1: 1 }, 'formM', english.t),
  ).toBeUndefined()
})

it('has the fields core reads for a load file (POST /interior/load-file)', () => {
  expect(interiorFields.map((f) => f.key)).toEqual([...interiorValueKeys])
})

it('refuses an engraving length of 0 or below and a negative leak area, bore friction and engraving pressure', () => {
  const system = presetUnits('metric-grains')
  const error = (key: string, text: string) => {
    const spec = interiorFields.find((f) => f.key === key)
    if (!spec) throw new Error(key)
    return fieldError(spec, fieldValueFromText(spec.quantity, system, text), system)
  }
  expect(error('engravingLength', '0')).toBe('Engraving length must be greater than 0 mm.')
  expect(error('engravingLength', '-1')).toMatch(/at least 0/)
  expect(error('engravingLength', '0.5')).toBeUndefined()
  for (const key of ['leakArea', 'boreFriction', 'engravingPressure']) {
    expect(error(key, '-1'), key).toMatch(/must be at least 0/)
    expect(error(key, '0'), key).toBeUndefined()
  }
})
