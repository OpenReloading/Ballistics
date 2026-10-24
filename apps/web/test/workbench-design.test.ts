import { describe, expect, it } from 'vitest'
import {
  fileData,
  fromRecord,
  historyOf,
  reduce,
  workbenchDesign,
} from '../src/lib/cartridge-designer.ts'
import { fieldValueFromText } from '../src/lib/field-spec.ts'
import { presetUnits } from '../src/lib/units.ts'
import { sheetRecord } from './records.ts'

const metric = presetUnits('metric-grams')
const saved = (...edits: [string, string][]) => {
  const h = edits.reduce(
    (h, [key, text]) =>
      reduce(h, {
        type: 'field',
        key,
        value: fieldValueFromText(key.endsWith('alpha') ? 'angle' : 'length', metric, text),
      }),
    historyOf(fromRecord(sheetRecord('cip-308-win-2008-09-23'), metric)),
  )
  return fileData(h.present)
}

describe('a cartridge design in the workbench', () => {
  it('gives the bore diameter and an approximate case volume from its own values', () => {
    const d = workbenchDesign(saved(), 'My case', metric)
    expect(d?.title).toBe('user design My case')
    expect(d?.boreDiameter).toBeGreaterThan(0.007)
    expect(d?.boreDiameter).toBeLessThan(0.009)
    expect(d?.caseVolume).toBeGreaterThan(2e-6)
    expect(d?.caseVolume).toBeLessThan(5e-6)
  })

  it('takes the bore diameter from the design, not from the record it started from', () => {
    expect(workbenchDesign(saved(['chamber.F', '7.9']), 'a', metric)?.boreDiameter).toBeCloseTo(
      7.9e-3,
      9,
    )
  })

  it('leaves out a value the design lacks, with no catalogue value in its place', () => {
    const d = workbenchDesign(saved(['chamber.F', '']), 'a', metric)
    expect(d?.spec).toBeDefined()
    expect(d?.boreDiameter).toBeUndefined()
    expect(Object.keys(d ?? {})).toEqual(['spec', 'title', 'boreDiameter', 'caseVolume'])
  })

  it('is not offered without the cartridge L3 the seating needs', () => {
    expect(workbenchDesign(saved(['cartridge.L3', '']), 'a', metric)).toBeUndefined()
  })
})
