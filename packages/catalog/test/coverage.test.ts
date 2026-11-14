import type { Provenance } from '@rangefoundry/schema'
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

  it('asks a source for each data field of a kind without field classes, also without provenance', () => {
    const record = { id: 'x', name: 'X', mass: { value: 1 }, provenance: undefined }
    expect(checkCoverage(record)).toEqual(['field mass has no source'])
    const bare = { id: 'x', name: 'X', provenance: undefined }
    expect(checkCoverage(bare)).toEqual([])
  })
})

describe('checkCoverage by field class', () => {
  const basicBullet = {
    id: 'x',
    manufacturer: 'm',
    name: 'X',
    mass: { value: 10 },
    construction: { raw: 'Jacketed', structure: 'jacketed' },
    provenance: undefined,
  }

  it('asks no source for basic fields, and one for each detailed field also without provenance', () => {
    expect(checkCoverage(basicBullet, 'bullet')).toEqual([])
    const withOgive = { ...basicBullet, ogive: { form: 'tangent', radius: { value: 20 } } }
    expect(checkCoverage(withOgive, 'bullet')).toEqual([
      'field ogive.form has no source',
      'field ogive.radius has no source',
    ])
    const sheet = provenance([{ title: 'Sheet', fields: ['ogive'] }])
    expect(checkCoverage({ ...withOgive, provenance: sheet }, 'bullet')).toEqual([])
  })

  it('asks a source for a detailed field below a basic one, and for a powder interior', () => {
    const jacket = { raw: 'Jacketed', jacket: { thickness: { value: 0.3 } } }
    const sheet = provenance([{ title: 'Sheet', fields: ['mass'] }])
    const jacketed = { ...basicBullet, construction: jacket, provenance: sheet }
    expect(checkCoverage(jacketed, 'bullet')).toEqual([
      'field construction.jacket.thickness has no source',
    ])
    const powder = {
      id: 'p',
      name: 'P',
      interior: { vivacity: { value: 1 } },
      provenance: undefined,
    }
    expect(checkCoverage(powder, 'powder')).toEqual(['field interior.vivacity has no source'])
  })

  it('asks no source for a manufacturer', () => {
    const maker = { id: 'm', name: 'M', country: 'US', provenance: undefined }
    expect(checkCoverage(maker, 'manufacturer')).toEqual([])
  })
})

describe('checkCoverage of construction and geometry', () => {
  it('asks a source for each new construction field, and takes the construction path as covering them', () => {
    const construction = {
      raw: 'x',
      structure: 'cast',
      core: { material: 'lead-alloy', hardness: { value: 12 } },
      jacket: { thickness: { value: 0.3 } },
      gasCheck: true,
    }
    const record = (fields: string[]) => ({
      id: 'x',
      name: 'X',
      construction,
      provenance: provenance([{ title: 'S', fields }]),
    })
    expect(checkCoverage(record(['construction']))).toEqual([])
    expect(checkCoverage(record(['construction.structure', 'construction.core']))).toEqual([
      'field construction.raw has no source',
      'field construction.jacket.thickness has no source',
      'field construction.gasCheck has no source',
    ])
    expect(checkCoverage(record(['construction.drivingBands']))).toContain(
      'source "S" names missing field construction.drivingBands',
    )
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
      { title: 'Photograph', kind: 'measured', fields: ['meplatDiameters'] },
    ])
    expect(checkCoverage({ ...record, provenance: mistyped })).toEqual([
      'source "Photograph" names missing field meplatDiameters',
      'field meplatDiameter has no source',
    ])
  })
})

describe('checkCoverage findings', () => {
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
