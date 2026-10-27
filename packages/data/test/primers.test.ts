import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readRecords } from '../src/records.ts'

const fixtures = join(import.meta.dirname, 'fixtures', 'valid')
const record = {
  id: 'other-primer',
  manufacturer: 'test-manufacturer',
  name: 'Other primer',
  size: 'small-pistol',
  compound: 'lead-free',
  provenance: {
    kind: 'published',
    sources: [{ title: 'Test catalogue', fields: ['size', 'compound'] }],
  },
}

/** The result of reading a copy of the valid fixtures after `change` edited it. */
function readAfter(change: (root: string, write: (path: string, json: object) => void) => void) {
  const root = mkdtempSync(join(tmpdir(), 'primers-'))
  cpSync(fixtures, root, { recursive: true })
  try {
    change(root, (path, json) => writeFileSync(join(root, path), JSON.stringify(json)))
    return readRecords(root)
  } finally {
    rmSync(root, { recursive: true })
  }
}

describe('primer records', () => {
  it('reads a valid record into the bundle', () => {
    const { bundle, errors } = readAfter((_r, write) => write('primers/other-primer.json', record))
    expect(errors).toEqual([])
    expect(bundle.primers.map((p) => p.id)).toEqual(['other-primer', 'test-primer'])
  })

  it('reports a schema break, an unknown manufacturer and a field without a source', () => {
    const { errors } = readAfter((_r, write) => {
      write('primers/other-primer.json', { ...record, size: 'medium' })
      write('primers/third-primer.json', {
        ...record,
        id: 'third-primer',
        name: 'Third',
        manufacturer: 'missing-maker',
        provenance: { ...record.provenance, sources: [{ title: 'Test', fields: ['size'] }] },
      })
    })
    expect(errors.some((e) => e.startsWith('primers/other-primer.json: size:'))).toBe(true)
    expect(errors).toContain('primers/third-primer.json: unknown manufacturer "missing-maker"')
    expect(errors).toContain('primers/third-primer.json: field compound has no source')
  })

  it('reports a load that names a primer that is no record and accepts a renamed one', () => {
    const point = (primer: string) => (root: string) => {
      const path = join(root, 'loads', 'test-load.json')
      writeFileSync(
        path,
        JSON.stringify({ ...JSON.parse(readFileSync(path, 'utf8')), primer: { record: primer } }),
      )
    }
    expect(readAfter(point('catalogue:missing-primer')).errors).toEqual([
      'loads/test-load.json: unknown primer "catalogue:missing-primer"',
    ])
    expect(
      readAfter((root, write) => {
        point('catalogue:old-primer')(root)
        write('renames.json', { primers: { 'old-primer': 'test-primer' } })
      }).errors,
    ).toEqual([])
  })
})
