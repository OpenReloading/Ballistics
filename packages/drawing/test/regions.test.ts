import { describe, expect, it } from 'vitest'
import { recordFigures } from '../src/cartridge/figures.ts'
import { drawnTables, storedValue } from '../src/cartridge/profile.ts'
import { regionSymbols, regions, regionText, signedLengthText } from '../src/cartridge/regions.ts'
import { sheet, sheets } from './sheets.ts'

const record = sheet
const current = sheets

const flat = (id: string) =>
  regions(record(id).values).flatMap((r) => r.values.map((v) => `${r.name} ${v.symbol} ${v.value}`))

type Values = Parameters<typeof regions>[0]

/** Checks each region value against the stored difference; returns how many, adds the negative ones to `conflicts`. */
function checkDifferences(id: string, values: Values, conflicts: string[]) {
  let count = 0
  for (const region of regions(values))
    for (const { symbol, value } of region.values) {
      count++
      expect(regionSymbols[region.name]).toContain(symbol)
      const stored = (side: 'cartridge' | 'chamber') =>
        storedValue(values, side, symbol)?.value as number
      const [c, ch] = [stored('cartridge'), stored('chamber')]
      expect(value, `${id} ${symbol}`).toBe(Number((ch - c).toFixed(3)))
      if (value < 0) conflicts.push(`${id} ${symbol} ${value}`)
    }
  return count
}

/** A symbol has a region value exactly where both sides store it. */
function checkBothSides(id: string, values: Values) {
  for (const symbol of Object.values(regionSymbols).flat()) {
    const has = regions(values).some((r) => r.values.some((v) => v.symbol === symbol))
    const both = (['cartridge', 'chamber'] as const).every((side) =>
      storedValue(values, side, symbol),
    )
    if (has) expect(both, `${id} ${symbol}`).toBe(true)
  }
}

describe('regions', () => {
  it.each([
    [
      'the 308 Win. differences, no R behind a chamber E',
      'cip-308-win-2008-09-23',
      ['head R1 0.02', 'body P1 0.03', 'shoulder P2 0.03', 'shoulder H1 0.07', 'neck H2 0.02'],
    ],
    [
      'the 300 Win. Mag. belt R3 next to R1',
      'cip-300-win-mag-2002-05-15',
      [
        'head R1 0.08',
        'head R3 0.08',
        'body P1 0.03',
        'shoulder P2 0.03',
        'shoulder H1 0.06',
        'neck H2 0.02',
      ],
    ],
    [
      'the 11,5 x 51 recess at R3 and a zero R1',
      'cip-11-5-x-51-2009-05-05',
      ['head R1 0', 'head R3 0.08', 'body P1 0.03', 'neck H2 0.03'],
    ],
    ['none behind a closed front', 'cip-22-long-shot-2000-06-07', []],
  ])('gives %s', (_, id, expected) => {
    expect(flat(id)).toEqual(expected)
  })

  it('marks the 6 reviewed rim records as conflicts at R', () => {
    for (const id of [
      'cip-22-bb-cap-2000-06-07',
      'cip-22-cb-cap-2000-06-07',
      'cip-22-extra-long-2000-06-07',
      'cip-380-long-rifle-2002-05-15',
      'cip-4-mm-randz-court-2000-06-07',
      'cip-4-mm-randz-long-2000-06-07',
    ]) {
      const head = regions(record(id).values).find((r) => r.name === 'head')
      const R = head?.values.find((v) => v.symbol === 'R')
      expect(R?.value, id).toBeLessThan(0)
      expect(regionText(head as never)).toContain(
        `R ${signedLengthText(R?.value as number)} conflict`,
      )
    }
  })

  it('equals the stored differences over every record and lists the reviewed conflicts', () => {
    const conflicts: string[] = []
    let count = 0
    for (const { id, values } of current) {
      count += checkDifferences(id, values, conflicts)
      checkBothSides(id, values)
    }
    expect(count).toBe(2576)
    // Reviewed: the 6 rim records (chamber R, a minimum, below cartridge R, a maximum), P1 and H2
    // pairs 0.01 to 0.02 mm the wrong way round, and 5,7 mm UCC Voere (table XI, not drawn)
    expect(conflicts).toEqual([
      'cip-22-bb-cap-2000-06-07 R -0.02',
      'cip-22-cb-cap-2000-06-07 R -0.02',
      'cip-22-extra-long-2000-06-07 R -0.02',
      'cip-22-picra-2000-06-07 H2 -0.02',
      'cip-380-long-rifle-2002-05-15 R -0.02',
      'cip-4-mm-randz-court-2000-06-07 R -0.1',
      'cip-4-mm-randz-long-2000-06-07 R -0.1',
      'cip-5-6-x-39-2007-05-14 P1 -0.01',
      'cip-5-7-mm-ucc-voere-1996-06-06 R -0.5',
      'cip-5-7-mm-ucc-voere-1996-06-06 H2 -0.05',
      'cip-510-dtc-2004-09-27 P1 -0.01',
    ])
  })

  it('gives regions on every drawn record with both sides and on no table VII record', () => {
    const drawn = current.filter((r) => drawnTables.has(r.table ?? ''))
    const both = drawn.filter((r) => recordFigures(r)[0]?.drawn.length === 2)
    expect(both.filter((r) => regions(r.values).length === 0).map((r) => r.id)).toEqual([])
    expect(current.filter((r) => r.table === 'VII' && regions(r.values).length)).toEqual([])
  })
})
