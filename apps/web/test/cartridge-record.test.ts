import { figureModel, recordFigures, screenEm } from '@openreloading/drawing/cartridge'
import { describe, expect, it } from 'vitest'
import {
  combinedRows,
  defaultVariantIndex,
  inReadingOrder,
  pressureStripValues,
  rowGroups,
  sideHint,
  symbolText,
  toleranceText,
  variantMatrix,
} from '../src/lib/cartridge-record.ts'
import { drawable } from '../src/lib/cartridge-sheet.ts'
import { resolveUnits } from '../src/lib/units.ts'
import { sheetRecord } from './records.ts'

const record = sheetRecord
const rowsOf = (file: string) => {
  const spec = record(file)
  return combinedRows(spec, recordFigures(drawable(spec)))
}
const row = (rows: ReturnType<typeof combinedRows>, key: string) => rows.find((r) => r.key === key)

describe('symbolText', () => {
  it('prints the Greek letters as the drawing does and keeps the rest', () => {
    expect(['alpha', 'alpha1', 'beta', 'delta', 'delta L', 'L3+G', 'r1'].map(symbolText)).toEqual([
      'α',
      'α1',
      'β',
      'δ',
      'δ L',
      'L3+G',
      'r1',
    ])
  })
})

describe('combinedRows', () => {
  const rows = rowsOf('cip-308-win-2008-09-23')

  it('pairs the cartridge maximum and chamber minimum of a symbol in one row', () => {
    // 24 cartridge and 25 chamber values, 14 symbols on both sides
    expect(rows).toHaveLength(35)
    expect(row(rows, 'L3')?.cartridge?.value).toBe(51.18)
    expect(row(rows, 'L3')?.chamber?.value).toBe(51.44)
    expect(row(rows, 'L6')?.chamber).toBeUndefined()
    expect(row(rows, 'Q')?.cartridge).toBeUndefined()
    // r1 and R1, e and E are different dimensions
    expect(row(rows, 'e')?.chamber).toBeUndefined()
    expect(row(rows, 'E')?.chamber?.value).toBe(3.85)
  })

  it('gives the clearance only where it is a fit: the diameters and the case length', () => {
    expect(row(rows, 'R1')?.clearance).toBe(0.02)
    expect(row(rows, 'P1')?.clearance).toBe(0.03)
    expect(row(rows, 'H2')?.clearance).toBe(0.02)
    expect(row(rows, 'L3')?.clearance).toBe(0.26)
    const g1 = row(rows, 'G1')
    expect(g1?.clearance).toBeCloseTo((g1?.chamber?.value ?? 0) - (g1?.cartridge?.value ?? 0), 6)
    // lengths to the shoulder, the rim thickness, angles and radii are no fit
    for (const key of ['L1', 'L2', 'E', 'R', 'alpha', 'r1', 'r2', 'S'])
      expect(row(rows, key)?.clearance).toBeUndefined()
  })

  it('gives the meaning as the description and the spelled name and side notes on hover', () => {
    expect(row(rows, 'alpha')?.symbol).toBe('α')
    expect(row(rows, 'alpha')?.description).toBe('included shoulder angle')
    expect(row(rows, 'G1')?.description).toBe('cartridge bullet diameter; chamber throat diameter')
    expect(row(rows, 'L1')?.description).toBe('head to the shoulder start (P2)')
    // no footnote and no "not drawn" note: the app shows no footnotes
    expect(row(rows, 'L1')?.notes).toEqual([])
    expect(row(rows, 'alpha')?.notes).toEqual(['alpha', 'Cartridge: basic', 'Chamber: basic'])
    expect(row(rows, 'Fe')?.description).toBeUndefined()
    expect(row(rows, 'delta L')?.notes.join(' ')).not.toMatch(/not drawn|footnote/)
    expect(row(rows, 'alpha1')?.notes).toContain('Chamber: basic; printed 71°25\'59"')
  })

  it('marks a negative clearance as a data conflict', () => {
    const spec = record('cip-308-win-2008-09-23')
    const values = spec.values.map((v) =>
      v.side === 'chamber' && v.symbol === 'P1' ? { ...v, value: 11.9 } : v,
    )
    const p1 = row(combinedRows({ ...spec, values }, recordFigures(drawable(spec))), 'P1')
    expect(p1?.clearance).toBe(-0.06)
    expect(p1?.notes.at(-1)).toMatch(/^Clearance: data conflict/)
    // the 22 BB Cap rim thickness is no fit: no false conflict
    expect(row(rowsOf('cip-22-bb-cap-2000-06-07'), 'R')?.clearance).toBeUndefined()
  })

  it('adds a derived cartridge e with its note', () => {
    const e = row(rowsOf('cip-454-casull-2015-05-19'), 'e')
    expect(e?.cartridge?.value).toBeCloseTo(0)
    expect(e?.notes).toContain('Cartridge: derived, not dimensioned')
  })
})

describe('row groups and drawing link', () => {
  const spec = record('cip-308-win-2008-09-23')
  const list = recordFigures(drawable(spec))
  const rows = combinedRows(spec, list)
  const order = rowGroups.map(([g]) => g)

  it('puts each row in the designer group of its symbol, the rest under Other, in group order', () => {
    expect(
      ['R1', 'e', 'P1', 'L1', 'alpha', 'L3', 'L6', 'L3+G', 'F', 'Z', 'Fe'].map(
        (k) => row(rows, k)?.group,
      ),
    ).toEqual([
      'head',
      'head',
      'body',
      'shoulder',
      'shoulder',
      'neck',
      'neck',
      'neck',
      'throat',
      'throat',
      'other',
    ])
    // G1: the cartridge's bullet diameter is in Neck and length
    expect(row(rows, 'G1')?.group).toBe('neck')
    const ranks = rows.map((r) => order.indexOf(r.group))
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
  })

  it("names every dimension of the drawing by a row's stored symbol", () => {
    const f = list[0]
    const em = screenEm([f.drawn])
    const owners = f.drawn.flatMap(({ side }) =>
      (
        figureModel(
          f.drawn.filter((d) => d.side === side),
          'screen',
          em,
        ).layers[side]?.labels ?? []
      )
        .map((l) => l.owner)
        // flags and detail letters; L3−L2, a length the record does not give, has no row
        .filter((o) => !/^(flag|detail) |−/.test(o)),
    )
    expect(owners.length).toBeGreaterThan(20)
    const linked = new Set(rows.map((r) => r.storedSymbol))
    expect(owners.filter((o) => !linked.has(o))).toEqual([])
  })
})

describe('reading order and the hover of a side', () => {
  const rows = rowsOf('cip-308-win-2008-09-23')
  type Row = (typeof rows)[number]

  it('orders the groups as the drawing runs from the mouth to the head, the case length first', () => {
    const sorted = inReadingOrder(rows)
    expect(sorted[0].key).toBe('L3')
    const order = ['neck', 'shoulder', 'body', 'head', 'throat', 'other']
    const ranks = sorted.map((r) => order.indexOf(r.group))
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    // the record order holds within a group
    const head = (list: Row[]) => list.filter((r) => r.group === 'head').map((r) => r.key)
    expect(head(sorted)).toEqual(head(rows))
    expect(sorted).toHaveLength(rows.length)
  })

  it('gives the hover of a symbol per side: what it stands for there, then that side notes', () => {
    const g1 = row(rows, 'G1') as Row
    expect(sideHint(g1, 'cartridge')).toEqual(['G1: bullet diameter'])
    expect(sideHint(g1, 'chamber')).toEqual([
      'G1: throat diameter',
      'Basic',
      'Clearance: chamber minimum minus cartridge maximum',
    ])
    expect(sideHint(row(rows, 'alpha') as Row, 'chamber')).toEqual([
      'alpha: included shoulder angle',
      'Basic',
    ])
    const alpha1 = row(rows, 'alpha1') as Row
    expect(sideHint(alpha1, 'chamber')).toEqual([
      'alpha1: included angle of the h cone',
      'Basic',
      'Printed as 71°25\'59"',
    ])
    // a side without the symbol has none; a symbol without a meaning has no line
    expect(sideHint(alpha1, 'cartridge')).toEqual([])
    expect(sideHint(row(rows, 'Fe') as Row, 'cartridge')).toEqual([])
    expect(sideHint(row(rows, 'L1') as Row, 'cartridge')).toEqual([
      'L1: head to the shoulder start (P2)',
    ])
  })

  it('names a derived cartridge e and a clearance that is a data conflict', () => {
    const e = row(rowsOf('cip-454-casull-2015-05-19'), 'e') as Row
    expect(sideHint(e, 'cartridge')).toContain('Derived, not dimensioned')
    const spec = record('cip-308-win-2008-09-23')
    const values = spec.values.map((v) =>
      v.side === 'chamber' && v.symbol === 'P1' ? { ...v, value: 11.9 } : v,
    )
    const p1 = row(combinedRows({ ...spec, values }, recordFigures(drawable(spec))), 'P1') as Row
    expect(sideHint(p1, 'chamber', spec.table).at(-1)).toMatch(/^Clearance: data conflict/)
    expect(sideHint(p1, 'cartridge', spec.table).join(' ')).not.toMatch(/Clearance/)
  })
})

describe('toleranceText', () => {
  const spec = record('cip-308-win-2008-09-23')
  const l1 = spec.values.find((v) => v.side === 'cartridge' && v.symbol === 'L1')
  const r1 = spec.values.find((v) => v.side === 'cartridge' && v.symbol === 'r1')

  it('writes the tolerance with the minus sign U+2212 and no gap, in the preset unit', () => {
    expect(l1 && toleranceText(l1, resolveUnits({ preset: 'us', overrides: {} }))).toBe('−.0079')
    expect(l1 && toleranceText(l1, resolveUnits({ preset: 'metric-grains', overrides: {} }))).toBe(
      '−0.2',
    )
    expect(r1 && toleranceText(r1, resolveUnits({ preset: 'us', overrides: {} }))).toBe('min')
  })
})

describe('defaultVariantIndex', () => {
  const pick = (file: string) => {
    const { variants } = variantMatrix(record(file))
    return variants[defaultVariantIndex(variants)]
  }

  it('starts 12, 16, 20 and 28 gauge at 70 mm and 410 at 76 mm', () => {
    expect(pick('cip-12-2018-10-17')).toBe('12/70')
    expect(pick('cip-16-2010-05-26')).toBe('16/70')
    expect(pick('cip-20-2020-11-10')).toBe('20/70')
    expect(pick('cip-28-2017-05-17')).toBe('28/70')
    expect(pick('cip-410-2016-05-18')).toBe('410/76')
  })

  it('takes the variant nearest to 70 mm for the other gauges', () => {
    expect(pick('cip-10-2006-09-19')).toBe('10/76')
    expect(pick('cip-24-2006-09-19')).toBe('24/70')
    expect(pick('cip-32-2006-09-19')).toBe('32/70')
    expect(pick('cip-4-2006-09-19')).toBe('4/82')
  })

  it('reads a comma decimal and falls back to the first variant', () => {
    expect(defaultVariantIndex(['24/63,5', '24/69,5', '24/76'])).toBe(1)
    expect(defaultVariantIndex(['long', 'short'])).toBe(0)
    expect(defaultVariantIndex([])).toBe(0)
  })
})

describe('variantMatrix', () => {
  const spec = record('cip-12-2018-10-17')

  it('puts the pressures and lengths of each case length variant in columns', () => {
    const { variants, rows } = variantMatrix(spec)
    expect(variants).toHaveLength(9)
    expect(variants[0]).toBe('12/35 T')
    expect(rows.map((r) => r.label)).toEqual(['Pmax', 'PK', 'PE', 'M', 'Cartridge l', 'Chamber L'])
    const pmax = rows[0].cells.map((c) => c?.value)
    expect(pmax[0]).toBe(150)
    expect(pmax.at(-1)).toBe(1050)
    expect(rows[3].cells[1]?.raw).toBe('25/30')
  })

  it('leaves the variant values out of the combined table, but the Fe variants', () => {
    const rows = combinedRows(spec, recordFigures(drawable(spec)))
    expect(rows.some((r) => r.cartridge?.symbol === 'l' || r.chamber?.symbol === 'L')).toBe(false)
    expect(rows.map((r) => r.symbol)).toContain('Fe (bascule)')
    expect(pressureStripValues(spec)).toEqual([])
  })

  it('is empty outside table VII', () => {
    expect(variantMatrix(record('cip-308-win-2008-09-23')).rows).toEqual([])
    expect(pressureStripValues(record('cip-308-win-2008-09-23')).map((v) => v.symbol)).toEqual([
      'Pmax',
      'PK',
      'PE',
      'M',
      'EE',
    ])
  })
})
