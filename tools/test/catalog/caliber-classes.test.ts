import { describe, expect, it } from 'vitest'
import { readRecords } from '../../src/catalog/records.ts'

describe('the caliber class records', () => {
  const { bundle, errors } = readRecords()
  it('are valid against the C.I.P. records and every discipline', () => {
    expect(errors).toEqual([])
    expect(bundle.caliberClasses.length).toBeGreaterThan(0)
  })
})
