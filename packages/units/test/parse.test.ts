import * as fc from 'fast-check'
import { expect, it } from 'vitest'
import { type DecimalMark, type NumberRange, type ParsedNumber, parseNumber } from '../src/index.ts'

const number = (value: number, text: string): ParsedNumber => ({ kind: 'number', value, text })
const invalid: ParsedNumber = { kind: 'invalid' }

it.each<[string, DecimalMark, NumberRange, ParsedNumber]>([
  ['', '.', {}, { kind: 'empty' }],
  ['  ', ',', {}, { kind: 'empty' }],
  // letters, units, spaces, apostrophes and lone marks or signs are no number
  ['abc', '.', {}, invalid],
  ['5 gr', '.', {}, invalid],
  ["1'234", '.', {}, invalid],
  ['.', ',', {}, invalid],
  ['-', '.', {}, invalid],
  ['1e', '.', {}, invalid],
  ['1e9999', '.', {}, invalid],
  // either mark, signs (the typographic minus too), a leading or trailing mark and an exponent
  ['1,5', '.', {}, number(1.5, '1.5')],
  ['1.5', ',', {}, number(1.5, '1.5')],
  ['−1,5', ',', {}, number(-1.5, '-1.5')],
  ['+,5', '.', {}, number(0.5, '+.5')],
  ['1,', ',', {}, number(1, '1.')],
  ['1,5E3', ',', {}, number(1500, '1.5E3')],
  [' 12 ', '.', {}, number(12, '12')],
  // both marks: the last is the decimal mark, the other groups in threes
  ['-1.234,5', ',', {}, number(-1234.5, '-1234.5')],
  ['1,234.5', ',', {}, number(1234.5, '1234.5')],
  ['1.23,5', ',', {}, invalid],
  // a repeated mark groups in threes, and never the language's own
  ['1,234,567', '.', {}, number(1234567, '1234567')],
  ['1.234.567', '.', {}, invalid],
  ['1,23,456', '.', {}, invalid],
  // the own mark once is the decimal mark
  ['1.234', '.', {}, number(1.234, '1.234')],
  ['2,800', ',', {}, number(2.8, '2.800')],
  // the other mark once is a decimal mark, unless it stands before three digits after 1 to 3 others
  ['0,308', '.', {}, number(0.308, '0.308')],
  ['1,2345', '.', {}, number(1.2345, '1.2345')],
  ['1234,567', '.', {}, number(1234.567, '1234.567')],
  ['1,234', '.', {}, { kind: 'ambiguous', decimal: 1.234, grouped: 1234 }],
  // the range settles it when only one reading fits; when none does, the decimal one stands
  ['1,234', '.', { min: 0, max: 500 }, number(1.234, '1.234')],
  ['1.234', ',', { integer: true }, number(1234, '1234')],
  ['1,234', '.', { min: 1000 }, number(1234, '1234')],
  ['1,234', '.', { min: 0, max: 1 }, number(1.234, '1.234')],
  ['1,234e9999', '.', {}, invalid],
])('reads %j with the own mark %j and range %j', (text, own, range, expected) => {
  expect(parseNumber(text, own, range)).toEqual(expected)
})

it('reads a number written with either decimal mark in either language', () => {
  fc.assert(
    fc.property(
      fc.double({ min: -1e15, max: 1e15, noNaN: true }),
      fc.integer({ min: 0, max: 6 }),
      fc.constantFrom<DecimalMark>('.', ','),
      (x, digits, own) => {
        const canonical = x.toFixed(digits)
        const value = Number(canonical)
        const asOwn = parseNumber(canonical.replace('.', own), own)
        expect(asOwn).toEqual(number(value, canonical))
        // the other mark reads as the same number, or as ambiguous with it as the decimal reading
        const asOther = parseNumber(canonical.replace('.', own === '.' ? ',' : '.'), own)
        if (asOther.kind === 'ambiguous') expect(asOther.decimal).toBe(value)
        else expect(asOther).toEqual(number(value, canonical))
      },
    ),
  )
})
