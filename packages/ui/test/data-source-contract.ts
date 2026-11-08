import { expect, it } from 'vitest'
import type { DataSource } from '../src/index.ts'

/** A row of the contract's fixture: a name and a number per row. */
export type ContractRow = { name: string; weight: number }

/** The fixture, in the order a source receives it. */
const contractRows: ContractRow[] = [
  { name: 'Hornady', weight: 168 },
  { name: 'Sierra', weight: 155 },
  { name: 'Berger', weight: 168 },
  { name: 'Lapua', weight: 185 },
  { name: 'Barnes', weight: 150 },
]

/**
 * The behavior every data source shares, for a source made from `contractRows` that filters `weight` by equality and
 * sorts by `name` and `weight`. The device's index and the catalog read in chunks (W7) are to run it as well; it
 * moves to a package they can import when the first of them lands.
 */
export function dataSourceContract(make: (rows: ContractRow[]) => DataSource<ContractRow>): void {
  const all = { start: 0, count: 100 }
  const names = (rows: readonly ContractRow[]) => rows.map((row) => row.name)

  it('counts every row that passes the filters and returns the range of them', async () => {
    const page = await make(contractRows).query({
      filters: [{ id: 'weight', value: 168 }],
      sorting: [],
      range: { start: 1, count: 5 },
    })
    expect(page).toEqual({ rows: [{ name: 'Berger', weight: 168 }], total: 2 })
  })

  it('sorts by each key in turn, keeping the given order of equal rows', async () => {
    const page = await make(contractRows).query({
      filters: [],
      sorting: [{ id: 'weight', desc: true }],
      range: all,
    })
    expect(names(page.rows)).toEqual(['Lapua', 'Hornady', 'Berger', 'Sierra', 'Barnes'])
    const twoKeys = await make(contractRows).query({
      filters: [],
      sorting: [
        { id: 'weight', desc: false },
        { id: 'name', desc: false },
      ],
      range: all,
    })
    expect(names(twoKeys.rows)).toEqual(['Barnes', 'Sierra', 'Berger', 'Hornady', 'Lapua'])
  })

  it('returns no rows past the end, with the total still counted', async () => {
    const page = await make(contractRows).query({
      filters: [],
      sorting: [],
      range: { start: 5, count: 3 },
    })
    expect(page).toEqual({ rows: [], total: 5 })
  })

  it('refuses a range with a negative or fractional start or count', async () => {
    for (const range of [
      { start: -3, count: 2 },
      { start: 0.5, count: 2 },
      { start: 0, count: -1 },
    ]) {
      await expect(make(contractRows).query({ filters: [], sorting: [], range })).rejects.toThrow(
        RangeError,
      )
    }
  })

  it('refuses an aborted query', async () => {
    const query = { filters: [], sorting: [], range: all }
    await expect(make(contractRows).query(query, AbortSignal.abort())).rejects.toThrow()
  })
}
