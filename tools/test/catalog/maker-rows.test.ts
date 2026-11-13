import { makerRows } from '@rangefoundry/catalog'
import { describe, expect, it } from 'vitest'
import { readRecords } from '../../src/catalog/records.ts'

describe('the committed records', () => {
  it('cite no maker source the public catalog refuses, except the manufacturer records', () => {
    const { bundle, citations, errors } = readRecords()
    expect(errors).toEqual([])
    expect(makerRows(bundle, citations)).toEqual({})
  })
})
