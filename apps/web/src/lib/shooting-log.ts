/**
 * The shooting log (Schiessbuch): the entries of this browser, their filters, the CSV and JSON
 * export and the rounds an entry adds to its firearm's count through the one-confirm flow of the
 * sessions (#633). The log is the person's own record; nothing here says what a club or an
 * authority accepts.
 */
import {
  parseRef,
  type ShootingLogEntry,
  type ShootingLogRecord,
  shootingLogEntry,
  type UserRecord,
} from '@open-reloading/schema'
import { type Message, msg } from '../i18n/translate.ts'
import { toCsv } from './csv.ts'
import { localDay } from './dates.ts'
import { roundsDue, withSessionRounds } from './firearm.ts'
import { userDataText } from './user-data.ts'

/** A new entry: today, no rounds yet. */
export const blankEntry = (now = new Date()): ShootingLogEntry => ({
  date: localDay(now),
  rounds: 0,
})

/** The reference `user:<id>` a firearm counts an entry's rounds under in `countedSessions`. */
const entryRef = (id: string) => `user:${id}`

/** The record id a `user:` reference names, else undefined. */
export const userIdOf = (ref: string | undefined) => {
  const parsed = ref === undefined ? undefined : parseRef(ref)
  return parsed?.scope === 'user' ? parsed.id : undefined
}

/** The record name of an entry: its day and its firearm, else its place, as the file name. */
export const entryName = (e: ShootingLogEntry, firearmName: string | undefined) =>
  [e.date, firearmName || e.place].filter(Boolean).join(' ').slice(0, 200)

/** The calendar year of an entry, as text. */
export const entryYear = (e: Pick<ShootingLogEntry, 'date'>) => e.date.slice(0, 4)

/** The years the entries fall in, latest first. */
export const logYears = (entries: readonly ShootingLogRecord[]) =>
  [...new Set(entries.map((r) => entryYear(r.data)))].sort((a, b) => b.localeCompare(a))

/** What the log shows: the firearm ids (empty for all), the years (empty for all) and a day range. */
export interface LogFilter {
  firearms?: readonly string[] | undefined
  years?: readonly string[] | undefined
  /** First day, ISO 8601, inclusive; empty for open. */
  from?: string | undefined
  /** Last day, ISO 8601, inclusive; empty for open. */
  to?: string | undefined
}

/** Whether entry `r` passes `f`. */
export function inFilter(r: ShootingLogRecord, f: LogFilter) {
  const d = r.data
  if (f.firearms?.length && !f.firearms.includes(userIdOf(d.firearm) ?? '')) return false
  if (f.years?.length && !f.years.includes(entryYear(d))) return false
  if (f.from && d.date < f.from) return false
  if (f.to && d.date > f.to) return false
  return true
}

/** The entries of `records`, by date and then save time, the oldest first. */
export const logEntries = (records: readonly UserRecord[]) =>
  records
    .filter((r): r is ShootingLogRecord => r.kind === 'shootingLogEntry')
    .sort((a, b) => a.data.date.localeCompare(b.data.date) || a.saved.localeCompare(b.saved))

/** The names the log shows for an entry's references. */
export interface LogNames {
  firearm: (ref: string | undefined) => string
  load: (ref: string | undefined) => string
  discipline: (ref: string | undefined) => string
  event: (ref: string | undefined) => string
}

/** The load of an entry, or its factory ammunition; empty without either. */
export const ammunitionText = (e: ShootingLogEntry, names: LogNames) =>
  e.load ? names.load(e.load) : (e.ammunition ?? '')

/** The CSV columns, in order; documented in the shooting log guide. */
const logCsvHeader = [
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
] as const

/** Header and one row per entry, in the order given. */
export function logRows(entries: readonly ShootingLogRecord[], names: LogNames) {
  return [
    [...logCsvHeader],
    ...entries.map(({ data: e }) => [
      e.date,
      e.place ?? '',
      names.discipline(e.discipline),
      names.firearm(e.firearm),
      ammunitionText(e, names),
      e.rounds,
      e.result ?? '',
      e.notes ?? '',
      e.confirmation?.by ?? '',
      e.confirmation?.date ?? '',
    ]),
  ]
}

/** CSV text of the entries, with a byte order mark so spreadsheets read UTF-8. */
export const logCsv = (entries: readonly ShootingLogRecord[], names: LogNames) =>
  `﻿${toCsv(logRows(entries, names))}\n`

/** A user data file of the entries, which Import of the File menu reads back. */
export const logJson = (entries: readonly ShootingLogRecord[]) => userDataText([...entries])

/** The file name of an export: `openreloading-shooting-log-<day>.<ext>`. */
export const logFileName = (ext: 'csv' | 'json', now = new Date()) =>
  `openreloading-shooting-log-${localDay(now)}.${ext}`

/**
 * Why `e` cannot be saved, in words the page translates; undefined when it can. Empty optional
 * texts are left out before the check, as Save writes them.
 */
export function entryProblem(e: ShootingLogEntry): Message | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return msg('Enter the date.')
  if (e.confirmation?.date && !e.confirmation.by?.trim())
    return msg('Enter who confirmed the entry, or clear the day of the confirmation.')
  if (e.load && e.ammunition) return msg('Give a load or factory ammunition, not both.')
  return shootingLogEntry.safeParse(cleanEntry(e)).success
    ? undefined
    : msg('Check the entry: a value is out of its range.')
}

/** `e` without empty optional texts and an empty confirmation, as it is stored. */
export function cleanEntry(e: ShootingLogEntry): ShootingLogEntry {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(e)) if (v !== undefined && v !== '') out[k] = v
  const by = e.confirmation?.by?.trim()
  if (!by) delete out.confirmation
  else out.confirmation = { by, ...(e.confirmation?.date && { date: e.confirmation.date }) }
  return out as unknown as ShootingLogEntry
}

/**
 * The rounds of entry `id` (`rounds` rounds) that the count of the firearm record does not hold
 * yet: the rounds less those counted for the entry before. 0 for a record that is no firearm or
 * has no count.
 */
export function entryRoundsDue(record: UserRecord, id: string, rounds: number) {
  if (record.kind !== 'firearm' || record.data.roundCount === undefined) return 0
  return roundsDue(record.data, entryRef(id), record.data.roundCount, rounds)
}

/**
 * The firearm record with the entry's due rounds added to its count and noted in
 * `countedSessions` under the entry's reference, so a saved entry is counted once; undefined,
 * leaving the record, when nothing is due.
 */
export function withEntryRounds(record: UserRecord, id: string, rounds: number, now = new Date()) {
  const due = entryRoundsDue(record, id, rounds)
  if (record.kind !== 'firearm' || due < 1) return
  return withSessionRounds(record, entryRef(id), record.data.roundCount, rounds, due, now)
}
