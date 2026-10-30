import type { Seating } from '@open-reloading/drawing/seating'
import { toSi } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { english } from '../src/i18n/translate.ts'
import { drawable } from '../src/lib/cartridge-sheet.ts'
import { figureViewBuilder } from '../src/lib/figure-views.ts'
import { chargeFill, seatingValueRows } from '../src/lib/seating-values.ts'
import { presetUnits, unitsOf } from '../src/lib/units.ts'
import { sheetRecord } from './records.ts'

const grams = (g: number) => toSi('mass', g)
const cm3 = (v: number) => unitsOf.capacity.cm3.toSi(v)
const bulk = toSi('density', 0.9)

describe('chargeFill', () => {
  it('fills the case to the share of the volume behind the bullet that the charge bulk takes', () => {
    // 2.7 g at 0.9 g/cm³ is 3 cm³ of the 4 cm³ behind a bullet base at 40 mm
    const fill = chargeFill({ charge: grams(2.7), bulkDensity: bulk, volume: cm3(4), base: 40 })
    if ('missing' in fill) throw new Error('no fill')
    expect(fill.ratio).toBeCloseTo(0.75, 12)
    expect(fill.level).toBeCloseTo(40 * (2.7 / 0.9 / 4), 12)
    expect(fill.loadingDensity).toBeCloseTo(toSi('density', 2.7 / 4), 9)
    expect(fill.compressed).toBe(false)
  })

  it('marks a charge whose bulk exceeds the volume behind the bullet compressed, level at the base', () => {
    const fill = chargeFill({ charge: grams(4.5), bulkDensity: bulk, volume: cm3(4), base: 40 })
    if ('missing' in fill) throw new Error('no fill')
    expect(fill.ratio).toBeCloseTo(1.25, 12)
    expect(fill.compressed).toBe(true)
    expect(fill.level).toBe(40)
  })

  it('names each missing input and draws nothing', () => {
    const base = { charge: grams(2.7), bulkDensity: bulk, volume: cm3(4), base: 40 }
    expect(chargeFill({ ...base, charge: undefined })).toEqual({ missing: ['a charge'] })
    expect(chargeFill({ ...base, volume: undefined })).toEqual({ missing: ['a case capacity'] })
    expect(chargeFill({ ...base, bulkDensity: undefined })).toEqual({
      missing: ['the bulk density of the powder'],
    })
    expect(chargeFill({ charge: undefined, bulkDensity: undefined, volume: 0, base: 40 })).toEqual({
      missing: ['a charge', 'a case capacity', 'the bulk density of the powder'],
    })
  })
})

describe('seatingValueRows', () => {
  const spec = drawable(sheetRecord('cip-308-win-2008-09-23'))
  const system = presetUnits('metric-grams')
  // the fields the rows read; the rest of a seating is the drawing's
  const seating = {
    coal: { value: 68.74, tag: 'entered' },
    cbto: { value: 52.74, tag: 'derived' },
    depth: { value: 10.2, tag: 'derived' },
    volumeBehindBullet: { value: 3.5, tag: 'derived' },
  } as unknown as Seating
  const fill = chargeFill({ charge: grams(2.7), bulkDensity: bulk, volume: cm3(3.5), base: 41 })

  it('lists every dimension the Cartridge view draws, with the seated COAL and CBTO', () => {
    const model = figureViewBuilder(spec, undefined, 'mm')({ coal: 68.74, cbto: 52.74 }).cartridge
    const annotation = model?.annotation
    if (!annotation) throw new Error('no annotation')
    const rows = seatingValueRows({ annotation, seating, fill, system }, english.t)
    const named = new Map(rows.map((r) => [r.name, r]))
    for (const d of annotation.dimensions) {
      const row = named.get(`${d.kind === 'diameter' ? 'Ø' : ''}${d.symbol}`)
      expect(row, d.symbol).toBeDefined()
      if (d.symbol !== 'Rt/R') expect(Number(row?.value)).toBeCloseTo(d.value, 1)
    }
    // the drawing labels each length once: as many label texts as length and diameter rows
    const labels = model?.layers.cartridge?.labels.filter((l) => !l.ring) ?? []
    expect(labels.map((l) => l.text)).toContain(`COAL ${named.get('COAL')?.value}`)
    expect(named.get('CBTO')?.value).toBe('52.74')
    expect(rows.filter((r) => r.name === 'COAL')).toHaveLength(1)
  })

  it('adds COAL and CBTO in Combined, which draws no dimensions, and the charge rows of the fill', () => {
    const rows = seatingValueRows({ annotation: undefined, seating, fill, system }, english.t)
    expect(rows.map((r) => r.name)).toEqual([
      'COAL',
      'CBTO',
      'Seating depth',
      'Volume behind the bullet',
      'Charge',
      'Case fill',
      'Loading density',
    ])
    if ('missing' in fill) throw new Error('no fill')
    expect(rows.find((r) => r.name === 'Case fill')?.value).toBe(
      String(Math.round(fill.ratio * 100)),
    )
    expect(rows.find((r) => r.name === 'Charge')).toEqual({
      name: 'Charge',
      value: '2.70',
      unit: 'g',
    })
  })

  it('leaves out the charge rows while an input of the fill is missing', () => {
    const missing = chargeFill({ charge: undefined, bulkDensity: bulk, volume: cm3(3.5), base: 41 })
    const rows = seatingValueRows(
      { annotation: undefined, seating, fill: missing, system },
      english.t,
    )
    expect(rows.map((r) => r.name)).not.toContain('Charge')
  })
})
