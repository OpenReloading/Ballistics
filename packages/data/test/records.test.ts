import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readLoadTables, readRecords } from '../src/records.ts'

const fixtures = join(import.meta.dirname, 'fixtures')

/** The errors of a copy of the valid fixtures after `change`, which gets the root and a JSON writer. */
function errorsAfter(change: (root: string, write: (path: string, json: object) => void) => void) {
  const root = mkdtempSync(join(tmpdir(), 'records-'))
  cpSync(join(fixtures, 'valid'), root, { recursive: true })
  try {
    change(root, (path, json) => writeFileSync(join(root, path), JSON.stringify(json)))
    return readRecords(root).errors
  } finally {
    rmSync(root, { recursive: true })
  }
}

describe('readRecords', () => {
  const invalid = readRecords(join(fixtures, 'invalid')).errors

  it('reads valid records into a bundle', () => {
    const { bundle, errors } = readRecords(join(fixtures, 'valid'))
    expect(errors).toEqual([])
    expect(bundle.cartridges.map((c) => c.id)).toEqual(['test-cartridge'])
    expect(bundle.manufacturers.map((m) => m.id)).toEqual(['test-manufacturer'])
    expect(bundle.loads.map((l) => l.id)).toEqual(['test-load'])
    expect(bundle.chronoSessions.map((s) => s.id)).toEqual(['test-session'])
    expect(bundle.firings.map((f) => f.id)).toEqual(['test-firing'])
    expect(bundle.rangeFirings.map((r) => r.id)).toEqual(['test-range'])
    expect(bundle.targetFaces.map((f) => f.id)).toEqual(['test-face'])
    expect(bundle.federations.map((f) => f.id)).toEqual(['test-federation'])
    expect(bundle.disciplines.map((d) => d.id)).toEqual(['test-discipline'])
    expect(bundle.targetMappings.map((m) => m.id)).toEqual(['test-discipline-test-face'])
  })

  it('reports invalid JSON, id mismatches, unknown references and missing directories', () => {
    const errors = invalid
    expect(errors.some((e) => e.startsWith('chrono/broken.json: invalid JSON'))).toBe(true)
    expect(errors).toContain('loads/other-name.json: id "test-load" does not match the file name')
    expect(errors).toContain('loads/test-load.json: unknown cartridge "catalogue:test-cartridge"')
    expect(errors).toContain('chrono/test-session.json: unknown load "catalogue:missing-load"')
    expect(errors).toContain('firings/test-firing.json: unknown cartridge "missing-cartridge"')
    expect(errors).toContain('range/test-range-b.json: round 1(b)* is also in test-range-a')
    expect(errors).toContain(
      'disciplines/test-discipline.json: unknown federation "missing-federation"',
    )
    expect(errors).toContain(
      'target-mappings/test-mapping.json: unknown discipline "missing-discipline"',
    )
    expect(errors).toContain('target-mappings/test-mapping.json: unknown face "missing-face"')
    expect(errors).toContain('disciplines/test-discipline.json: no target mapping names it')
    expect(errors).toContain('bullets/: missing directory')
    expect(errors).toContain('powders/: missing directory')
    expect(errors).not.toContain('cartridges/: missing directory')
  })

  it('reports duplicate values, unacknowledged findings and stale exceptions', () => {
    const where = 'cartridges/broken-cartridge.json'
    const spec = invalid.filter((e) => e.startsWith(where))
    expect(spec).toContain(`${where}: duplicate value cartridge P1 -`)
    expect(spec).toContain(
      `${where}: diameter-fit:P1: cartridge P1 = 12.1 mm exceeds chamber P1 = 12 mm`,
    )
    expect(spec).toContain(`${where}: exception "pk-ratio" no longer applies; remove it`)
  })

  it('reports a load that names a missing bullet or powder, or a user record', () => {
    const provenance = { kind: 'published', sources: [{ title: 'Test' }] }
    const load = {
      id: 'by-reference',
      origin: 'catalogue',
      name: 'By reference',
      cartridge: 'catalogue:test-cartridge',
      bullet: 'catalogue:missing-bullet',
      powder: 'catalogue:missing-powder',
      charge: { value: 3 },
      provenance,
    }
    const errors = errorsAfter((_root, write) => {
      write('loads/by-reference.json', load)
      write('loads/by-user.json', {
        ...load,
        id: 'by-user',
        cartridge: 'user:3f1c2b4e-9a7d-4c1e-8b25-6d0f4a9e7c13',
      })
    })
    expect(errors).toContain('loads/by-reference.json: unknown bullet "catalogue:missing-bullet"')
    expect(errors).toContain('loads/by-reference.json: unknown powder "catalogue:missing-powder"')
    expect(errors).toContain(
      'loads/by-user.json: cartridge: A catalogue load names catalogue records only',
    )
  })

  it('reports a load whose capacity is no record', () => {
    const errors = errorsAfter((_root, write) => {
      write('loads/with-capacity.json', {
        id: 'with-capacity',
        origin: 'catalogue',
        name: 'With capacity',
        cartridge: 'catalogue:test-cartridge',
        bullet: 'catalogue:test-bullet',
        powder: 'catalogue:test-powder',
        capacity: 'catalogue:missing-capacity',
        charge: { value: 3 },
        provenance: { kind: 'published', sources: [{ title: 'Test' }] },
      })
    })
    expect(errors).toContain(
      'loads/with-capacity.json: unknown capacity "catalogue:missing-capacity"',
    )
  })

  it('accepts the committed records', () => {
    expect(readRecords().errors).toEqual([])
  })

  it('reports an unknown or missing manufacturer of a powder, a case capacity and a load table', () => {
    const provenance = { kind: 'published', sources: [{ title: 'Test' }] }
    const errors = errorsAfter((_root, write) => {
      write('powders/test-powder.json', {
        id: 'test-powder',
        manufacturer: 'missing-manufacturer',
        name: 'Test',
        provenance,
      })
      write('capacities/test-capacity.json', {
        id: 'test-capacity',
        origin: 'catalogue',
        cartridge: 'catalogue:test-cartridge',
        waterCapacity: { value: 3.5 },
        caseManufacturer: 'catalogue:missing-case-manufacturer',
        provenance,
      })
      write('load-tables.json', {
        'test.csv': {
          manufacturer: 'missing-table-manufacturer',
          title: 'T',
          retrieved: '2026-01-01',
        },
      })
    })
    expect(errors).toContain(
      'powders/test-powder.json: unknown manufacturer "missing-manufacturer"',
    )
    expect(errors).toContain(
      'capacities/test-capacity.json: unknown caseManufacturer "missing-case-manufacturer"',
    )
    expect(errors).toContain(
      'load-tables.json: test.csv: unknown manufacturer "missing-table-manufacturer"',
    )
  })

  it('reports a chronograph device whose manufacturer is no record', () => {
    const errors = errorsAfter((root) => {
      const path = join(root, 'chrono', 'test-session.json')
      const session = JSON.parse(readFileSync(path, 'utf8'))
      session.device.manufacturer = 'catalogue:missing-device-maker'
      writeFileSync(path, JSON.stringify(session))
    })
    expect(errors).toContain(
      'chrono/test-session.json: unknown device.manufacturer "missing-device-maker"',
    )
  })

  it('reports a load whose bullet, powder, primer or case maker is no record', () => {
    const errors = errorsAfter((root) => {
      const path = join(root, 'loads', 'test-load.json')
      const l = JSON.parse(readFileSync(path, 'utf8'))
      for (const k of ['bullet', 'powder', 'primer', 'case'])
        l[k].manufacturer = `catalogue:missing-${k}-maker`
      writeFileSync(path, JSON.stringify(l))
    })
    for (const k of ['bullet', 'powder', 'primer', 'case'])
      expect(errors).toContain(
        `loads/test-load.json: unknown ${k}.manufacturer "missing-${k}-maker"`,
      )
  })

  it('resolves source references with the parts of the record', () => {
    const { bundle } = readRecords(join(fixtures, 'valid'))
    expect(bundle.federations[0]?.ruleBooks[0]).toEqual({
      title: 'Test rule book',
      edition: '2026',
      url: 'https://example.org/rules.pdf',
      sha256: '0'.repeat(64),
    })
    expect(bundle.disciplines[0]?.provenance.sources[0]).toMatchObject({
      title: 'Test rule book',
      edition: '2026',
      note: 'Discipline note. Rule book note.',
    })
  })

  it('reports unknown, uncited and shared embedded sources and mixed references', () => {
    const errors = errorsAfter((root, write) => {
      const path = join(root, 'chrono', 'test-session.json')
      const session = JSON.parse(readFileSync(path, 'utf8'))
      session.provenance.sources = [
        { source: 'missing-source' },
        { source: 'test-fixture', title: 'X' },
      ]
      writeFileSync(path, JSON.stringify(session))
      write('sources/uncited.json', { id: 'uncited', title: 'Uncited' })
      const provenance = { kind: 'published', sources: [{ title: 'Shared' }] }
      write('manufacturers/a.json', { id: 'a', name: 'A', provenance })
      write('manufacturers/b.json', { id: 'b', name: 'B', provenance })
    })
    expect(errors).toContain(
      'chrono/test-session.json: provenance.sources.0: unknown source "missing-source"',
    )
    expect(errors).toContain(
      'chrono/test-session.json: provenance.sources.1: Unrecognized key: "title"',
    )
    expect(errors).toContain('sources/uncited.json: no record cites it')
    expect(errors).toContain(
      'manufacturers/a.json: source also in manufacturers/b.json, make it a source record',
    )
  })

  it('reports a finding of a non-spec record with file and rule', () => {
    const errors = errorsAfter((root) => {
      const path = join(root, 'chrono', 'test-session.json')
      const session = JSON.parse(readFileSync(path, 'utf8'))
      session.conditions.relativeHumidity = { value: 120 }
      writeFileSync(path, JSON.stringify(session))
    })
    expect(errors).toEqual([
      'chrono/test-session.json: humidity-range: relative humidity 120 % is outside 0 to 100 %',
    ])
  })
})

describe('readLoadTables', () => {
  const read = (file: unknown) => {
    const dir = mkdtempSync(join(tmpdir(), 'load-tables-'))
    try {
      writeFileSync(join(dir, 'load-tables.json'), JSON.stringify(file))
      const errors: string[] = []
      const tables = readLoadTables(dir, errors)
      let thrown: string | undefined
      try {
        readLoadTables(dir)
      } catch (e) {
        thrown = (e as Error).message
      }
      return { errors, tables, thrown }
    } finally {
      rmSync(dir, { recursive: true })
    }
  }
  const table = {
    manufacturer: 'example',
    title: 'T',
    url: 'https://example.com',
    retrieved: '2026-01-01',
  }

  it('keeps the entries that match the schema and reports the others by row file and field', () => {
    const { errors, tables, thrown } = read({
      'good.csv': table,
      'no-maker.csv': { title: 'O', retrieved: '2026-01-01' },
      'extra.csv': { ...table, maker: 'example' },
      'bad-date.csv': { ...table, retrieved: 'January' },
      'bad-url.csv': { ...table, url: 'not a url' },
      'bad-id.csv': { ...table, manufacturer: 'Example Inc' },
    })
    expect(Object.keys(tables)).toEqual(['good.csv'])
    expect(errors.map((e) => e.split(': ').slice(0, 2).join(': '))).toEqual([
      'load-tables.json: no-maker.csv.manufacturer',
      'load-tables.json: extra.csv',
      'load-tables.json: bad-date.csv.retrieved',
      'load-tables.json: bad-url.csv.url',
      'load-tables.json: bad-id.csv.manufacturer',
    ])
    expect(thrown).toContain('load-tables.json: no-maker.csv.manufacturer')
  })

  it('rejects a file that is no object of tables', () => {
    expect(read([table]).errors).toEqual(['load-tables.json: not an object of tables by row file'])
  })

  it('names load-tables.json when it is not JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'load-tables-'))
    try {
      writeFileSync(join(dir, 'load-tables.json'), '{ "a": ')
      expect(() => readLoadTables(dir)).toThrow(`${join(dir, 'load-tables.json')}: invalid JSON`)
    } finally {
      rmSync(dir, { recursive: true })
    }
  })
})
