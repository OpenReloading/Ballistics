import { describe, expect, it } from 'vitest'
import {
  ambiguousMessage,
  fixedNumber,
  formatNumber,
  type ParsedNumber,
  parseNumber,
} from '../src/i18n/number.ts'
import { setShownLanguage } from '../src/i18n/shown.ts'
import { fieldError, fieldValueFromText, rangeOf, typedFieldValue } from '../src/lib/field-spec.ts'
import { exactFieldText, presetUnits, roundedFieldText } from '../src/lib/units.ts'

/** The value of a parse that read a number, else its kind. */
const read = (text: string, language: string, range = {}) => {
  const p = parseNumber(text, range, language)
  return p.kind === 'number' ? p.value : p.kind
}

describe('the decimal mark', () => {
  it('follows the language shown by default', () => {
    setShownLanguage('de')
    try {
      expect(formatNumber(1.5, 1)).toBe('1,5')
      expect(fixedNumber(1.5, 2)).toBe('1,50')
    } finally {
      setShownLanguage('en')
    }
    expect(formatNumber(1.5, 1)).toBe('1.5')
  })
})

describe('reading typed numbers', () => {
  it('rejects long text that is no number in linear time', () => {
    const start = performance.now()
    expect(parseNumber(`${'1'.repeat(50_000)}x`).kind).toBe('invalid')
    expect(parseNumber('.,'.repeat(25_000)).kind).toBe('invalid')
    expect(performance.now() - start).toBeLessThan(500)
  })

  it.each(['en', 'de'])('reads either mark in %s', (language) => {
    expect(read('1.5', language)).toBe(1.5)
    expect(read('1,5', language)).toBe(1.5)
    expect(read('0,308', language)).toBe(0.308)
    expect(read('0.308', language)).toBe(0.308)
    expect(read('12', language)).toBe(12)
  })

  it.each(['en', 'de'])('reads a leading and a trailing mark in %s', (language) => {
    expect(read(',5', language)).toBe(0.5)
    expect(read('.5', language)).toBe(0.5)
    expect(read('1,', language)).toBe(1)
    expect(read('1.', language)).toBe(1)
    expect(read('-,5', language)).toBe(-0.5)
    expect(read('.', language)).toBe('invalid')
    expect(read(',', language)).toBe('invalid')
  })

  it.each(['en', 'de'])('reads signs in %s', (language) => {
    expect(read('-1,5', language)).toBe(-1.5)
    expect(read('+1.5', language)).toBe(1.5)
    expect(read('−1,5', language)).toBe(-1.5)
    expect(read('-', language)).toBe('invalid')
  })

  it.each(['en', 'de'])('reads an exponent in %s', (language) => {
    expect(read('1e-3', language)).toBe(0.001)
    expect(read('1,5E3', language)).toBe(1500)
    expect(read('1.5e+3', language)).toBe(1500)
    expect(read('1e', language)).toBe('invalid')
    expect(read('e5', language)).toBe('invalid')
    expect(read('1e999999', language)).toBe('invalid')
  })

  it.each(['en', 'de'])('is empty for no text and invalid for anything else in %s', (language) => {
    expect(read('', language)).toBe('empty')
    expect(read('   ', language)).toBe('empty')
    expect(read('abc', language)).toBe('invalid')
    // a unit is the field's own
    expect(read('5 gr', language)).toBe('invalid')
    expect(read('5gr', language)).toBe('invalid')
    // a space or an apostrophe is no grouping
    expect(read('1 234', language)).toBe('invalid')
    expect(read("1'234", language)).toBe('invalid')
    expect(read('0x10', language)).toBe('invalid')
    expect(read('Infinity', language)).toBe('invalid')
    expect(read('1,5,', language)).toBe('invalid')
  })

  it.each(['en', 'de'])('reads the last mark as the decimal mark of both in %s', (language) => {
    expect(read('1.234,5', language)).toBe(1234.5)
    expect(read('1,234.5', language)).toBe(1234.5)
    expect(read('1.234.567,25', language)).toBe(1234567.25)
    expect(read('12,345,678.9', language)).toBe(12345678.9)
    expect(read('1,234.', language)).toBe(1234)
    // the other mark groups in threes or the text is no number
    expect(read('1.23,5', language)).toBe('invalid')
    expect(read('1,2.5', language)).toBe('invalid')
    expect(read('1,234.5.6', language)).toBe('invalid')
    expect(read('1.234,567,8', language)).toBe('invalid')
    expect(read('1234,567.8', language)).toBe('invalid')
  })

  it('groups only with the mark that is not the language own', () => {
    expect(read('1,234,567', 'en')).toBe(1234567)
    expect(read('1.234.567', 'de')).toBe(1234567)
    expect(read('1.234.567', 'en')).toBe('invalid')
    expect(read('1,234,567', 'de')).toBe('invalid')
    expect(read('1,23,456', 'en')).toBe('invalid')
    expect(read('1,5,5', 'en')).toBe('invalid')
  })

  it('reads the language own mark before three digits as a decimal mark', () => {
    expect(read('1.234', 'en')).toBe(1.234)
    expect(read('1,234', 'de')).toBe(1.234)
    expect(read('2.800', 'en')).toBe(2.8)
    expect(read('2,800', 'de')).toBe(2.8)
  })

  it('reads the other mark before fewer or more than three digits as a decimal mark', () => {
    expect(read('1,23', 'en')).toBe(1.23)
    expect(read('1.23', 'de')).toBe(1.23)
    expect(read('1,2345', 'en')).toBe(1.2345)
    expect(read('1.2345', 'de')).toBe(1.2345)
  })

  it('reads the other mark before three digits as a decimal when it starts with 0', () => {
    expect(read('0,308', 'en')).toBe(0.308)
    expect(read('0.308', 'de')).toBe(0.308)
    expect(read('0.050', 'de')).toBe(0.05)
    // more than three leading digits cannot be a group
    expect(read('1234,567', 'en')).toBe(1234.567)
  })

  it('takes the reading the range allows when the other mark stands before three digits', () => {
    // a mass in grains: 1,234 as 1234 is out of range
    expect(read('1,234', 'en', { min: 0, max: 500 })).toBe(1.234)
    expect(read('1.234', 'de', { min: 0, max: 500 })).toBe(1.234)
    // a whole number: 1.234 is not one
    expect(read('1.234', 'de', { integer: true })).toBe(1234)
    expect(read('1,234', 'en', { min: 0, max: 5000, integer: true })).toBe(1234)
    // below the range as a decimal
    expect(read('1,234', 'en', { min: 1000, max: 5000 })).toBe(1234)
  })

  it('refuses the other mark before three digits when both readings fit', () => {
    expect(parseNumber('1,234', {}, 'en')).toEqual({
      kind: 'ambiguous',
      decimal: 1.234,
      grouped: 1234,
    })
    expect(read('1.234', 'de', { min: 0, max: 10000 })).toBe('ambiguous')
    expect(read('-1,234', 'en')).toBe('ambiguous')
    expect(read('1,234e2', 'en')).toBe('ambiguous')
    expect(read('12,345', 'en', { min: 0 })).toBe('ambiguous')
  })

  it('refuses neither reading a text when the range allows none: the decimal reading stands for the range error', () => {
    expect(read('1,234', 'en', { min: 0, max: 1 })).toBe(1.234)
  })

  it('says how to write the two readings', () => {
    const p = parseNumber('1.234', {}, 'de') as Extract<ParsedNumber, { kind: 'ambiguous' }>
    setShownLanguage('de')
    try {
      expect(ambiguousMessage(p)).toBe(
        'Ambiguous: write 1,234 for a decimal or 1234 for a whole number.',
      )
    } finally {
      setShownLanguage('en')
    }
    expect(ambiguousMessage(p)).toBe(
      'Ambiguous: write 1.234 for a decimal or 1234 for a whole number.',
    )
  })

  it('gives the canonical text of what was typed', () => {
    const text = (t: string, language = 'de') => {
      const p = parseNumber(t, {}, language)
      return p.kind === 'number' ? p.text : p.kind
    }
    expect(text('1,5')).toBe('1.5')
    expect(text(',5')).toBe('.5')
    expect(text('1,')).toBe('1.')
    expect(text('-1.234,5')).toBe('-1234.5')
    expect(text('1,5E3')).toBe('1.5E3')
    expect(text('+1,5')).toBe('+1.5')
    expect(text('  7 ')).toBe('7')
  })
})

describe('format, then read', () => {
  it('writes the canonical text of a field with a point under both languages', () => {
    const system = presetUnits('metric-grams')
    for (const language of ['en', 'de']) {
      setShownLanguage(language)
      try {
        for (const si of [0.0003, 0.0254, 1.5, 308, 0.00762]) {
          expect(roundedFieldText('length', system, si)).toMatch(/^-?[\d.]+$/)
          expect(exactFieldText('length', system, si)).toMatch(/^-?[\d.]+$/)
        }
      } finally {
        setShownLanguage('en')
      }
    }
  })
})

describe('field state from typed text', () => {
  const system = presetUnits('metric-grams')
  const spec = { key: 'm', label: 'Mass', quantity: 'mass', min: 0, max: 100 } as const

  it('keeps the canonical text and the SI value of either mark', () => {
    setShownLanguage('de')
    try {
      for (const raw of ['1,5', '1.5']) {
        const v = typedFieldValue('mass', system, raw, rangeOf(spec))
        expect(v.text).toBe('1.5')
        expect(v.si).toBeCloseTo(0.0015, 12)
      }
      expect(fieldError(spec, typedFieldValue('mass', system, '1,5', rangeOf(spec)), system)).toBe(
        undefined,
      )
    } finally {
      setShownLanguage('en')
    }
  })

  it('keeps text that is no number as typed, without a value', () => {
    for (const raw of ['abc', '1.2.3', '']) {
      expect(typedFieldValue('mass', system, raw, rangeOf(spec))).toEqual({
        text: raw,
        si: undefined,
      })
    }
  })

  it('leaves an ambiguous text without a value and says so', () => {
    setShownLanguage('de')
    try {
      const open = { key: 'm', label: 'Mass', quantity: 'mass', min: 0, max: 10000 } as const
      const v = typedFieldValue('mass', system, '1.234', rangeOf(open))
      expect(v).toEqual({ text: '1.234', si: undefined })
      expect(fieldError(open, v, system)).toBe(
        'Ambiguous: write 1,234 for a decimal or 1234 for a whole number.',
      )
      // the bounds settle it
      expect(typedFieldValue('mass', system, '1.234', rangeOf(spec)).text).toBe('1.234')
      expect(typedFieldValue('mass', system, '1.234', rangeOf(spec)).si).toBeCloseTo(0.001234, 12)
    } finally {
      setShownLanguage('en')
    }
  })

  it('reads the canonical text of the state with the point, in any language', () => {
    setShownLanguage('de')
    try {
      // generated by the app, never typed: "2.800" is 2.8, not a group
      expect(fieldValueFromText('mass', system, '2.800').si).toBeCloseTo(0.0028, 12)
      expect(fieldError(spec, fieldValueFromText('mass', system, '2.800'), system)).toBe(undefined)
    } finally {
      setShownLanguage('en')
    }
  })

  it('reads a twist typed with a comma', () => {
    const v = typedFieldValue('twist', system, '1:8,5')
    expect(v.text).toBe('1:8.5')
    expect(v.si).toBeCloseTo(0.0085, 12)
    expect(typedFieldValue('twist', system, '1 in 8').text).toBe('1 in 8')
    expect(typedFieldValue('twist', system, '8,5').text).toBe('8.5')
    expect(typedFieldValue('twist', system, 'x').si).toBeUndefined()
  })

  it('reports a range error of a value typed with a comma', () => {
    const v = typedFieldValue('mass', system, '150,5', rangeOf(spec))
    expect(fieldError(spec, v, system)).toBe('Mass must be at most 100 g.')
    const whole = { ...spec, integer: true }
    expect(fieldError(whole, typedFieldValue('mass', system, '5,5', rangeOf(whole)), system)).toBe(
      'Mass must be a whole number.',
    )
  })
})
