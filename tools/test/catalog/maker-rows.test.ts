import { type Bundle, makerRows } from '@rangefoundry/catalog'
import { describe, expect, it } from 'vitest'
import { readRecords } from '../../src/catalog/records.ts'

const bundleOf = (parts: object) => parts as unknown as Bundle

describe('the committed records', () => {
  it('cite no manufacturer source, except the manufacturer records', () => {
    const { bundle, publishedLoads, errors } = readRecords()
    expect(errors).toEqual([])
    // a published loads file cites its sources once for all its loads
    expect(makerRows(bundleOf({ ...bundle, publishedLoads }))).toEqual({})
  })
})
