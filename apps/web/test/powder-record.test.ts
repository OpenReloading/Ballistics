import { powderModelValues, recordResistance } from '@open-reloading/core'
import type { Powder } from '@open-reloading/schema'
import { expect, it } from 'vitest'
import {
  fitTables,
  fittedEnergyRatio,
  recordMark,
  unchangedFromRecord,
} from '../src/lib/powder-record.ts'
import { defined } from './defined.ts'

/** A synthetic fitted record in stored units; the numbers are made up. */
const interior = {
  model: 'm3',
  fitted: ['vivacity', 'energy'],
  vivacity: { value: 0.5, standardUncertainty: 0.02 },
  energy: { value: 4e6, standardUncertainty: 1e5 },
  gamma: 1.24,
  covolume: { value: 0.001 },
  density: { value: 1.6 },
  pressureExponent: 1,
  referencePressure: { value: 0.980665 },
  ignitionPressure: { value: 50 },
  propellantTemperature: { value: 21 },
  resistance: { stress: { value: 4.2 }, oversize: 1.3, engraving: 0.89 },
  burnForm: { kind: 'twoStage', a: { value: 0.8 }, m: 0.5, q: 0.5, z1: 0.8 },
  trainingRows: 30,
  trainingCartridges: 4,
} as const
const powder = {
  id: 'x',
  manufacturer: 'example',
  name: 'P1',
  interior,
  provenance: {
    kind: 'published',
    sources: [
      { title: 'Manufacturer product page', fields: ['name'] },
      {
        title: 'Example A manual 2025, rifle and pistol tables',
        kind: 'fitted',
        fields: ['interior'],
        note: '12 training rows of this table (hold-out by cartridge); effective model parameters.',
      },
      { title: 'Example B guide 8.0', kind: 'fitted', fields: ['interior'] },
    ],
  },
} as unknown as Powder

it('gives the model fields in SI, the start pressure by the rule of the fit', () => {
  expect(powderModelValues(powder)).toEqual({
    propellantEnergy: 4e6,
    gamma: 1.24,
    density: 1600,
    covolume: 0.001,
    vivacity: 0.5,
    exponent: 1,
    referencePressure: 98066.5,
    ignitionPressure: 5e6,
    startPressure: 30e6,
    formA: 0.8,
    formM: 0.5,
    formQ: 0.5,
    formZ1: 0.8,
  })
  const own = { ...powder, interior: { ...interior, startPressure: { value: 250 } } }
  expect(powderModelValues(own as unknown as Powder)?.startPressure).toBe(25e6)
  expect(powderModelValues({ ...powder, interior: undefined })).toBeUndefined()
})

it('marks a field from the record, fitted or a fixed input, and an edit after the fill', () => {
  const origin = powderModelValues(powder) ?? {}
  const shown = (si: number) => `${si} u`
  expect(recordMark(powder, origin, 'vivacity', 0.5, shown)).toBe('From the record (fitted).')
  expect(recordMark(powder, origin, 'gamma', 1.24, shown)).toBe(
    'From the record (input of the fit).',
  )
  expect(recordMark(powder, origin, 'vivacity', 0.6, shown)).toBe(
    'Changed from the record value 0.5 u.',
  )
  expect(recordMark(powder, origin, 'vivacity', undefined, shown)).toBe(
    'Changed from the record value 0.5 u.',
  )
  expect(recordMark(powder, origin, 'charge', 0.002, shown)).toBeUndefined()
})

it('applies the bore resistance of the record from the cartridge, bullet length and run', () => {
  const run = { boreDiameter: 7.62e-3, boreArea: 47.51e-6, startPressure: 30e6 }
  const r = recordResistance(powder, {
    ...run,
    cartridge: { g1: 7.85, z: 7.82 },
    bulletLengthMm: 30,
  })
  const o = (100 * 0.03) / 7.82
  expect(r.missing).toEqual([])
  expect(r.resistance?.friction).toBeCloseTo(
    ((0.42e6 * Math.PI * 7.85 * 30) / 47.51) * (1 + 1.3 * o),
    3,
  )
  expect(defined(r.resistance?.engraving?.[0]).pressure).toBeCloseTo(0.89 * 30e6, 3)
  // no G1: the bore diameter, as the fit
  const noG1 = recordResistance(powder, { ...run, cartridge: {}, bulletLengthMm: 30 })
  expect(noG1.resistance?.friction).toBeCloseTo((0.42e6 * Math.PI * 7.62 * 30) / 47.51, 3)
  expect(recordResistance(powder, run).missing).toEqual(['a cartridge record', 'a bullet length'])
  expect(recordResistance({ ...powder, interior: undefined }, run)).toEqual({ missing: [] })
})

it("marks a start pressure the record does not hold as the fit's rule", () => {
  const origin = powderModelValues(powder) ?? {}
  expect(recordMark(powder, origin, 'startPressure', 30e6, String)).toBe(
    "From the fit's start pressure rule for barrels of 300 mm and longer.",
  )
})

it('lists the fitted tables with their training rows', () => {
  expect(fitTables(powder).map((t) => t.trainingRows)).toEqual([12, undefined])
})

it("gives one fitted table the record's own rows and cartridges", () => {
  const one = {
    ...powder,
    provenance: {
      kind: 'fitted' as const,
      sources: [{ title: 'Table A', kind: 'fitted' as const }],
    },
  }
  expect(fitTables(one)).toEqual([{ title: 'Table A', trainingRows: 30, trainingCartridges: 4 }])
})

it('gives the fitted over the thermochemistry energy, none without thermochemistry', () => {
  const t = { value: 0, min: 0, max: 0 }
  const withThermo = {
    ...powder,
    thermochemistry: {
      loadingDensity: { value: 0 },
      flameTemperature: t,
      impetus: { value: 1.0e6, min: 0, max: 0 },
      gamma: { value: 1.25, min: 0, max: 0 },
      molarMass: t,
      covolume: t,
    },
  } as unknown as Powder
  // energy of the thermochemistry 1e6 / 0.25 = 4e6 J/kg
  const fitted = withThermo.interior?.energy.value ?? 0
  expect(fittedEnergyRatio(withThermo)).toBeCloseTo(fitted / 4e6, 12)
  expect(fittedEnergyRatio({ ...powder, thermochemistry: undefined })).toBeUndefined()
})

it('lists the fields still holding the previous record value, not the ones edited since', () => {
  const origin = { vivacity: 0.605, energy: 3.6e6, gamma: 1.24 }
  expect(unchangedFromRecord(origin, { vivacity: 0.605, energy: 3.7e6, gamma: undefined })).toEqual(
    ['vivacity'],
  )
  expect(unchangedFromRecord(origin, { ...origin })).toEqual(['vivacity', 'energy', 'gamma'])
})
