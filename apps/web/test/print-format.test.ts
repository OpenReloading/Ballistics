import { afterEach, describe, expect, it } from 'vitest'
import { setShownLanguage } from '../src/i18n/shown.ts'
import { printedField, printedValue } from '../src/lib/print-format.ts'
import { metersPerInch, presetUnits } from '../src/lib/units.ts'

const toSiLength = (inches: number) => inches * metersPerInch
const us = presetUnits('us')
const metric = presetUnits('metric-grams')

afterEach(() => setShownLanguage('en'))

describe('the printed inputs', () => {
  it('have the digits of the field that shows them', () => {
    expect(printedField('length', us, { text: '0.3000', si: toSiLength(0.3) })).toBe('.3000 in')
    expect(printedField('charge', us, { text: '37.0', si: 0.0024 })).toBe('37.0 gr')
    expect(printedField('twist', us, { text: '1:12', si: 0.3048 })).toBe('1:12 in')
    expect(printedField('length', us, { text: '', si: undefined })).toBeUndefined()
  })

  it('give a value without field text the decimals of a workbench field', () => {
    expect(printedValue('length', us, toSiLength(2.8))).toBe('2.8000 in')
    expect(printedValue('length', us, toSiLength(0.4157))).toBe('.4157 in')
    expect(printedValue('length', metric, 0.07112)).toBe('71.12 mm')
  })

  it('write the decimal comma in German', () => {
    setShownLanguage('de')
    expect(printedValue('length', us, toSiLength(2.8))).toBe('2,8000 in')
    expect(printedField('length', us, { text: '0.3000', si: toSiLength(0.3) })).toBe('0,3000 in')
  })
})
