import { describe, expect, it } from 'vitest'
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
  inchText,
  kilogramsPerGrain,
  type PresetId,
  parseTwist,
  presetNames,
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
} from '../src/lib/units.ts'

const metric = presetUnits('metric-grams')
const us = presetUnits('us')

describe('unit text', () => {
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

  it('reads a capacity in grains of water at the water density of core', () => {
    expect(unitsOf.capacity.grH2O.toSi(56)).toBeCloseTo(
      waterVolume(56 * kilogramsPerGrain * 1e3),
      15,
    )
  })

  it('turns grams of water into its volume and back', () => {
    // 0.9982 g/cm3: 99.82 g of water fill 100 cm3
    expect(waterVolume(99.82)).toBeCloseTo(100e-6, 15)
    expect(waterGrams(100e-6)).toBeCloseTo(99.82, 10)
    expect(waterGrams(waterVolume(56))).toBeCloseTo(56, 10)
  })
})

describe('presets', () => {
  const ids: PresetId[] = ['metric-grains', 'us', 'metric-grams']

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
    expect(typedTwist(`1:8${' '.repeat(50_000)}x`)).toBeUndefined()
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
