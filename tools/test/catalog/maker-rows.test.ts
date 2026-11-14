import { join } from 'node:path'
import { makerRows } from '@rangefoundry/catalog'
import { describe, expect, it } from 'vitest'
import { readRecords, validateRecords } from '../../src/catalog/records.ts'

describe('the committed records', () => {
  it('cite no maker source the public catalog refuses, except the manufacturer records', () => {
    const { bundle, citations, errors } = readRecords()
    expect(errors).toEqual([])
    expect(makerRows(bundle, citations)).toEqual({})
  })
})

describe('validateRecords, the check of data:validate', () => {
  it('refuses what makerRows refuses, which readRecords alone does not', () => {
    const valid = join(import.meta.dirname, 'fixtures', 'valid')
    const finding = `loads/test-load.json: cites source "test-fixture", which counts as a maker's`
    expect(readRecords(valid).errors).not.toContain(finding)
    expect(validateRecords(valid).errors).toContain(finding)
  })
})
