import type { Provenance } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { checkCoverage } from '../src/coverage.ts'

const provenance = (sources: Provenance['sources']): Provenance => ({ kind: 'published', sources })

describe('checkCoverage', () => {
  it('accepts a record whose source has no field list', () => {
    const record = {
      id: 'x',
      name: 'X',
      mass: { value: 1 },
      provenance: provenance([{ title: 'S' }]),
    }
    expect(checkCoverage(record)).toEqual([])
  })

  it('accepts fields covered by a source or a parent path', () => {
    const record = {
      id: 'x',
      name: 'X',
      mass: { value: 1 },
      base: { type: 'flat', length: { value: 2 } },
      provenance: provenance([{ title: 'S', fields: ['mass', 'base'] }]),
    }
    expect(checkCoverage(record)).toEqual([])
  })

  it('accepts a measured geometry value covered by its own source and reports a mistyped path', () => {
    const record = {
      id: 'x',
      name: 'X',
      diameter: { value: 7.8 },
      mass: { value: 10 },
      meplatDiameter: { value: 1.6 },
      provenance: provenance([
        { title: 'Data sheet', fields: ['diameter', 'mass'] },
        { title: 'Photograph', kind: 'measured', fields: ['meplatDiameter'] },
      ]),
    }
    expect(checkCoverage(record)).toEqual([])
    const mistyped = provenance([
      { title: 'Data sheet', fields: ['diameter', 'mass'] },
      { title: 'Photograph', kind: 'measured', fields: ['meplatDiamter'] },
    ])
    expect(checkCoverage({ ...record, provenance: mistyped })).toEqual([
      'source "Photograph" names missing field meplatDiamter',
      'field meplatDiameter has no source',
    ])
  })

  it('reports fields without a source and source fields that do not exist', () => {
    const record = {
      id: 'x',
      name: 'X',
      mass: { value: 1 },
      length: { value: 2 },
      provenance: provenance([{ title: 'S', fields: ['mass', 'diameter'] }]),
    }
    expect(checkCoverage(record)).toEqual([
      'source "S" names missing field diameter',
      'field length has no source',
    ])
  })

  it('reports a powder form, base or alias that no source names', () => {
    const record = {
      id: 'x',
      manufacturer: 'm',
      name: 'X',
      aliases: ['M Y'],
      form: 'ball',
      base: 'double',
      provenance: provenance([
        { title: 'Product page', fields: ['name', 'form'] },
        { title: 'Guide', fields: ['aliases'] },
      ]),
    }
    expect(checkCoverage(record)).toEqual(['field base has no source'])
    const pageOnly = provenance([{ title: 'Product page', fields: ['name', 'base'] }])
    expect(checkCoverage({ ...record, provenance: pageOnly })).toEqual([
      'field aliases has no source',
      'field form has no source',
    ])
  })
})
