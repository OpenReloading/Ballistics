import { describe, expect, it } from 'vitest'
import { arraySource } from '../src/index.ts'
import { type ContractRow, dataSourceContract } from './data-source-contract.ts'

describe('arraySource', () => {
  dataSourceContract((rows) =>
    arraySource(rows, {
      matches: (row, id, value) => row[id as keyof ContractRow] === value,
      sortKey: (row, id) => row[id as keyof ContractRow],
    }),
  )

  it('sorts a column of mixed keys in one order: numbers by value, NaN after them, then text', async () => {
    const keys = ['b', 3, Number.NaN, 'a', 1, 'item 10', 'item 2']
    const source = arraySource(keys, { matches: () => true, sortKey: (key) => key })
    const page = await source.query({
      filters: [],
      sorting: [{ id: 'key', desc: false }],
      range: { start: 0, count: 10 },
    })
    expect(page.rows).toEqual([1, 3, Number.NaN, 'a', 'b', 'item 2', 'item 10'])
  })
})
