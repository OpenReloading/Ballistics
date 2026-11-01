import { load as loadSchema } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import {
  initialPowderTab,
  powderTableCsv,
  restoredPowderTab,
  savedPowderTab,
} from '../src/components/powder-csv.ts'
import type { CompareRow } from '../src/components/use-powder-compare.ts'
import { english } from '../src/i18n/translate.ts'
import { toApiLoad, toLoad } from '../src/lib/load-record.ts'
import { presetUnits } from '../src/lib/units.ts'

const us = presetUnits('us')
const metric = presetUnits('metric-grams')
const t = english.t

const rows: CompareRow[] = [
  {
    id: 'a',
    manufacturerName: 'Maker',
    name: 'Fast, Ball',
    charge: 0.0024,
    ratio: 0.95,
    values: {
      peak: 3.1e8,
      percent: 74.6,
      velocity: 800,
      burnt: 0.99,
      burnout: 0.3,
      range: { low: 2.9e8, high: 3.3e8 },
    },
    flag: 'model note',
    flagText: () => 'model note',
  },
  { id: 'b', manufacturerName: 'Maker', name: 'Slow', reason: 'No fitted model parameters' },
]

describe('the Powders table as CSV', () => {
  it('has the columns and units of the table header', () => {
    const [head] = powderTableCsv(rows, false, us, t, (r) => r.reason ?? '').split('\n')
    expect(head).toBe(
      'Powder,Charge (gr),Flags,Peak pressure (psi),Percent of maximum (%),Muzzle velocity (ft/s),Case fill (%),Burnt at the muzzle (%),Burnout (in)',
    )
    const [target] = powderTableCsv(rows, true, metric, t, () => '').split('\n')
    expect(target).toContain('"Pressure range, low (bar)","Pressure range, high (bar)"')
  })

  it('gives each powder its values as numbers, and the reason of one not computed', () => {
    const lines = powderTableCsv(rows, false, us, t, (r) => r.reason ?? '').split('\n')
    expect(lines[1]).toBe('"Maker Fast, Ball",37.0,model note,44962,75,2625,95,99,11.81')
    expect(lines[2]).toBe('Maker Slow,,Not computed: No fitted model parameters')
  })
})

describe('the Powders tab kept with the load', () => {
  it('keeps nothing while every control has its first value', () => {
    expect(savedPowderTab(initialPowderTab, us)).toBeUndefined()
  })

  it('keeps the mode, the fill, the target in bar and the filters', () => {
    const saved = savedPowderTab(
      {
        kind: 'target',
        fill: 90,
        targetText: 50000,
        percent: false,
        filters: { manufacturerName: 'Maker', base: '', form: 'ball' },
      },
      us,
    )
    expect(saved).toMatchObject({ mode: 'target', fill: 90, manufacturer: 'Maker', form: 'ball' })
    expect(saved?.targetPressure).toBeCloseTo(3447.38, 2)
    expect(saved).not.toHaveProperty('base')
    expect(restoredPowderTab(saved, us)).toEqual({
      kind: 'target',
      fill: 90,
      targetText: 50000,
      percent: false,
      filters: { manufacturerName: 'Maker', base: '', form: 'ball' },
    })
  })

  it('keeps a target that is a share of Pmax as that percentage', () => {
    const saved = savedPowderTab(
      { ...initialPowderTab, kind: 'target', targetText: 85, percent: true },
      us,
    )
    expect(saved).toEqual({ mode: 'target', targetPercent: 85 })
    expect(restoredPowderTab(saved, metric)).toMatchObject({ targetText: 85, percent: true })
  })
})

describe('the load file', () => {
  const parts = {
    values: { charge: 0.0024 },
    given: new Set<string>(),
    notes: '',
    sessions: [],
    powders: { mode: 'fill' as const, fill: 90, manufacturer: 'Maker' },
  }

  it('keeps the Powders tab under analysis.powders, valid for the schema', () => {
    const load = toLoad(parts)
    expect(load.analysis?.powders).toEqual({ mode: 'fill', fill: 90, manufacturer: 'Maker' })
    expect(loadSchema.safeParse(load).success).toBe(true)
  })

  it('leaves it out of the file for the API', () => {
    expect(toApiLoad(parts, {}).analysis?.powders).toBeUndefined()
  })
})
