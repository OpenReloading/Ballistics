import { describe, expect, it } from 'vitest'
import {
  close,
  type FieldSpec,
  fieldError,
  fieldOf,
  fieldValueFromText,
  initialFields,
  rangeOf,
  siToStored,
  siValues,
  storedToSi,
  switchFields,
  typedFieldValue,
} from '../src/lib/field-spec.ts'
import { kilogramsPerGrain, presetUnits } from '../src/lib/units.ts'

const metric = presetUnits('metric-grams')
const us = presetUnits('us')
const length: FieldSpec = { key: 'length', label: 'Length', quantity: 'length', min: 1, max: 100 }
const charge: FieldSpec = { key: 'charge', label: 'Charge', quantity: 'charge', initial: 2.5e-3 }

describe('stored units', () => {
  it('converts mm, g, degrees and ratios of the designers to SI and back', () => {
    expect(storedToSi('length', 30)).toBeCloseTo(0.03, 15)
    expect(storedToSi('mass', 10)).toBeCloseTo(0.01, 15)
    expect(storedToSi('angle', 180)).toBeCloseTo(Math.PI, 15)
    expect(storedToSi('ratio', 0.5)).toBe(0.5)
    expect(siToStored('length', 0.03)).toBeCloseTo(30, 12)
    expect(siToStored('mass', 0.01)).toBeCloseTo(10, 12)
  })
})

describe('field values', () => {
  it('shows an SI value rounded in the system, and no text without a value', () => {
    expect(fieldOf(us, length, 0.0254)).toEqual({ text: '1', si: 0.0254 })
    expect(fieldOf(metric, length, undefined)).toEqual({ text: '', si: undefined })
  })

  it('takes values within a relative 1e-9 as the same, and nothing as different', () => {
    expect(close(1 + 0.5e-9, 1)).toBe(true)
    expect(close(1 + 2e-9, 1)).toBe(false)
    expect(close(1 - 2e-9, 1)).toBe(false)
    expect(close(1000 + 0.5e-6, 1000)).toBe(true)
    expect(close(0, 0)).toBe(true)
    expect(close(1e-20, 0)).toBe(false)
    expect(close(1, undefined)).toBe(false)
  })

  it('reads the bounds of a spec as the range of its text', () => {
    expect(rangeOf({ ...length, integer: true })).toEqual({ min: 1, max: 100, integer: true })
  })

  it('reads canonical text, no value for blank or non-finite text', () => {
    expect(fieldValueFromText('length', metric, '25.4').si).toBeCloseTo(0.0254, 15)
    expect(fieldValueFromText('length', metric, '  ')).toEqual({ text: '  ', si: undefined })
    expect(fieldValueFromText('length', metric, 'Infinity').si).toBeUndefined()
    expect(fieldValueFromText('length', metric, 'x').si).toBeUndefined()
  })

  it('reads typed text with either decimal mark, a twist and text that is no number', () => {
    expect(typedFieldValue('length', metric, '25,4')).toEqual({ text: '25.4', si: 0.0254 })
    expect(typedFieldValue('length', metric, ' 2 ')).toEqual({ text: '2', si: 0.002 })
    expect(typedFieldValue('length', metric, 'abc')).toEqual({ text: 'abc', si: undefined })
    expect(typedFieldValue('length', metric, '1,234')).toEqual({ text: '1,234', si: undefined })
    expect(typedFieldValue('length', metric, '1,234', { integer: true }).text).toBe('1234')
    expect(typedFieldValue('twist', us, '1 in 10,5').text).toBe('1 in 10.5')
    expect(typedFieldValue('twist', us, '1 in 10,5').si).toBeCloseTo(10.5 * 0.0254, 15)
    expect(typedFieldValue('twist', us, '1:x')).toEqual({ text: '1:x', si: undefined })
  })
})

describe('field sets', () => {
  it('starts each field from its initial value, empty without one', () => {
    expect(initialFields([length, charge], metric)).toEqual({
      length: { text: '', si: undefined },
      charge: { text: '2.5', si: 2.5e-3 },
    })
    const fields = initialFields([charge], us, () => 'shown')
    expect(fields).toEqual({ charge: { text: 'shown', si: 2.5e-3 } })
  })

  it('rewrites the texts of fields with a value in another system and keeps the others', () => {
    const fields = {
      charge: { text: '2.5', si: 2.5e-3 },
      length: { text: 'abc', si: undefined },
    }
    const switched = switchFields(fields, [length, charge], us)
    expect(switched.charge?.text).toBe(String(Number((2.5e-3 / kilogramsPerGrain).toPrecision(6))))
    expect(switched.charge?.si).toBe(2.5e-3)
    expect(switched.length).toEqual({ text: 'abc', si: undefined })
    expect(switchFields({}, [length], us)).toEqual({})
    expect(fields.charge.text).toBe('2.5')
  })

  it('maps each field to its SI value', () => {
    expect(siValues({ a: { text: '1', si: 0.001 }, b: { text: 'x', si: undefined } })).toEqual({
      a: 0.001,
      b: undefined,
    })
  })
})

describe('fieldError', () => {
  const at = (text: string, spec = length) => fieldValueFromText(spec.quantity, metric, text)
  const open: FieldSpec = { key: 'l', label: 'Length', quantity: 'length' }

  it('asks for a number in a required field only', () => {
    expect(fieldError(length, at(''), metric)).toBeUndefined()
    expect(fieldError(length, undefined, metric)).toBeUndefined()
    expect(fieldError(length, at('  '), metric)).toBeUndefined()
    expect(fieldError({ ...length, required: true }, at(' '), metric)).toBe(
      'Enter a number for Length.',
    )
    expect(fieldError({ ...length, required: true }, undefined, metric)).toBe(
      'Enter a number for Length.',
    )
  })

  it('names text that is no number, and both readings of an ambiguous one', () => {
    expect(fieldError(length, { text: 'abc', si: undefined }, metric)).toBe(
      'Enter a number for Length.',
    )
    expect(fieldError(open, { text: '1,234', si: undefined }, metric)).toBe(
      'Ambiguous: write 1.234 for a decimal or 1234 for a whole number.',
    )
  })

  it('holds the bounds inclusive and names them in the shown unit', () => {
    expect(fieldError(length, at('1'), metric)).toBeUndefined()
    expect(fieldError(length, at('100'), metric)).toBeUndefined()
    expect(fieldError(length, at('0.5'), metric)).toBe('Length must be at least 1 mm.')
    expect(fieldError(length, at('100.5'), metric)).toBe('Length must be at most 100 mm.')
    expect(fieldError(length, at('1e3'), metric)).toBe('Length must be at most 100 mm.')
    expect(fieldError({ ...open, max: 100 }, at('-5', open), metric)).toBeUndefined()
    expect(fieldError(open, at('1e6', open), metric)).toBeUndefined()
  })

  it('refuses 0 where the value must be greater than 0, and a fraction where it must be whole', () => {
    const positive: FieldSpec = { key: 'l', label: 'Length', quantity: 'length', positive: true }
    expect(fieldError(positive, at('0', positive), metric)).toBe(
      'Length must be greater than 0 mm.',
    )
    expect(fieldError(positive, at('0.001', positive), metric)).toBeUndefined()
    expect(fieldError({ ...positive, positive: false }, at('0', positive), metric)).toBeUndefined()
    const count: FieldSpec = { key: 'n', label: 'Shots', quantity: 'ratio', integer: true }
    expect(fieldError(count, at('2.5', count), metric)).toBe('Shots must be a whole number.')
    expect(fieldError(count, at('3', count), metric)).toBeUndefined()
    expect(fieldError({ ...count, integer: false }, at('2.5', count), metric)).toBeUndefined()
  })

  it('leaves the unit out of the message of a quantity without a symbol', () => {
    const ratio: FieldSpec = { key: 'r', label: 'Ratio', quantity: 'ratio', min: 0 }
    expect(fieldError(ratio, at('-1', ratio), metric)).toBe('Ratio must be at least 0.')
  })
})
