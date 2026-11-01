import { type ShootingLogRecord, type UserRecord, userRecord } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import {
  monthKey,
  summaryCsv,
  summaryFileName,
  summaryRows,
  yearSummary,
} from '../src/lib/shooting-log-summary.ts'

const rifle = '3f1c2b4e-9a7d-4c1e-8b25-6d0f4a9e7c13'
const pistol = '7a2d9c10-5b3e-4f68-9d41-0c8e2b6a1f57'
const ownLoad = '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
const pistolLoad = '1b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6e'
const saved = '2026-10-01T10:00:00.000Z'

const entry = (n: number, data: Record<string, unknown>) =>
  userRecord.parse({
    kind: 'shootingLogEntry',
    id: `00000000-0000-4000-8000-00000000000${n}`,
    name: `${data.date}`,
    saved,
    data,
  }) as ShootingLogRecord

const firearm = (id: string, name: string, cartridge: string) =>
  userRecord.parse({
    kind: 'firearm',
    id,
    name,
    saved,
    data: { origin: 'user', name, cartridge, twistHand: 'right', optics: [], configurations: [] },
  })

// a load with a cartridge, and one that names only its firearm's
const load = (id: string, name: string, data: Record<string, unknown>) =>
  userRecord.parse({ kind: 'load', id, name, saved, data: { origin: 'user', ...data } })

const records: UserRecord[] = [
  firearm(rifle, 'Bench rifle', 'catalogue:308-win'),
  firearm(pistol, 'Club pistol', 'catalogue:9-mm-luger'),
  load(ownLoad, 'Load A', { cartridge: 'catalogue:308-win', firearm: `user:${rifle}` }),
  load(pistolLoad, 'Load P', { firearm: `user:${pistol}` }),
]

const entries = [
  entry(1, { date: '2025-11-02', firearm: `user:${pistol}`, ammunition: 'Maker 9 mm', rounds: 50 }),
  entry(2, { date: '2026-03-14', firearm: `user:${rifle}`, load: `user:${ownLoad}`, rounds: 30 }),
  entry(3, { date: '2026-03-28', firearm: `user:${rifle}`, load: `user:${ownLoad}`, rounds: 20 }),
  entry(4, {
    date: '2026-07-01',
    firearm: `user:${pistol}`,
    load: `user:${pistolLoad}`,
    rounds: 100,
    event: `user:${rifle.replace('3f', '4f')}`,
    result: '2nd place',
  }),
  // no load: counted under its firearm only
  entry(5, { date: '2026-07-05', firearm: `user:${pistol}`, ammunition: 'Maker 9 mm', rounds: 40 }),
  // no firearm and no load
  entry(6, { date: '2026-12-31', rounds: 5 }),
]

describe('yearSummary', () => {
  it('reads only the entries of the year, with totals that match them', () => {
    const y2025 = yearSummary(entries, records, '2025')
    expect(y2025).toMatchObject({ entries: 1, rounds: 50 })
    expect(y2025.firearms).toEqual([{ ref: `user:${pistol}`, rounds: 50, entries: 1 }])
    const y2026 = yearSummary(entries, records, '2026')
    expect(y2026).toMatchObject({ entries: 5, rounds: 195 })
    const sum = (rows: { rounds: number }[]) => rows.reduce((n, r) => n + r.rounds, 0)
    expect(sum(y2026.firearms)).toBe(y2026.rounds)
    expect(sum(y2026.cartridges) + y2026.withoutLoad).toBe(y2026.rounds)
    expect(y2026.months.reduce((n, m) => n + m, 0)).toBe(y2026.entries)
    expect(yearSummary(entries, records, '2024')).toMatchObject({ entries: 0, rounds: 0 })
  })

  it('totals per firearm, most rounds first, entries without a firearm under no reference', () => {
    expect(yearSummary(entries, records, '2026').firearms).toEqual([
      { ref: `user:${pistol}`, rounds: 140, entries: 2 },
      { ref: `user:${rifle}`, rounds: 50, entries: 2 },
      { ref: '', rounds: 5, entries: 1 },
    ])
  })

  it("counts an entry without a load under its firearm only, and a load's cartridge or its firearm's", () => {
    const s = yearSummary(entries, records, '2026')
    expect(s.cartridges).toEqual([
      { ref: 'catalogue:9-mm-luger', rounds: 100, entries: 1 },
      { ref: 'catalogue:308-win', rounds: 50, entries: 2 },
    ])
    expect(s.withoutLoad).toBe(45)
  })

  it('counts a load the browser lacks under no cartridge', () => {
    const lost = entry(7, { date: '2026-01-01', load: `user:${rifle}`, rounds: 3 })
    expect(yearSummary([lost], [], '2026').cartridges).toEqual([{ ref: '', rounds: 3, entries: 1 }])
  })

  it('counts the entries per month and lists the competitions of the year', () => {
    const s = yearSummary(entries, records, '2026')
    expect(s.months).toEqual([0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 0, 1])
    expect(s.events.map((r) => r.data.date)).toEqual(['2026-07-01'])
  })
})

describe('summary CSV', () => {
  const names = {
    firearm: (ref: string) => (ref === `user:${rifle}` ? 'Bench rifle' : ref ? 'Club pistol' : ''),
    cartridge: (ref: string) => ref.replace('catalogue:', ''),
  }

  it('writes the numbers of the summary, section by section', () => {
    const s = yearSummary(entries, records, '2026')
    const rows = summaryRows(s, names)
    expect(rows.slice(0, 2)).toEqual([
      ['Year', '2026'],
      ['Section', 'Name', 'Rounds', 'Entries'],
    ])
    expect(rows.filter((r) => r[0] === 'Firearm')).toEqual([
      ['Firearm', 'Club pistol', 140, 2],
      ['Firearm', 'Bench rifle', 50, 2],
      ['Firearm', '', 5, 1],
    ])
    expect(rows.filter((r) => r[0] === 'Cartridge')).toEqual([
      ['Cartridge', '9-mm-luger', 100, 1],
      ['Cartridge', '308-win', 50, 2],
    ])
    expect(rows.find((r) => r[0] === 'Without a load')).toEqual(['Without a load', '', 45, ''])
    expect(rows.filter((r) => r[0] === 'Month')).toHaveLength(12)
    expect(rows.find((r) => r[1] === '2026-03')).toEqual(['Month', '2026-03', '', 2])
    expect(rows.find((r) => r[0] === 'Competition')).toEqual(['Competition', '2026-07-01', 100, 1])
    expect(rows.at(-1)).toEqual(['Total', '', 195, 5])
    expect(summaryCsv(s, names).startsWith('﻿Year,2026\n')).toBe(true)
  })

  it('names the months and the file', () => {
    expect(monthKey('2026', 0)).toBe('2026-01')
    expect(monthKey('2026', 11)).toBe('2026-12')
    expect(summaryFileName('2026')).toBe('openreloading-shooting-log-2026-summary.csv')
  })
})
