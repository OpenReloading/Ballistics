import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { PublishedLoads } from '@open-reloading/schema'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  formatRecord,
  main,
  mergeLoadFolder,
  parseMergeArgs,
  reportLines,
} from '../src/merge-loads.ts'
import {
  type IncomingLoad,
  type IncomingLoads,
  loadId,
  mergePublishedLoads,
  withLoadIds,
} from '../src/published-load-merge.ts'
import { readRecords } from '../src/records.ts'
import { defined } from './defined.ts'

// Test data, not maker data: a made-up table of the test manufacturer for the test cartridge.

/** Two editions of the made-up table. */
const edition = (year: number) => ({
  title: `Test Manufacturer load table ${year}`,
  publisher: 'Test Manufacturer',
  url: `https://example.org/table-${year}.pdf`,
  retrieved: `${year}-01-01`,
  origin: 'manufacturer' as const,
})

/** A made-up load: `bullet` text, `powder` text and a max charge `grains` with its printed text. */
const load = (
  bullet: string,
  powder: string,
  grains: string,
  extra: Partial<IncomingLoad> = {},
): IncomingLoad => ({
  bullet: { printed: bullet, mass: { value: 7.970266, raw: '123 gr' } },
  powder: { printed: powder },
  charges: [
    {
      kind: 'max',
      charge: { value: Number((Number(grains) * 0.06479891).toPrecision(7)), raw: `${grains} gr` },
    },
  ],
  page: '1',
  ...extra,
})

const table = (loads: IncomingLoad[], year = 2025): IncomingLoads => ({
  id: 'test-manufacturer',
  maker: 'test-manufacturer',
  producedBy: 'maker',
  cartridgeName: 'Test cartridge',
  cartridge: 'catalogue:test-cartridge',
  loads,
  provenance: { kind: 'published', sources: [edition(year)] },
})

const a = load('FMJ', 'Powder A', '30.0')
const b = load('FMJ', 'Powder B', '28.0')

describe('loadId', () => {
  it('is 10 hex digits that leave out edition, page, charge, velocity, pressure, primer and case', () => {
    const file = table([a])
    const id = loadId(file, a)
    expect(id).toMatch(/^[0-9a-f]{10}$/)
    const other = load('FMJ', 'Powder A', '31.5', {
      page: '7',
      primer: { printed: 'Test primer' },
      case: 'Test case',
    })
    expect(loadId(table([other], 2026), other)).toBe(id)
  })

  it('differs by bullet, powder, COAL, charge kinds, barrel and marks', () => {
    const file = table([a])
    const id = loadId(file, a)
    const charge = defined(a.charges[0])
    for (const l of [
      load('HP', 'Powder A', '30.0'),
      load('FMJ', 'Powder C', '30.0'),
      { ...a, coal: { value: 70, raw: '70 mm' } },
      { ...a, coal: { value: 70, raw: '70 mm', limit: 'min' as const } },
      { ...a, charges: [{ ...charge, kind: 'start' as const }, charge] },
      { ...a, barrel: { length: { value: 609.6, raw: '24"' } } },
      { ...a, charges: [{ ...charge, printedMarks: ['*'] }] },
      { ...a, charges: [{ ...charge, marks: ['compressed' as const] }] },
    ])
      expect(loadId(file, l)).not.toBe(id)
    expect(loadId({ ...file, maker: 'other' }, a)).not.toBe(id)
    expect(loadId({ ...file, cartridge: 'catalogue:other' }, a)).not.toBe(id)
  })

  it('counts loads of equal key in printed order', () => {
    const twice = withLoadIds(table([a, b, load('FMJ', 'Powder A', '29.0')]))
    const id = loadId(twice, a)
    expect(twice.loads.map((l) => l.id)).toEqual([id, loadId(twice, b), `${id}-2`])
  })
})

describe('mergePublishedLoads', () => {
  const first = mergePublishedLoads(undefined, table([a, b]), new Set()).file

  it('creates the loads of a new file, sorted by id, citing the incoming source', () => {
    const { file, report, written } = mergePublishedLoads(undefined, table([b, a]), new Set())
    const ids = [loadId(file, a), loadId(file, b)].sort()
    expect(written).toBe(true)
    expect(report).toEqual({ created: ids, changed: [], unchanged: [], absent: [] })
    expect(file.loads.map((l) => l.id)).toEqual(ids)
    expect(file.provenance.sources).toEqual([edition(2025)])
    expect(file.loads.every((l) => l.source === undefined)).toBe(true)
  })

  it('reports a second run of the same input as unchanged and writes nothing', () => {
    const again = mergePublishedLoads(first, table([a, b]), 'all')
    expect(again.written).toBe(false)
    expect(again.file).toBe(first)
    expect(again.report.created).toEqual([])
    expect(again.report.changed).toEqual([])
    expect(again.report.unchanged).toHaveLength(2)
  })

  it('keeps an unchanged load of a newer edition citing the edition and page that printed it', () => {
    const moved = load('FMJ', 'Powder A', '30.0', { page: '9' })
    const { file, report } = mergePublishedLoads(first, table([moved, b], 2026), 'all')
    expect(report.unchanged).toHaveLength(2)
    expect(file).toBe(first)
  })

  it('refuses a changed load without accept and names its field paths', () => {
    const changed = load('FMJ', 'Powder A', '31.0', { page: '9' })
    const { file, report, written } = mergePublishedLoads(
      first,
      table([changed, b], 2026),
      new Set(),
    )
    const id = loadId(first, a)
    expect(report.changed).toEqual([
      { id, fields: ['charges.0.charge.raw', 'charges.0.charge.value'], accepted: false },
    ])
    expect(written).toBe(false)
    expect(file).toBe(first)
  })

  it('writes an accepted change citing the new edition, appended to the sources', () => {
    const changed = load('FMJ', 'Powder A', '31.0', { page: '9' })
    const id = loadId(first, a)
    const { file, report, written } = mergePublishedLoads(
      first,
      table([changed, b], 2026),
      new Set([id]),
    )
    expect(written).toBe(true)
    expect(report.changed[0]?.accepted).toBe(true)
    expect(file.provenance.sources).toEqual([edition(2025), edition(2026)])
    const merged = defined(file.loads.find((l) => l.id === id))
    expect(merged.source).toBe(1)
    expect(merged.page).toBe('9')
    expect(Object.keys(merged).slice(-2)).toEqual(['source', 'page'])
    // the unchanged load keeps citing the first edition
    expect(file.loads.find((l) => l.id === loadId(first, b))).toBe(
      first.loads.find((l) => l.id === loadId(first, b)),
    )
    expect(mergePublishedLoads(first, table([changed, b], 2026), 'all').file).toEqual(file)
  })

  it('keeps a load the new edition no longer prints and lists it as absent', () => {
    const c = load('FMJ', 'Powder C', '27.0')
    const { file, report } = mergePublishedLoads(first, table([a, c], 2026), new Set())
    expect(report.absent).toEqual([loadId(first, b)])
    expect(report.created).toEqual([loadId(first, c)])
    expect(file.loads.map((l) => l.id)).toEqual(
      [loadId(first, a), loadId(first, b), loadId(first, c)].sort(),
    )
    expect(defined(file.loads.find((l) => l.id === loadId(first, c))).source).toBe(1)
  })

  it('does not add a source twice and keeps the file fields of the repository', () => {
    const c = load('FMJ', 'Powder C', '27.0')
    const incoming = { ...table([a, b, c]), cartridgeName: 'Printed otherwise' }
    const { file } = mergePublishedLoads(first, incoming, new Set())
    expect(file.provenance.sources).toEqual([edition(2025)])
    expect(file.cartridgeName).toBe('Test cartridge')
  })

  it('replaces an id the incoming file carries', () => {
    const { file } = mergePublishedLoads(undefined, table([{ ...a, id: 'carried' }]), new Set())
    expect(file.loads.map((l) => l.id)).toEqual([loadId(file, a)])
  })

  it('lists an added and a removed field by its path', () => {
    const withCase = load('FMJ', 'Powder A', '30.0', { case: 'Test case' })
    const { report } = mergePublishedLoads(first, table([withCase, b]), new Set())
    expect(report.changed[0]?.fields).toEqual(['case'])
  })
})

/** A records root: the valid fixtures, the source records and the powders the loads name. */
function recordsRoot() {
  const root = mkdtempSync(join(tmpdir(), 'merge-loads-'))
  cpSync(join(import.meta.dirname, 'fixtures', 'valid'), root, { recursive: true })
  return root
}

/** Writes `json` at `path` under `root`. */
function write(root: string, path: string, json: unknown) {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), JSON.stringify(json))
}

describe('npm run loads:merge', () => {
  const roots: string[] = []
  const temp = () => {
    const r = recordsRoot()
    roots.push(r)
    return r
  }
  afterEach(() => {
    for (const r of roots.splice(0)) rmSync(r, { recursive: true })
    vi.restoreAllMocks()
  })
  const target = 'loads/test-cartridge/test-manufacturer.json'

  it('parses the command line', () => {
    expect(parseMergeArgs(['in', '--accept', 'x', 'y', '--dry-run'], '/w', '/r')).toEqual({
      incoming: '/w/in',
      records: '/r',
      accept: new Set(['x', 'y']),
      dryRun: true,
    })
    expect(parseMergeArgs(['/in', '--accept-all'], '/w', '/r')).toMatchObject({ accept: 'all' })
    for (const args of [[], ['a', 'b'], ['a', '--nope'], ['a', '--accept-all', '--accept', 'x']])
      expect(parseMergeArgs(args, '/w', '/r')).toHaveProperty('error')
  })

  it('merges into the records, validates, and changes no file on a second run', () => {
    const records = temp()
    const incoming = temp()
    write(incoming, target, table([b, a]))
    const options = { incoming, records, accept: new Set<string>(), dryRun: false }
    const run = mergeLoadFolder(options)
    expect(run.errors).toEqual([])
    expect(run.files).toMatchObject([{ path: target, status: 'merged', written: true }])
    const written = readFileSync(join(records, target), 'utf8')
    expect(formatRecord(JSON.parse(written))).toBe(written)
    const { errors, publishedLoads } = readRecords(records)
    expect(errors).toEqual([])
    expect(publishedLoads[0]?.loads).toHaveLength(2)

    const again = mergeLoadFolder(options)
    expect(readFileSync(join(records, target), 'utf8')).toBe(written)
    const lines = reportLines(again, false)
    expect(lines.at(-1)).toBe(
      'total: 0 created, 0 changed (0 not accepted), 2 unchanged, 0 absent, 0 waiting',
    )
    expect(lines[0]).toContain('not changed')
  })

  it('reports a refused change with its paths and writes it only with --accept', () => {
    const records = temp()
    const incoming = temp()
    write(incoming, target, table([a, b]))
    mergeLoadFolder({ incoming, records, accept: new Set(), dryRun: false })
    const before = readFileSync(join(records, target), 'utf8')
    write(incoming, target, table([load('FMJ', 'Powder A', '31.0'), b], 2026))
    const refused = mergeLoadFolder({ incoming, records, accept: new Set(), dryRun: false })
    expect(readFileSync(join(records, target), 'utf8')).toBe(before)
    const id = loadId(table([]), a)
    expect(reportLines(refused, false)).toContain(
      `  changed ${id} (not accepted): charges.0.charge.raw, charges.0.charge.value`,
    )
    const dry = mergeLoadFolder({ incoming, records, accept: 'all', dryRun: true })
    expect(readFileSync(join(records, target), 'utf8')).toBe(before)
    expect(reportLines(dry, true).at(-1)).toContain('(dry run, nothing written)')
    expect(reportLines(dry, true)[0]).toContain('would be written')
    mergeLoadFolder({ incoming, records, accept: new Set([id]), dryRun: false })
    const after = JSON.parse(readFileSync(join(records, target), 'utf8')) as PublishedLoads
    expect(after.loads.find((l) => l.id === id)?.charges[0]?.charge.raw).toBe('31.0 gr')
    expect(readRecords(records).errors).toEqual([])
  })

  it('lists an absent load as kept', () => {
    const records = temp()
    const incoming = temp()
    write(incoming, target, table([a, b]))
    mergeLoadFolder({ incoming, records, accept: new Set(), dryRun: false })
    write(incoming, target, table([a]))
    const run = mergeLoadFolder({ incoming, records, accept: new Set(), dryRun: false })
    expect(reportLines(run, false)).toContain(`  absent ${loadId(table([]), b)}: kept`)
  })

  it('does not write a file whose cartridge is no record and lists it as waiting', () => {
    const records = temp()
    const incoming = temp()
    write(incoming, 'loads/no-cartridge/test-manufacturer.json', {
      ...table([a]),
      cartridge: 'catalogue:no-cartridge',
    })
    const run = mergeLoadFolder({ incoming, records, accept: 'all', dryRun: false })
    expect(run.files).toEqual([
      { path: 'loads/no-cartridge/test-manufacturer.json', status: 'waiting' },
    ])
    expect(reportLines(run, false)).toContain('waiting for a cartridge record (not written):')
    expect(() => readFileSync(join(records, 'loads/no-cartridge/test-manufacturer.json'))).toThrow()
  })

  it('merges nothing and fails when an incoming file breaks the schema', () => {
    const records = temp()
    const incoming = temp()
    write(incoming, target, { ...table([a]), producedBy: 'nobody' })
    write(incoming, 'loads/test-cartridge/other.json', { ...table([a]) })
    write(incoming, 'loads/test-cartridge/broken-load.json', { ...table([]), loads: [{}] })
    mkdirSync(join(incoming, 'loads/test-cartridge'), { recursive: true })
    writeFileSync(join(incoming, 'loads/test-cartridge/bad.json'), '{')
    const run = mergeLoadFolder({ incoming, records, accept: 'all', dryRun: false })
    expect(run.files).toEqual([])
    expect(run.errors).toContain(
      `${target}: producedBy: Invalid option: expected one of "maker"|"customer"`,
    )
    expect(run.errors).toContain(
      'loads/test-cartridge/other.json: id "test-manufacturer" does not match the file name',
    )
    expect(
      run.errors.some((e) => e.startsWith('loads/test-cartridge/bad.json: invalid JSON')),
    ).toBe(true)
    expect(
      run.errors.some((e) => e.startsWith('loads/test-cartridge/broken-load.json: loads.0')),
    ).toBe(true)
    expect(reportLines(run, false).at(-1)).toMatch(
      /^\d+ errors in the incoming files, nothing merged$/,
    )
  })

  it('resolves a source reference of an incoming file from the records', () => {
    const records = temp()
    const incoming = temp()
    write(records, 'sources/test-table.json', { id: 'test-table', ...edition(2025) })
    write(incoming, target, {
      ...table([a]),
      provenance: { kind: 'published', sources: [{ source: 'test-table' }] },
    })
    expect(mergeLoadFolder({ incoming, records, accept: 'all', dryRun: false }).errors).toEqual([])
    expect(readRecords(records).errors).toEqual([])
  })

  it('exits 0 on a merge, 1 on schema errors and 2 on a wrong command line', () => {
    const records = temp()
    const incoming = temp()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    write(incoming, target, table([a]))
    expect(main([incoming], '/', records)).toBe(0)
    expect(log).toHaveBeenCalled()
    write(incoming, target, { ...table([a]), loads: [] })
    expect(main([incoming], '/', records)).toBe(1)
    expect(main([], '/', records)).toBe(2)
    expect(error).toHaveBeenCalled()
    const empty = temp()
    expect(
      mergeLoadFolder({ incoming: empty, records: empty, accept: 'all', dryRun: false }),
    ).toEqual({
      files: [],
      errors: [],
    })
  })
})
