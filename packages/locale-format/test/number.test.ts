import { parseNumber } from '@rangefoundry/units'
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  canonicalNumberText,
  decimalMark,
  fixedNumber,
  formatNumber,
  localizeDecimals,
  localizeNumber,
  plainNumber,
} from '../src/index.ts'

describe('the decimal mark', () => {
  it('is the language own', () => {
    expect(decimalMark('en')).toBe('.')
    expect(decimalMark('de')).toBe(',')
    expect(decimalMark('de')).toBe(',')
  })

  it('writes the point of a canonical text as the mark and leaves English as it is', () => {
    expect(localizeNumber('1.5', 'de')).toBe('1,5')
    expect(localizeNumber('-.25', 'de')).toBe('-,25')
    expect(localizeNumber('1:8.5', 'de')).toBe('1:8,5')
    expect(localizeNumber('1.5', 'en')).toBe('1.5')
    // not one number: left alone
    expect(localizeNumber('1.2.3', 'de')).toBe('1.2.3')
    expect(localizeNumber('abc', 'de')).toBe('abc')
  })

  it('formats with the digits of the call in both languages', () => {
    expect(formatNumber(1234.5678, 2, 'en')).toBe('1234.57')
    expect(formatNumber(1234.5678, 2, 'de')).toBe('1234,57')
    expect(formatNumber(-0.001, 1, 'de')).toBe('0,0')
    expect(formatNumber(-0.001, 1, 'en')).toBe('0.0')
    expect(fixedNumber(2.5, 3, 'de')).toBe('2,500')
    expect(fixedNumber(2.5, 3, 'en')).toBe('2.500')
    expect(plainNumber(0.308, 'de')).toBe('0,308')
    expect(plainNumber(1e-7, 'de')).toBe('1e-7')
  })

  it('swaps the points of server-written numeric text and leaves prose points', () => {
    expect(localizeDecimals('2.5 g, 0.308 in', 'de')).toBe('2,5 g, 0,308 in')
    expect(localizeDecimals('2.5 g, 0.308 in', 'en')).toBe('2.5 g, 0.308 in')
    expect(localizeDecimals('See section 2. Then 3', 'de')).toBe('See section 2. Then 3')
  })

  it('writes a number shown on screen as the canonical text for a file or the clipboard', () => {
    expect(canonicalNumberText('1,5', 'de')).toBe('1.5')
    expect(canonicalNumberText('-0,25', 'de')).toBe('-0.25')
    expect(canonicalNumberText('2,40 gr', 'de')).toBe('2.40 gr')
    expect(canonicalNumberText('1,234 ms', 'de')).toBe('1.234 ms')
    expect(canonicalNumberText('45 %', 'de')).toBe('45 %')
    expect(canonicalNumberText('a,b', 'de')).toBe('a,b')
    expect(canonicalNumberText('1.5', 'en')).toBe('1.5')
    expect(canonicalNumberText('1,5', 'en')).toBe('1,5')
  })
})

/** The value of text read with the mark of `language`, NaN for no number. */
const read = (text: string, language: string, range = {}) => {
  const p = parseNumber(text, decimalMark(language), range)
  return p.kind === 'number' ? p.value : Number.NaN
}

describe('format, then read', () => {
  const value = fc.double({ min: -1e9, max: 1e9, noNaN: true })

  it.each(['en', 'de'])('returns the value within the digits shown in %s', (language) => {
    fc.assert(
      fc.property(value, fc.integer({ min: 0, max: 4 }), (x, digits) => {
        // the language's own mark never reads as a group
        const back = read(formatNumber(x, digits, language), language, { min: -1e12, max: 1e12 })
        expect(Math.abs(back - x)).toBeLessThanOrEqual(0.5 * 10 ** -digits + 1e-6)
      }),
    )
  })

  it.each(['en', 'de'])(
    'reads the canonical text localized for the screen back in %s',
    (language) => {
      fc.assert(
        fc.property(value, (x) => {
          const canonical = String(Number(x.toPrecision(6)))
          expect(read(localizeNumber(canonical, language), language)).toBe(Number(canonical))
        }),
      )
    },
  )
})
