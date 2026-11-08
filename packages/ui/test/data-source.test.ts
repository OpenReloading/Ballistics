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

  it('answers a new query with new filters, also when their values look alike as JSON', async () => {
    const source = arraySource([150, 168, 175], {
      matches: (weight, _, value) => value instanceof Set && value.has(weight),
      sortKey: (weight) => weight,
    })
    const range = { start: 0, count: 10 }
    await source.query({ filters: [{ id: 'weight', value: new Set([168]) }], sorting: [], range })
    const page = await source.query({
      filters: [{ id: 'weight', value: new Set([175]) }],
      sorting: [],
      range,
    })
    expect(page.rows).toEqual([175])
  })
})
