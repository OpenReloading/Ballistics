import { describe, expect, it } from 'vitest'
import { formatNumber } from '../src/i18n/number.ts'
import { setShownLanguage } from '../src/i18n/shown.ts'
import { fieldError, fieldValueFromText, switchFields } from '../src/lib/field-spec.ts'
import { interiorFields } from '../src/lib/interior-input.ts'
import { shotFields } from '../src/lib/trajectory-input.ts'
import {
  degreeText,
  drawingLengthUnit,
  exactFieldText,
  fixedFieldText,
  footPound,
  formatQuantity,
  inchText,
  kilogramsPerGrain,
  localePreset,
  msText,
  type PresetId,
  parseTwist,
  parseUnitChoice,
  pascalsPerInHg,
  percentText,
  presetFromLink,
  presetNames,
  presetUnitIds,
  presetUnits,
  psi,
  type Quantity,
  resolveUnits,
  roundedFieldText,
  twistTyped,
  typedTwist,
  unitsOf,
  waterGrams,
  waterVolume,
  withUnit,
} from '../src/lib/units.ts'

const metric = presetUnits('metric-grams')
const us = presetUnits('us')

describe('formatQuantity', () => {
  it('prints fixed decimals without a negative zero or grouping', () => {
    expect(formatQuantity('lineOfSightOffset', presetUnits('metric-grains'), -1e-7)).toBe('0.0')
    expect(formatQuantity('length', us, 51.18e-3)).toBe('2.0150')
    expect(formatNumber(4150, 0)).toBe('4150')
    expect(formatQuantity('pressure', us, 4150e5)).toBe('60191')
  })

  it('drops the zero before the point of inch values below 1 only', () => {
    expect(formatQuantity('length', us, 0.308 * 0.0254)).toBe('.3080')
    expect(formatQuantity('length', us, 1.2 * 0.0254)).toBe('1.2000')
    expect(formatQuantity('lineOfSightOffset', us, -0.31 * 0.0254)).toBe('-.3')
    expect(formatQuantity('lineOfSightOffset', us, -1e-7)).toBe('0')
    expect(formatQuantity('lineOfSightOffset', us, 0)).toBe('0')
    expect(inchText('0.00', 'in')).toBe('0')
    expect(inchText('0.0', 'mm')).toBe('0.0')
    expect(formatQuantity('length', metric, 0.5e-3)).toBe('0.50')
    expect(formatQuantity('correction', us, 0.5 * unitsOf.correction.MOA.toSi(1))).toBe('0.50')
    expect(
      formatQuantity(
        'ballisticCoefficient',
        us,
        unitsOf.ballisticCoefficient['lb/in2'].toSi(0.264),
      ),
    ).toBe('0.264')
    expect(formatQuantity('area', us, 0.5 * 0.0254 ** 2)).toBe('0.50000')
    expect(formatQuantity('barrelLength', presetUnits('metric-grains'), 0.6096)).toBe('24.00')
    expect(formatQuantity('barrelLength', metric, 0.6096)).toBe('610')
    expect(inchText('-0.25', 'in')).toBe('-.25')
    expect(inchText('0.25', 'mm')).toBe('0.25')
    expect(inchText('10.25', 'in')).toBe('10.25')
    expect(inchText('10.00', 'in')).toBe('10.00')
  })

  it('keeps the zero before a comma, which German writes', () => {
    setShownLanguage('de')
    try {
      expect(inchText('0,25', 'in')).toBe('0,25')
      expect(inchText('0,00', 'in')).toBe('0')
      expect(inchText('0.25', 'in')).toBe('0.25')
    } finally {
      setShownLanguage('en')
    }
  })

  it('prints times, fractions and values with their unit', () => {
    expect(msText(0.0012345)).toBe('1.235 ms')
    expect(percentText(0.125)).toBe('12.5 %')
    expect(withUnit('velocity', us, 822.96)).toBe('2700 ft/s')
    expect(withUnit('length', metric, 0.5e-3)).toBe('0.50 mm')
  })

  it('labels the drawings in the length unit of the system', () => {
    expect(drawingLengthUnit(us)).toBe('in')
    expect(drawingLengthUnit(metric)).toBe('mm')
    expect(drawingLengthUnit(presetUnits('metric-grains'))).toBe('mm')
  })
})

describe('factors', () => {
  it('derives psi and ft lbf from the pound and standard gravity', () => {
    expect(psi).toBe((0.45359237 * 9.80665) / 0.0254 ** 2)
    expect(psi).toBeCloseTo(6894.757293168, 9)
    expect(footPound).toBeCloseTo(1.355817948, 9)
  })

  it('converts the exact NIST SP 811 values', () => {
    expect(unitsOf.velocity['ft/s'].toSi(2700)).toBeCloseTo(822.96, 12)
    expect(unitsOf.temperature.degF.toSi(59)).toBeCloseTo(288.15, 12)
    expect(unitsOf.airPressure.inHg.toSi(29.92)).toBeCloseTo(29.92 * pascalsPerInHg, 9)
    expect(29.92 * pascalsPerInHg).toBeCloseTo(101320.75888, 6)
    expect(unitsOf.range.yd.toSi(100)).toBeCloseTo(91.44, 12)
  })

  it('reads a capacity in grains of water at 0.9982 g/cm3', () => {
    expect(unitsOf.capacity.grH2O.toSi(56)).toBeCloseTo((56 * kilogramsPerGrain) / 998.2, 15)
  })

  it('turns grams of water into its volume and back', () => {
    // 0.9982 g/cm3: 99.82 g of water fill 100 cm3
    expect(waterVolume(99.82)).toBeCloseTo(100e-6, 15)
    expect(waterGrams(100e-6)).toBeCloseTo(99.82, 10)
    expect(waterGrams(waterVolume(56))).toBeCloseTo(56, 10)
  })

  it('returns every value through toSi and fromSi', () => {
    for (const q of Object.keys(unitsOf) as Quantity[])
      for (const unit of Object.values(unitsOf[q])) {
        const x = 123.456
        expect(Math.abs(unit.fromSi(unit.toSi(x)) - x) / x).toBeLessThan(1e-12)
      }
  })
})

describe('presets', () => {
  // the preset table
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

  it('shows the units of the preset table', () => {
    for (const [q, ...symbols] of table)
      expect(
        ids.map((p) => presetUnits(p)[q].symbol),
        q,
      ).toEqual(symbols)
  })

  it('round-trips every quantity of every preset without drift', () => {
    for (const p of ids)
      for (const q of Object.keys(unitsOf) as Quantity[]) {
        const units = presetUnits(p)
        const si = units[q].toSi(123.456)
        const text = exactFieldText(q, units, si)
        expect(fieldValueFromText(q, units, text).si, `${p} ${q}`).toBe(si)
        for (const other of ids) {
          const there = fieldValueFromText(
            q,
            presetUnits(other),
            exactFieldText(q, presetUnits(other), si),
          ).si
          expect(exactFieldText(q, units, there ?? Number.NaN), `${p} ${other} ${q}`).toBe(text)
        }
      }
  })

  it('applies an override to its quantity only', () => {
    const units = resolveUnits({ preset: 'metric-grams', overrides: { mass: 'gr' } })
    expect(units.mass.symbol).toBe('gr')
    expect(units.charge.symbol).toBe('g')
    expect(units.length.symbol).toBe('mm')
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

  it('drops a malformed or unknown stored choice', () => {
    expect(parseUnitChoice(null)).toBeUndefined()
    expect(parseUnitChoice('{')).toBeUndefined()
    expect(parseUnitChoice('"us"')).toBeUndefined()
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
  })

  it('names the presets', () => {
    expect(presetNames).toEqual({
      'metric-grains': 'Metric, common use',
      us: 'US customary',
      'metric-grams': 'Metric (SI)',
    })
  })
})

describe('fieldText', () => {
  it('switches units back and forth from the SI value without drift', () => {
    const si = metric.velocity.toSi(790)
    expect(exactFieldText('velocity', us, si)).toBe('2591.86')
    expect(exactFieldText('velocity', metric, si)).toBe('790')
  })
})

it('prints stored degrees to 4 decimals without trailing zeros', () => {
  expect(degreeText(71.43305555555555)).toBe('71.4331')
  expect(degreeText(0.2833333333333333)).toBe('0.2833')
  expect(degreeText(45)).toBe('45')
})

describe('shownText', () => {
  const metric = presetUnits('metric-grains')
  it('rounds to the display decimals with three significant digits, no trailing zeros', () => {
    expect(roundedFieldText('charge', metric, 2.48e-3)).toBe('38.3')
    expect(roundedFieldText('mass', metric, 168 * kilogramsPerGrain)).toBe('168')
    expect(roundedFieldText('ratio', metric, 0.0004)).toBe('0.0004')
    expect(roundedFieldText('velocity', presetUnits('us'), metric.velocity.toSi(790))).toBe('2592')
    expect(roundedFieldText('pressure', metric, 0)).toBe('0')
  })

  it('keeps the trailing zeros in the workbench, so the values align by their decimals', () => {
    const us = presetUnits('us')
    expect(fixedFieldText('charge', metric, 2.48e-3)).toBe('38.3')
    expect(fixedFieldText('mass', metric, 168 * kilogramsPerGrain)).toBe('168.0')
    expect(fixedFieldText('length', us, 2.8 * 0.0254)).toBe('2.8000')
    expect(fixedFieldText('twist', us, 12 * 0.0254)).toBe(
      roundedFieldText('twist', us, 12 * 0.0254),
    )
    expect(fixedFieldText('pressure', metric, 0)).toBe('0')
  })
})

describe('a field over a unit switch', () => {
  const spec = (specs: readonly { key: string }[], key: string) => {
    const s = specs.find((f) => f.key === key)
    if (!s) throw new Error(key)
    return s as Parameters<typeof fieldError>[0]
  }
  const step = spec(shotFields, 'rangeStep')
  const velocity = spec(shotFields, 'muzzleVelocity')
  const mass = spec(interiorFields, 'bulletMass')
  /** The field text after a switch from `from` to `to`, as the calculators show it. */
  const switched = (s: typeof mass, from: typeof us, to: typeof us, text: string) =>
    switchFields(
      { [s.key]: fieldValueFromText(s.quantity, from, text) },
      [s],
      to,
      roundedFieldText,
    )[s.key]

  it('names the bound in the shown unit', () => {
    expect(fieldError(step, fieldValueFromText('range', metric, '0.5'), metric)).toBe(
      'Range step must be at least 1 m.',
    )
    expect(fieldError(step, fieldValueFromText('range', us, '0.5'), us)).toBe(
      'Range step must be at least 1 yd.',
    )
  })

  it('keeps the sign of a value below its bound and its error', () => {
    const grams = fieldValueFromText('mass', metric, '-1')
    expect(fieldError(mass, grams, metric)).toBe('Bullet mass must be at least 0 g.')
    const grains = switched(mass, metric, us, '-1')
    expect(grains?.text).toBe('-15.4')
    expect(fieldError(mass, grains, us)).toBe('Bullet mass must be at least 0 gr.')
    const fps = switched(velocity, metric, us, '-1')
    expect(fps?.text).toBe('-3.28')
    expect(fieldError(velocity, fps, us)).toBe('Muzzle velocity must be at least 0 ft/s.')
  })

  it('converts the values the e2e flows type', () => {
    expect(switched(mass, metric, us, '9.5')?.text).toBe('146.6')
    expect(roundedFieldText('velocity', us, 792.48)).toBe('2600')
  })

  it('switches a typed 790 m/s to 2592 ft/s and back to 790 without drift', () => {
    const fps = switchFields(
      { [velocity.key]: fieldValueFromText('velocity', metric, '790') },
      [velocity],
      us,
      roundedFieldText,
    )
    expect(fps[velocity.key]?.text).toBe('2592')
    expect(switchFields(fps, [velocity], metric, roundedFieldText)[velocity.key]?.text).toBe('790')
  })
})

describe('a twist as 1:N', () => {
  const inches = resolveUnits({ preset: 'metric-grams', overrides: { twist: 'in' } })
  const mm = resolveUnits({ preset: 'metric-grams', overrides: { twist: 'mm' } })
  const twist = interiorFields.find((f) => f.key === 'twist') as Parameters<typeof fieldError>[0]

  it('reads 1:8, 1 in 8 and a plain 8 as one turn per 8 units', () => {
    for (const text of ['1:8', '1 : 8', ' 1:8 ', '1 in 8', '1in8', '1 IN 8', '8'])
      expect(parseTwist(text), text).toBe(8)
    expect(parseTwist('1:8.5')).toBe(8.5)
    expect(parseTwist('1:.5')).toBe(0.5)
    expect(parseTwist('0')).toBe(0)
  })

  it('refuses text that is no twist', () => {
    for (const text of [
      '',
      ' ',
      'x',
      '1:',
      ':8',
      '2:8',
      '1:8:2',
      '1 8',
      '8 in',
      '1:x',
      '1,5',
      '1:8mm',
    ])
      expect(parseTwist(text), text).toBeUndefined()
  })

  it('rejects a long typed twist that is no number in linear time', () => {
    const start = performance.now()
    expect(typedTwist(`1:8${' '.repeat(50_000)}x`)).toBeUndefined()
    expect(performance.now() - start).toBeLessThan(500)
    expect(typedTwist(' 1 in 8,5 ')).toBe(' 1 in 8.5')
  })

  it('keeps the lead of a typed twist with or without spaces', () => {
    expect(typedTwist('1:8,5')).toBe('1:8.5')
    expect(typedTwist('1in8')).toBe('1in8')
    expect(typedTwist('8')).toBe('8')
    expect(typedTwist('1:x')).toBeUndefined()
    expect(parseTwist('.25')).toBe(0.25)
    expect(parseTwist('1:.75')).toBe(0.75)
  })

  it('stores a length per turn in SI from the field unit', () => {
    expect(fieldValueFromText('twist', inches, '1:12').si).toBeCloseTo(0.3048, 12)
    expect(fieldValueFromText('twist', inches, '12').si).toBeCloseTo(0.3048, 12)
    expect(fieldValueFromText('twist', inches, '1 in 12').si).toBeCloseTo(0.3048, 12)
    expect(fieldValueFromText('twist', mm, '1:254').si).toBeCloseTo(0.254, 12)
    expect(fieldValueFromText('twist', mm, '1:x')).toEqual({ text: '1:x', si: undefined })
    expect(fieldValueFromText('twist', mm, '')).toEqual({ text: '', si: undefined })
  })

  it('shows the text as 1:N, 0 as 0', () => {
    expect(twistTyped('8')).toBe('1:8')
    expect(twistTyped('1 in 8.50')).toBe('1:8.5')
    expect(twistTyped('0')).toBe('0')
    expect(twistTyped('1:0')).toBe('0')
    expect(twistTyped('1:x')).toBeUndefined()
    expect(roundedFieldText('twist', inches, 0.3048)).toBe('1:12')
    expect(exactFieldText('twist', mm, 0.254)).toBe('1:254')
    expect(roundedFieldText('twist', mm, 0)).toBe('0')
  })

  it('converts the text with the unit: 1:12 in is 1:305 mm and back', () => {
    const inch = fieldValueFromText('twist', inches, '1:12')
    const millimetres = switchFields({ twist: inch }, [twist], mm, roundedFieldText).twist
    expect(millimetres?.text).toBe('1:305')
    expect(millimetres?.si).toBe(inch.si)
    const back = switchFields(
      { twist: millimetres as typeof inch },
      [twist],
      inches,
      roundedFieldText,
    )
    expect(back.twist?.text).toBe('1:12')
  })

  it('names the field error for text that is no twist, and the bound for a negative one', () => {
    expect(fieldError(twist, fieldValueFromText('twist', inches, '1:x'), inches)).toBe(
      'Enter a twist as 1:8 or 8.',
    )
    expect(fieldError(twist, fieldValueFromText('twist', inches, '1:'), inches)).toBe(
      'Enter a twist as 1:8 or 8.',
    )
    expect(fieldError(twist, fieldValueFromText('twist', inches, ''), inches)).toBe(
      'Enter a number for Twist.',
    )
    expect(fieldError(twist, fieldValueFromText('twist', inches, '1:-8'), inches)).toBe(
      'Twist must be at least 0 in.',
    )
    expect(fieldError(twist, fieldValueFromText('twist', inches, '1:8'), inches)).toBeUndefined()
    expect(fieldError(twist, fieldValueFromText('twist', inches, '0'), inches)).toBeUndefined()
  })
})
