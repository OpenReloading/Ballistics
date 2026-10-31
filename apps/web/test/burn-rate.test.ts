import type { Powder } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import de from '../src/i18n/de.json'
import { translator } from '../src/i18n/translate.ts'
import {
  bandNote,
  classifyPowder,
  curveAt,
  isFitted,
  meanRate,
  neighbours,
  type PowderRow,
  rateAt,
  rateDomain,
  rateTicks,
  typedBurn,
  uncertaintyFactor,
} from '../src/lib/burn-rate.ts'

const record = (
  vivacity: { value: number; standardUncertainty?: number },
  exponent = 1,
): Powder => ({
  id: 'p',
  manufacturer: 'm',
  name: 'N',
  interior: {
    fitted: ['vivacity'],
    vivacity,
    pressureExponent: exponent,
    referencePressure: { value: 0.980665 },
    burnForm: { kind: 'twoStage', a: { value: 0 }, m: 0.5, q: 0.5, z1: 0.8 },
    trainingRows: 10,
    trainingCartridges: 2,
  } as Powder['interior'],
  provenance: { kind: 'published', sources: [] },
})

describe('burn-rate rows', () => {
  it('converts the stored bar and gives a 2 sigma interval in 1/(MPa s)', () => {
    const p = classifyPowder(record({ value: 0.6, standardUncertainty: 0.03 }))
    if (!isFitted(p)) throw new Error('fitted')
    const v = curveAt(p, 0.5)
    expect(v.value).toBeCloseTo((0.6 / 98066.5) * 1e6, 12)
    expect(v.low).toBeCloseTo(v.value * 0.9, 12)
    expect(v.high).toBeCloseTo(v.value * 1.1, 12)
    expect(meanRate(p).value).toBeLessThan(v.value)
  })

  it('sets apart a powder without a fit, with another exponent or an interval reaching 0', () => {
    expect(classifyPowder({ ...record({ value: 1 }), interior: undefined })).toHaveProperty(
      'reason',
      expect.stringMatching(/^No fitted parameters/),
    )
    expect(classifyPowder(record({ value: 1 }, 1.1))).toHaveProperty(
      'reason',
      expect.stringMatching(/^Pressure exponent 1.1/),
    )
    expect(classifyPowder(record({ value: 1, standardUncertainty: 0.5 }))).toHaveProperty(
      'reason',
      expect.stringMatching(/^Fit unresolved/),
    )
    expect(isFitted(classifyPowder(record({ value: 1 })))).toBe(true)
  })
})

describe('typed model parameters', () => {
  it('give the curve of the record they were filled from, without an interval', () => {
    const r = record({ value: 0.6, standardUncertainty: 0.01 })
    const fromRecord = classifyPowder(r)
    // the SI field values the workbench fills from this record (`powderModelValues`)
    const typed = typedBurn({
      vivacity: 0.6,
      exponent: 1,
      referencePressure: 98066.5,
      formA: 0,
      formM: 0.5,
      formQ: 0.5,
      formZ1: 0.8,
    })
    if (!isFitted(fromRecord) || !typed || !isFitted(typed)) throw new Error('no curve')
    for (const z of [0, 0.3, 0.9])
      expect(curveAt(typed, z).value).toBeCloseTo(curveAt(fromRecord, z).value, 12)
    expect(curveAt(typed, 0.5).low).toBeUndefined()
  })

  it('give no curve while a value is missing, and none for an exponent other than 1', () => {
    expect(typedBurn({ vivacity: 0.6, exponent: 1 })).toBeUndefined()
    const off = typedBurn({ vivacity: 0.6, exponent: 0.9, referencePressure: 1e5 })
    expect(off && 'reason' in off && off.reason).toMatch(/exponent 0.9/)
  })

  it('are named in the language of the translator', () => {
    const typed = typedBurn(
      { vivacity: 0.6, exponent: 1, referencePressure: 1e5 },
      translator(de, 'de').t,
    )
    expect(typed?.label).toBe('Eingegebene Modellparameter')
  })
})

describe('the log scale of the burn rates', () => {
  const row = (mean: number, low?: number | undefined, high?: number): PowderRow => ({
    id: String(mean),
    manufacturer: 'm',
    manufacturerName: 'M',
    name: 'N',
    meanVivacity: mean,
    low,
    high,
  })

  it('ends on the 1, 2, 5 steps around the lows and highs', () => {
    expect(rateDomain([row(6, 5.9, 6.2), row(40, 38, 46)])).toEqual([5, 50])
    expect(rateDomain([row(1.2, 0.9, 1.5), row(18)])).toEqual([0.5, 20])
    // a value on a step is its own end
    expect(rateDomain([row(2), row(10)])).toEqual([2, 10])
    // one value: one step on
    expect(rateDomain([row(2)])).toEqual([2, 5])
    // rows without a rate
    expect(rateDomain([{ id: 'x', manufacturer: 'm', manufacturerName: 'M', name: 'N' }])).toEqual([
      1, 10,
    ])
  })

  it('ticks every step from end to end', () => {
    expect(rateTicks([0.5, 50])).toEqual([0.5, 1, 2, 5, 10, 20, 50])
    expect(rateTicks([2, 10])).toEqual([2, 5, 10])
  })

  it('places values by their logarithm, outside values at the ends', () => {
    const d: [number, number] = [1, 100]
    expect(rateAt(d, 1)).toBe(0)
    expect(rateAt(d, 10)).toBeCloseTo(0.5)
    expect(rateAt(d, 100)).toBe(1)
    expect(rateAt(d, 0.1)).toBe(0)
    expect(rateAt(d, 0)).toBe(0)
    expect(rateAt(d, 1000)).toBe(1)
    const xs = [1, 2, 3, 5, 8, 13, 50].map((v) => rateAt(d, v))
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
  })
})

describe('the neighbours of a powder in the burn-rate order', () => {
  // orders 1 to 12, listed out of order, and one powder without an order
  const rows: PowderRow[] = [
    ...Array.from({ length: 12 }, (_, i) => ({
      id: `p${12 - i}`,
      manufacturer: 'm',
      manufacturerName: 'M',
      name: `${12 - i}`,
      burnRateOrder: 12 - i,
    })),
    { id: 'none', manufacturer: 'm', manufacturerName: 'M', name: 'none' },
  ]
  const ids = (list: PowderRow[]) => list.map((r) => r.id)

  it('gives five faster and five slower, nearest first, with the order of all ordered powders', () => {
    const n = neighbours(rows, 'p6')
    expect(n).toMatchObject({ order: 6, total: 12 })
    expect(ids(n?.faster ?? [])).toEqual(['p5', 'p4', 'p3', 'p2', 'p1'])
    expect(ids(n?.slower ?? [])).toEqual(['p7', 'p8', 'p9', 'p10', 'p11'])
  })

  it('gives fewer at the ends, with no wrap-around', () => {
    expect(neighbours(rows, 'p1')?.faster).toEqual([])
    expect(ids(neighbours(rows, 'p1')?.slower ?? [])).toEqual(['p2', 'p3', 'p4', 'p5', 'p6'])
    expect(neighbours(rows, 'p12')?.slower).toEqual([])
    expect(ids(neighbours(rows, 'p11')?.slower ?? [])).toEqual(['p12'])
  })

  it('gives nothing for a powder without an order or not in the list', () => {
    expect(neighbours(rows, 'none')).toBeUndefined()
    expect(neighbours(rows, 'missing')).toBeUndefined()
  })
})

it('writes the standard uncertainties of the band note as the interval factor', () => {
  expect(bandNote).toContain(`Plus and minus ${uncertaintyFactor} standard`)
})
