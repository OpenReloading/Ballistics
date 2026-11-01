import { type ShootingLogRecord, type UserRecord, userRecord } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import {
  blankEntry,
  cleanEntry,
  entryName,
  entryProblem,
  entryRoundsDue,
  inFilter,
  type LogNames,
  logCsv,
  logEntries,
  logFileName,
  logJson,
  logRows,
  logYears,
  userIdOf,
  withEntryRounds,
} from '../src/lib/shooting-log.ts'
import { parseUserDataFile } from '../src/lib/user-data.ts'

const rifle = '3f1c2b4e-9a7d-4c1e-8b25-6d0f4a9e7c13'
const pistol = '7a2d9c10-5b3e-4f68-9d41-0c8e2b6a1f57'
const load = '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'

const entry = (id: string, data: Record<string, unknown>, saved = '2026-10-01T10:00:00.000Z') =>
  userRecord.parse({
    kind: 'shootingLogEntry',
    id,
    name: `${data.date}`,
    saved,
    data: { rounds: 0, ...data },
  }) as ShootingLogRecord

const ids = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004',
] as const

const entries: [ShootingLogRecord, ShootingLogRecord, ShootingLogRecord] = [
  entry(ids[0], { date: '2026-03-14', firearm: `user:${rifle}`, load: `user:${load}`, rounds: 30 }),
  entry(ids[1], {
    date: '2025-11-02',
    firearm: `user:${pistol}`,
    ammunition: 'Maker 9 mm',
    rounds: 50,
  }),
  entry(ids[2], { date: '2026-07-01', firearm: `user:${pistol}`, rounds: 25, place: 'Club' }),
]

const names: LogNames = {
  firearm: (ref) =>
    ({ [`user:${rifle}`]: 'Bench rifle', [`user:${pistol}`]: 'Club pistol' })[ref ?? ''] ?? '',
  load: (ref) => (ref === `user:${load}` ? 'Load A' : ''),
  discipline: (ref) => ref ?? '',
}

const firearm = (data: Record<string, unknown> = {}) =>
  userRecord.parse({
    kind: 'firearm',
    id: rifle,
    name: 'Bench rifle',
    saved: '2026-10-01T10:00:00.000Z',
    data: {
      origin: 'user',
      name: 'Bench rifle',
      twistHand: 'right',
      optics: [],
      configurations: [],
      ...data,
    },
  })

describe('the log list', () => {
  it('sorts the entries by date and leaves out the other kinds', () => {
    const records: UserRecord[] = [entries[0], firearm(), entries[1], entries[2]]
    expect(logEntries(records).map((r) => r.data.date)).toEqual([
      '2025-11-02',
      '2026-03-14',
      '2026-07-01',
    ])
  })

  it('lists the years latest first', () => {
    expect(logYears(entries)).toEqual(['2026', '2025'])
  })

  it('filters by firearm, year and an inclusive day range', () => {
    const kept = (f: Parameters<typeof inFilter>[1]) =>
      entries.filter((r) => inFilter(r, f)).map((r) => r.data.date)
    expect(kept({ firearms: [pistol] })).toEqual(['2025-11-02', '2026-07-01'])
    expect(kept({ years: ['2026'] })).toEqual(['2026-03-14', '2026-07-01'])
    expect(kept({ from: '2026-03-14', to: '2026-07-01' })).toEqual(['2026-03-14', '2026-07-01'])
    expect(kept({ from: '2026-03-15' })).toEqual(['2026-07-01'])
    expect(kept({ firearms: [pistol], years: ['2026'] })).toEqual(['2026-07-01'])
    expect(kept({})).toHaveLength(3)
  })

  it('names an entry after its day and firearm, else its place', () => {
    expect(entryName({ date: '2026-03-14', rounds: 1 }, 'Bench rifle')).toBe(
      '2026-03-14 Bench rifle',
    )
    expect(entryName({ date: '2026-03-14', rounds: 1, place: 'Club' }, undefined)).toBe(
      '2026-03-14 Club',
    )
    expect(entryName({ date: '2026-03-14', rounds: 1 }, undefined)).toBe('2026-03-14')
  })

  it('reads the id of a user reference only', () => {
    expect(userIdOf(`user:${rifle}`)).toBe(rifle)
    expect(userIdOf('catalogue:rifle')).toBeUndefined()
    expect(userIdOf(undefined)).toBeUndefined()
  })
})

describe('the entry form', () => {
  it('starts today with no rounds', () => {
    expect(blankEntry(new Date(2026, 9, 12, 12))).toEqual({ date: '2026-10-12', rounds: 0 })
  })

  it('leaves out empty texts and a confirmation without a name', () => {
    expect(
      cleanEntry({
        date: '2026-10-12',
        rounds: 5,
        place: '',
        notes: '',
        confirmation: { by: '  ', date: '2026-10-12' },
      }),
    ).toEqual({ date: '2026-10-12', rounds: 5 })
    expect(
      cleanEntry({ date: '2026-10-12', rounds: 5, confirmation: { by: ' Range officer ' } }),
    ).toEqual({ date: '2026-10-12', rounds: 5, confirmation: { by: 'Range officer' } })
  })

  it('says why an entry cannot be saved', () => {
    expect(entryProblem({ date: '2026-10-12', rounds: 5 })).toBeUndefined()
    expect(entryProblem({ date: '', rounds: 5 })).toBe('Enter the date.')
    // a day of the confirmation without who confirmed is not dropped in silence
    expect(
      entryProblem({
        date: '2026-10-12',
        rounds: 5,
        confirmation: { by: ' ', date: '2026-10-12' },
      }),
    ).toBe('Enter who confirmed the entry, or clear the day of the confirmation.')
    expect(entryProblem({ date: '2026-10-12', rounds: 100001 })).toBe(
      'Check the entry: a value is out of its range.',
    )
    expect(
      entryProblem({ date: '2026-10-12', rounds: 5, load: `user:${load}`, ammunition: 'X' }),
    ).toBe('Give a load or factory ammunition, not both.')
  })
})

describe('export', () => {
  it('writes one CSV row per entry with the documented columns', () => {
    const rows = logRows(entries, names)
    expect(rows[0]).toEqual([
      'Date',
      'Place',
      'Discipline',
      'Firearm',
      'Load or ammunition',
      'Rounds',
      'Result',
      'Notes',
      'Confirmed by',
      'Confirmed on',
    ])
    expect(rows.slice(1).map((r) => [r[0], r[3], r[4], r[5]])).toEqual([
      ['2026-03-14', 'Bench rifle', 'Load A', 30],
      ['2025-11-02', 'Club pistol', 'Maker 9 mm', 50],
      ['2026-07-01', 'Club pistol', '', 25],
    ])
    expect(logCsv(entries, names).startsWith('﻿Date,Place,')).toBe(true)
  })

  it('writes a user data file that reads back to the same entries', () => {
    const parsed = parseUserDataFile(logJson(entries))
    expect(parsed.ok && parsed.records).toEqual(entries)
  })

  it('names the files after the day', () => {
    expect(logFileName('csv', new Date(2026, 9, 12, 12))).toBe(
      'openreloading-shooting-log-2026-10-12.csv',
    )
  })
})

describe('the round count of an entry', () => {
  const now = new Date('2026-10-12T12:00:00Z')

  it('adds the rounds once and notes them under the entry', () => {
    const f = firearm({ roundCount: 1000 })
    expect(entryRoundsDue(f, ids[0], 30)).toBe(30)
    const once = withEntryRounds(f, ids[0], 30, now)
    expect(once?.kind === 'firearm' && once.data.roundCount).toBe(1030)
    expect(once?.kind === 'firearm' && once.data.countedSessions).toEqual([
      { session: `user:${ids[0]}`, rounds: 30 },
    ])
    // saved again unchanged: nothing due, the record is left
    expect(once && entryRoundsDue(once, ids[0], 30)).toBe(0)
    expect(once && withEntryRounds(once, ids[0], 30, now)).toBeUndefined()
    // edited to more rounds: only the new ones
    const more = once && withEntryRounds(once, ids[0], 40, now)
    expect(more?.kind === 'firearm' && more.data.roundCount).toBe(1040)
  })

  it('changes nothing for a firearm without a count or for no rounds', () => {
    expect(entryRoundsDue(firearm(), ids[0], 30)).toBe(0)
    expect(withEntryRounds(firearm(), ids[0], 30, now)).toBeUndefined()
    expect(withEntryRounds(firearm({ roundCount: 5 }), ids[0], 0, now)).toBeUndefined()
    expect(withEntryRounds(entries[0], ids[0], 30, now)).toBeUndefined()
  })
})
