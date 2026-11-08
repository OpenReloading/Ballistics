import { describe } from 'vitest'
import { arraySource } from '../src/index.ts'
import { type ContractRow, dataSourceContract } from './data-source-contract.ts'

describe('arraySource', () => {
  dataSourceContract((rows) =>
    arraySource(rows, {
      matches: (row, id, value) => row[id as keyof ContractRow] === value,
      sortKey: (row, id) => row[id as keyof ContractRow],
    }),
  )
})
