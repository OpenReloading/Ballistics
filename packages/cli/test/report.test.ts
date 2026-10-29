import { describe, expect, it } from 'vitest'
import { compare, verify } from '../src/commands.ts'
import { compareTable, verifyTable } from '../src/report.ts'
import { rowsPath } from './data.ts'
import { recordRoots } from './fixture.ts'

const options = { rows: rowsPath, records: recordRoots, split: 'validation', final: false } as const
const line = (text: string, start: string) => text.split('\n').find((l) => l.startsWith(start))

describe('verifyTable', () => {
  it('prints fractions as percent with one decimal and leaves out the not used line when every row is used', async () => {
    const r = await verify(options, 'm3')
    const overall = {
      ...r.overall,
      rows: { ...r.overall.rows, used: 4, inSplit: 4, notUsed: {} },
      velocity: { median: 0.01234, p90: 0.05 },
      pressure: null,
      interval: { coverage: 1 },
    }
    const text = verifyTable({ ...r, overall, byFamily: {}, byPowder: {} })
    expect(text).not.toContain('not used')
    expect(line(text, 'all')?.split(/ +/)).toEqual(['all', '4/4', '1.2', '5.0', '-', '-', '100.0'])
  })
})

describe('compareTable', () => {
  it('signs a change of used rows and of each metric, and prints none as -', async () => {
    const r = await compare(options, 'm3', 'm3')
    const change = (usedRows: number, velocityMedian: number | null) => ({
      ...r.change,
      overall: { ...r.change.overall, usedRows, velocityMedian, velocityP90: -0.0005 },
      byFamily: {},
    })
    const cells = (usedRows: number, velocityMedian: number | null) =>
      line(compareTable({ ...r, change: change(usedRows, velocityMedian) }), 'all')?.split(/ +/)
    expect(cells(3, 0.0123)?.slice(0, 4)).toEqual(['all', '+3', '+1.23', '-0.05'])
    expect(cells(-2, null)?.slice(0, 3)).toEqual(['all', '-2', '-'])
    expect(cells(0, 0)?.slice(0, 3)).toEqual(['all', '0', '0.00'])
  })
})
