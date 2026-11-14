import { expect, it } from 'vitest'
import type { DataSource } from '../src/index.ts'

/** A row of the contract's fixture: text, a number, and a column of mixed keys. */
export type ContractRow = { name: string; weight: number; code: number | string }

/** The fixture, in the order a source receives it; its names sort differently by code unit and by the collation. */
const contractRows: ContractRow[] = [
  { name: 'Hornady', weight: 168, code: 3 },
  { name: 'Sierra', weight: 155, code: 'b' },
  { name: 'berger', weight: 168, code: Number.NaN },
  { name: 'Lapua', weight: 185, code: 'a' },
  { name: 'Barnes', weight: 150, code: 1 },
  { name: 'Nosler 10', weight: 175, code: 'item 10' },
  { name: 'Nosler 2', weight: 175, code: 'item 2' },
]

/** The behavior every data source shares, for a source made from `contractRows` that filters a column by equality and sorts by each column's value; the device's index and the catalog read in chunks (W7) are to run it too, and it moves to a package they can import when the first of them lands. */
export function dataSourceContract(make: (rows: ContractRow[]) => DataSource<ContractRow>): void {
  const all = { start: 0, count: 100 }
  const sortedNames = async (sorting: { id: string; desc: boolean }[]) =>
    (await make(contractRows).query({ filters: [], sorting, range: all })).rows.map(
      (row) => row.name,
    )

  it('sorts by each key in turn, keeping the given order of equal rows', async () => {
    expect(await sortedNames([{ id: 'weight', desc: true }])).toEqual([
      'Lapua',
      'Nosler 10',
      'Nosler 2',
      'Hornady',
      'berger',
      'Sierra',
      'Barnes',
    ])
  })

  it('sorts text by the shared collation: letters before case, numbers in text by value', async () => {
    expect(
      await sortedNames([
        { id: 'weight', desc: false },
        { id: 'name', desc: false },
      ]),
    ).toEqual(['Barnes', 'Sierra', 'berger', 'Hornady', 'Nosler 2', 'Nosler 10', 'Lapua'])
  })

  it('sorts a column of mixed keys in one order: numbers by value, NaN after them, then text', async () => {
    expect(await sortedNames([{ id: 'code', desc: false }])).toEqual([
      'Barnes',
      'Hornady',
      'berger',
      'Lapua',
      'Sierra',
      'Nosler 2',
      'Nosler 10',
    ])
  })

  rangeContract(make)
}

/** The ranges and refusals of the contract. */
function rangeContract(make: (rows: ContractRow[]) => DataSource<ContractRow>): void {
  it('counts every row that passes the filters and returns the range of them', async () => {
    const page = await make(contractRows).query({
      filters: [{ id: 'weight', value: 168 }],
      sorting: [],
      range: { start: 1, count: 5 },
    })
    expect(page).toEqual({ rows: [{ name: 'berger', weight: 168, code: Number.NaN }], total: 2 })
  })

  it('returns no rows past the end, with the total still counted', async () => {
    const page = await make(contractRows).query({
      filters: [],
      sorting: [],
      range: { start: 7, count: 3 },
    })
    expect(page).toEqual({ rows: [], total: 7 })
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
    const query = { filters: [], sorting: [], range: { start: 0, count: 100 } }
    await expect(make(contractRows).query(query, AbortSignal.abort())).rejects.toHaveProperty(
      'name',
      'AbortError',
    )
  })
}
