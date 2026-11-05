import { describe, expect, it } from 'vitest'
import {
  localePreset,
  type PresetId,
  parseUnitChoice,
  presetFromLink,
  presetUnitIds,
  presetUnits,
  type Quantity,
  resolveUnits,
  unitsOf,
} from '../src/index.ts'

describe('factors', () => {
  it('converts the exact NIST SP 811 values', () => {
    expect(unitsOf.velocity['ft/s'].toSi(2700)).toBeCloseTo(822.96, 12)
    expect(unitsOf.temperature.degF.toSi(59)).toBeCloseTo(288.15, 12)
    expect(unitsOf.temperature.degF.fromSi(288.15)).toBeCloseTo(59, 12)
    expect(unitsOf.airPressure.inHg.toSi(29.92)).toBeCloseTo(101320.75888, 6)
    expect(unitsOf.range.yd.toSi(100)).toBeCloseTo(91.44, 12)
    expect(unitsOf.pressure.psi.toSi(1)).toBeCloseTo(6894.757293168, 9)
    expect(unitsOf.energy['ft-lbf'].toSi(1)).toBeCloseTo(1.355817948, 9)
  })

  it('reads a capacity in grains of water at 0.9982 g/cm3', () => {
    expect(unitsOf.capacity.grH2O.toSi(56)).toBeCloseTo((56 * 6.479891e-5) / 998.2, 15)
  })

  it('returns every value through toSi and fromSi', () => {
    for (const q of Object.keys(unitsOf) as Quantity[])
      for (const unit of Object.values(unitsOf[q])) {
        const x = 123.456
        expect(Math.abs(unit.fromSi(unit.toSi(x)) - x) / x).toBeLessThan(1e-12)
      }
  })
})

/** The unit symbol of each quantity in the presets metric with grains, US and SI. */
const table: [Quantity, string, string, string][] = [
  ['charge', 'gr', 'gr', 'g'],
  ['mass', 'gr', 'gr', 'g'],
  ['length', 'mm', 'in', 'mm'],
  // twist: 1:10 in in common metric use, 254 mm in SI
  ['twist', 'in', 'in', 'mm'],
  // barrel length: 24 in in common metric use, 610 mm in SI
  ['barrelLength', 'in', 'in', 'mm'],
  ['capacity', 'gr H₂O', 'gr H₂O', 'cm³'],
  ['velocity', 'm/s', 'ft/s', 'm/s'],
  ['pressure', 'bar', 'psi', 'bar'],
  ['energy', 'J', 'ft·lbf', 'J'],
  ['temperature', '°C', '°F', '°C'],
  ['range', 'm', 'yd', 'm'],
  ['lineOfSightOffset', 'cm', 'in', 'mm'],
  ['windSpeed', 'm/s', 'mph', 'm/s'],
  ['altitude', 'm', 'ft', 'm'],
  ['airPressure', 'hPa', 'inHg', 'hPa'],
  ['correction', 'mrad', 'MOA', 'mrad'],
  ['firearmMass', 'kg', 'lb', 'kg'],
  // not in the preset table: lb/in² in the grain presets, kg/m² in SI
  ['sectionalDensity', 'lb/in²', 'lb/in²', 'kg/m²'],
]
const ids: PresetId[] = ['metric-grains', 'us', 'metric-grams']

describe('presets', () => {
  it('shows the units of the preset table', () => {
    for (const [q, ...symbols] of table)
      expect(
        ids.map((p) => presetUnits(p)[q].symbol),
        q,
      ).toEqual(symbols)
  })

  it('has a unit for every quantity in every preset', () => {
    for (const p of ids) expect(Object.keys(presetUnits(p))).toEqual(Object.keys(unitsOf))
  })

  it('applies an override to its quantity only', () => {
    const units = resolveUnits({ preset: 'metric-grams', overrides: { mass: 'gr' } })
    expect(units.mass.symbol).toBe('gr')
    expect(units.charge.symbol).toBe('g')
    expect(units.length.symbol).toBe('mm')
  })

  it('gives a temperature difference the unit of the temperature', () => {
    const units = resolveUnits({
      preset: 'metric-grams',
      overrides: { temperature: 'degF', temperatureDifference: 'degC' },
    })
    expect(units.temperatureDifference).toBe(unitsOf.temperatureDifference.degF)
  })

  it("keeps the preset's unit for an override its quantity has not", () => {
    const units = resolveUnits({ preset: 'us', overrides: { mass: 'kg' } })
    expect(units.mass).toBe(unitsOf.mass.gr)
  })

  it('maps old links and locales', () => {
    expect(presetFromLink('metric')).toBe('metric-grams')
    expect(presetFromLink('imperial')).toBe('us')
    expect(presetFromLink('metric-grains')).toBe('metric-grains')
    expect(presetFromLink('x')).toBeUndefined()
    expect(presetFromLink(null)).toBeUndefined()
    expect(localePreset('en-US')).toBe('us')
    expect(localePreset('de-DE')).toBe('metric-grains')
    expect(localePreset('en')).toBe('metric-grains')
    expect(Object.keys(presetUnitIds)).toEqual(ids)
  })
})

describe('a stored choice', () => {
  it('drops a malformed or unknown stored choice', () => {
    expect(parseUnitChoice(null)).toBeUndefined()
    expect(parseUnitChoice('{')).toBeUndefined()
    expect(parseUnitChoice('"us"')).toBeUndefined()
    expect(parseUnitChoice('{}')).toBeUndefined()
    expect(parseUnitChoice('{"preset":"toString"}')).toBeUndefined()
    expect(
      parseUnitChoice(
        '{"preset":"metric-grams","overrides":{"mass":"gr","charge":"g","drop":"km","toString":"x","length":1}}',
      ),
    ).toEqual({ preset: 'metric-grams', overrides: { mass: 'gr' } })
    expect(parseUnitChoice('{"preset":"us"}')).toEqual({ preset: 'us', overrides: {} })
  })

  it('drops a stored choice that is null, a preset that is no string and overrides of no object', () => {
    expect(parseUnitChoice('null')).toBeUndefined()
    expect(parseUnitChoice('{"preset":["us"]}')).toBeUndefined()
    expect(parseUnitChoice('{"preset":"us","overrides":null}')).toEqual({
      preset: 'us',
      overrides: {},
    })
    expect(parseUnitChoice('{"preset":"us","overrides":{"length":["mm"]}}')).toEqual({
      preset: 'us',
      overrides: {},
    })
    expect(parseUnitChoice('{"preset":"us","overrides":{"speed":"mph"}}')).toEqual({
      preset: 'us',
      overrides: {},
    })
    expect(parseUnitChoice('{"preset":"us","overrides":{"length":"furlong"}}')).toEqual({
      preset: 'us',
      overrides: {},
    })
  })
})
