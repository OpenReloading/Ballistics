import type { Powder, Source } from '@openreloading/schema'
import { describe, expect, it } from 'vitest'
import { checkFittedSources, type LoadTables } from '../src/load-tables.ts'

const loadTables: LoadTables = {
  'example-2026': {
    manufacturer: 'example',
    title: 'Example load table, 2026',
    url: 'https://example.com/loads',
    retrieved: '2026-01-01',
  },
}
const table = loadTables['example-2026']
const fitted: Source = {
  title: table.title,
  url: table.url,
  retrieved: table.retrieved,
  fields: ['interior'],
  kind: 'fitted',
  run: { version: 'a'.repeat(16), report: 'fit.md' },
}
const product: Source = { title: 'Product page', fields: ['name', 'form'] }
// only provenance and the presence of interior are read; the interior values are not checked here
const powder = (...sources: Source[]) =>
  ({ id: 'test', interior: {}, provenance: { kind: 'published', sources } }) as unknown as Powder

describe('checkFittedSources', () => {
  it('accepts a listed load table with its fit run', () => {
    expect(checkFittedSources(powder(product, fitted), loadTables)).toEqual([])
  })

  it('fails every other source for interior', () => {
    const fails = (s: Source) => checkFittedSources(powder(product, s), loadTables).length > 0
    expect(fails({ ...fitted, kind: 'published' })).toBe(true)
    expect(fails({ ...fitted, fields: undefined })).toBe(true)
    expect(fails({ ...fitted, title: 'Unlisted load tables' })).toBe(true)
    expect(fails({ ...fitted, url: 'https://example.com/tables' })).toBe(true)
    expect(fails({ ...fitted, run: undefined })).toBe(true)
    expect(fails({ title: 'Whole record', note: 'no fields' })).toBe(true)
    expect(fails({ ...fitted, fields: ['interior', 'bulkDensity'] })).toBe(true)
  })

  it('fails a non-fitted source for an interior sub-field', () => {
    expect(
      checkFittedSources(
        powder(product, { title: 'Notes', fields: ['interior.vivacity'] }),
        loadTables,
      ),
    ).toEqual([
      'source 1 ("Notes") supports interior but is not fitted',
      'interior without a fitted source',
    ])
  })

  it('fails interior without any fitted source', () => {
    expect(checkFittedSources(powder(product), loadTables)).toEqual([
      'interior without a fitted source',
    ])
  })

  it('fails a fitted source on a record without interior', () => {
    const p = { ...powder(fitted), interior: undefined } as Powder
    expect(checkFittedSources(p, loadTables)).toEqual([
      `source 0 ("${table.title}"): fitted source without interior`,
    ])
  })
})
