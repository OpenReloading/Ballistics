import { defaultStartPressure } from '@openreloading/core'
import { describe, expect, it } from 'vitest'
import { interiorFields } from '../src/lib/interior-input.ts'
import {
  citedDefaults,
  defaultKeys,
  defaultsText,
  parseDefaults,
  validDefault,
  type WorkbenchDefaults,
} from '../src/lib/workbench-defaults.ts'

const cited = Object.fromEntries(
  defaultKeys.map((k) => [k, citedDefaults[k].si]),
) as WorkbenchDefaults

describe('workbench defaults', () => {
  it('covers the ambient and secondary inputs only, each an interior field with a source', () => {
    expect(defaultKeys).toEqual(['propellantTemperature', 'ignitionPressure', 'startPressure'])
    for (const k of defaultKeys) {
      expect(interiorFields.some((s) => s.key === k)).toBe(true)
      expect(citedDefaults[k].source.length).toBeGreaterThan(0)
    }
  })

  it('cites 21 °C, 10 bar and the core start pressure for barrels of 300 mm and longer', () => {
    expect(citedDefaults.propellantTemperature.si).toBeCloseTo(294.15, 10)
    expect(citedDefaults.ignitionPressure.si).toBe(1e6)
    expect(citedDefaults.startPressure.si).toBe(defaultStartPressure(0.3).value)
    expect(citedDefaults.startPressure.si).toBe(30e6)
    // the field descriptions name these sources: "Default: <source>."
    expect(citedDefaults.propellantTemperature.source).toBe(
      'CIP test conditions at 21 °C, CIP Decision XXXVI-15',
    )
    expect(citedDefaults.ignitionPressure.source).toBe('assumption, no source')
    expect(citedDefaults.startPressure.source).toBe(
      'approximate model default for barrels of 300 mm and longer',
    )
  })

  it('accepts finite values in the field bounds only', () => {
    expect(validDefault('propellantTemperature', 253.15)).toBe(true)
    expect(validDefault('propellantTemperature', 0)).toBe(false)
    expect(validDefault('ignitionPressure', 0)).toBe(false)
    expect(validDefault('startPressure', 0)).toBe(true)
    expect(validDefault('startPressure', -1)).toBe(false)
    expect(validDefault('startPressure', Number.NaN)).toBe(false)
    expect(validDefault('startPressure', undefined)).toBe(false)
  })

  it('reads the cited values from nothing, unreadable text or a non-object', () => {
    for (const text of [null, '', 'not json', '[1]', '42', 'null'])
      expect(parseDefaults(text)).toEqual(cited)
  })

  it('takes each valid stored value and ignores invalid ones and unknown keys', () => {
    const text = JSON.stringify({
      startPressure: 25e6,
      ignitionPressure: -5,
      propellantTemperature: 'x',
      z: 1,
    })
    expect(parseDefaults(text)).toEqual({ ...cited, startPressure: 25e6 })
  })

  it('stores only the tuned values, nothing when none is tuned', () => {
    expect(defaultsText({ ...cited })).toBeUndefined()
    const tuned = { ...cited, propellantTemperature: 283.15 }
    expect(JSON.parse(defaultsText(tuned) as string)).toEqual({ propellantTemperature: 283.15 })
    expect(parseDefaults(defaultsText(tuned) as string)).toEqual(tuned)
  })

  it('keeps the barrel length apart from the cited defaults: empty means by cartridge class', () => {
    expect(parseDefaults(null).barrelLength).toBeUndefined()
    expect(parseDefaults('{"barrelLength":0.4}')).toEqual({ ...cited, barrelLength: 0.4 })
    for (const v of [0, -1, 'x', null])
      expect(parseDefaults(JSON.stringify({ barrelLength: v })).barrelLength).toBeUndefined()
    expect(defaultsText({ ...cited, barrelLength: 0.4 })).toBe('{"barrelLength":0.4}')
    const both = { ...cited, propellantTemperature: 283.15, barrelLength: 0.4 }
    expect(parseDefaults(defaultsText(both) as string)).toEqual(both)
  })
})
