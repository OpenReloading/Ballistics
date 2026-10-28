import { userRecord } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { inventedFiles } from '../src/lib/import-entry/fixtures.ts'
import { idOfKey } from '../src/lib/import-entry/ids.ts'
import { inspectFile, type TableCard } from '../src/lib/import-entry/inspect.ts'
import { autoMap, buildRecords, type ImportContext } from '../src/lib/import-entry/map.ts'
import { planBuilt } from '../src/lib/import-entry/plan.ts'

const now = '2026-10-28T00:00:00.000Z'
const ctx: ImportContext = { source: 'Invented test file', file: 'f.csv', day: '2026-10-28', now }
const files = Object.fromEntries(inventedFiles().map((f) => [f.name, f.bytes]))
const card = async (name: string) =>
  (await inspectFile(name, files[name] ?? new Uint8Array(), now)) as TableCard

describe('kind detection', () => {
  const cases: [string, string | undefined][] = [
    ['bullets-5000.csv', 'bullet'],
    ['bullets-eu.csv', 'bullet'],
    ['bullets.xlsx', 'bullet'],
    ['powders.csv', 'powder'],
    ['cartridges.csv', 'cartridge'],
    ['weather.csv', undefined],
    ['notes.txt', undefined],
  ]
  it.each(cases)('%s reads as %s', async (name, kind) => {
    const c = await card(name)
    expect(c.kind).toBe(kind)
    expect(c.refusal === undefined).toBe(kind !== undefined)
  })

  it('suggests the wrong kind for a table that names no case length, and the map follows the kind', async () => {
    const c = await card('headers-only-length.csv')
    expect([c.kind, c.tier]).toEqual(['bullet', 'medium'])
    const map = autoMap(c.table, 'cartridge')
    expect(map.map((m) => m.field)).toEqual(['name', 'bulletDiameter', undefined])
  })

  it('tells load files, refuses text without a table', async () => {
    const load = await inspectFile('demo.load', files['demo.load'] ?? new Uint8Array(), now)
    expect(load.type === 'load' && load.records.map((r) => r.kind)).toEqual(['bullet', 'powder'])
    expect(load.type === 'load' && load.notes).toEqual(['Not read: charge, primer.'])
    expect(
      (await inspectFile('x.bin', new Uint8Array([0xff, 0xfe, 0xfd, 0x00, 0x80]), now)).type,
    ).toBe('refused')
  })
})

describe('units and decimal marks', () => {
  it('converts grains, inches and decimal commas exactly into g and mm', async () => {
    const us = await card('bullets-5000.csv')
    const eu = await card('bullets-eu.csv')
    expect(us.map.find((m) => m.field === 'mass')?.unit).toBe('gr')
    expect(eu.map.find((m) => m.field === 'mass')?.unit).toBe('g')
    expect(eu.map.find((m) => m.field === 'mass')?.decimal).toBe(',')
    const b = buildRecords(eu.table, 'bullet', eu.map, ctx, idOfKey)
    const first = b.entries[0]?.record
    const data = first?.kind === 'bullet' ? first.data.overrides : undefined
    expect(data?.diameter?.value).toBeCloseTo(7.82, 9)
    expect(data?.mass?.value).toBeCloseTo(9.72, 9)
    const u = buildRecords(
      us.table.rows.length
        ? { ...us.table, rows: [['T', 'M', '.308', '0.308', '168', '1.2', '0.4', '0.2']] }
        : us.table,
      'bullet',
      us.map,
      ctx,
      idOfKey,
    )
    const m = u.entries[0]?.record
    const d = m?.kind === 'bullet' ? m.data.overrides : undefined
    expect(d?.mass?.value).toBeCloseTo(168 * 0.06479891, 9)
    expect(d?.diameter?.value).toBeCloseTo(0.308 * 25.4, 9)
    expect(d?.mass?.raw).toBe('168')
  })
})

describe('rows and duplicates', () => {
  it('rejects bad rows with row, cell and reason, accepts the rest, and a second import adds nothing', async () => {
    const c = await card('bullets-5000.csv')
    const built = buildRecords(c.table, 'bullet', c.map, ctx, idOfKey)
    expect(new Set(built.rejected.map((r) => r.column))).toEqual(
      new Set(['Weight (gr)', 'Diameter (in)', 'Name']),
    )
    expect(built.rejected.length + built.entries.length).toBe(c.table.rows.length)
    expect(built.rejected.every((r) => r.row >= 2 && r.reason.length > 10)).toBe(true)
    const plan = planBuilt(built, [])
    expect(plan.repeated).toBeGreaterThan(0)
    expect(plan.conflicts.length).toBeGreaterThan(0)
    const again = planBuilt(buildRecords(c.table, 'bullet', c.map, ctx, idOfKey), plan.added)
    expect(again.added).toHaveLength(0)
    expect(again.equal.length).toBe(plan.added.length)
  })

  it('reads a changed row under the same key as a conflict with the stored record', async () => {
    const c = await card('bullets-eu.csv')
    const stored = planBuilt(buildRecords(c.table, 'bullet', c.map, ctx, idOfKey), []).added
    const rows = c.table.rows.map((r) => [...r])
    const first = rows[0]
    if (first) first[5] = '40,0'
    const changed = planBuilt(
      buildRecords({ ...c.table, rows }, 'bullet', c.map, ctx, idOfKey),
      stored,
    )
    expect([changed.added.length, changed.conflicts.length]).toEqual([0, 1])
  })

  it('shows the shipped schema dropping an `imported` entry the envelope lacks today', async () => {
    const c = await card('powders.csv')
    const e = buildRecords(c.table, 'powder', c.map, ctx, idOfKey).entries[0]?.record
    expect(e?.imported?.source).toBe('Invented test file')
    expect('imported' in userRecord.parse(e)).toBe(false)
  })
})
