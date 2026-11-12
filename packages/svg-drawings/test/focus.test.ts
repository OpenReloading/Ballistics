import { describe, expect, it } from 'vitest'
import { recordFigures } from '../src/cartridge/figures.ts'
import { rowId } from '../src/cartridge/focus.ts'
import { sheet, sheets, undimensionedValues } from './sheets.ts'

const record = sheet

describe('rowId', () => {
  it('keeps letters, digits and hyphens, the variant last', () => {
    expect(rowId('cip-x', 'cartridge', 'delta L')).toBe('cip-x-cartridge-delta-L')
    expect(rowId('cip-x', 'cartridge', 'L1+G')).toBe('cip-x-cartridge-L1-G')
    expect(rowId('cip-12', 'chamber', 'L', '12/70')).toBe('cip-12-chamber-L-12-70')
  })

  it('is unique per dimension row of every record', () => {
    const doubled: string[] = []
    for (const { id, values } of sheets) {
      const ids = values.flatMap((v) => (v.side ? [rowId(id, v.side, v.symbol, v.variant)] : []))
      doubled.push(...ids.filter((x, k) => ids.indexOf(x) !== k))
    }
    expect(doubled).toEqual([])
  })
})

describe('notDrawn', () => {
  it('lists the 308 Win. values the figure does not dimension', () => {
    const r = record('cip-308-win-2008-09-23')
    const list = [...undimensionedValues(r.values, recordFigures(r))].map(
      (v) => `${v.side} ${v.symbol}`,
    )
    expect(list).toEqual([
      'cartridge L3+G',
      'cartridge Fe',
      'cartridge delta L',
      'chamber Z',
      'chamber b',
      'chamber N',
      'chamber u',
      'chamber Q',
    ])
  })
})
