/** The person's own record, counted through the sessions' one-confirm flow (#633); nothing here says what a club or authority accepts. */
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
import { countedFor, roundsDue, withCountedRounds, withSessionRounds } from './firearm.ts'
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

/** The file name of an export: `rangefoundry-shooting-log-<day>.<ext>`. */
export const logFileName = (ext: 'csv' | 'json', now = new Date()) =>
  `rangefoundry-shooting-log-${localDay(now)}.${ext}`

/** Empty optional texts are left out before the check, as Save writes them. */
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

/** The rounds of entry `id` that the firearm's count does not hold yet: less those counted for it before and the linked event's rounds (#919) not covered by sibling entries, so counting order does not change the total (#961); a declined sibling ({@link withEntryDeclined}) covers none (#974); 0 for a record that is no firearm or has no count. */
export function entryRoundsDue(
  record: UserRecord,
  id: string,
  rounds: number,
  event?: string,
  siblings: readonly { id: string; rounds: number }[] = [],
) {
  if (record.kind !== 'firearm' || record.data.roundCount === undefined) return 0
  const f = record.data
  const due = roundsDue(f, entryRef(id), f.roundCount, rounds)
  if (!event) return due
  // a sibling's rounds its own count does not hold went into the event's count, unless declined
  const covered = siblings.reduce((n, s) => {
    const counted = f.countedSessions?.find((c) => c.session === entryRef(s.id))?.rounds
    return counted === 0 ? n : n + Math.max(0, s.rounds - (counted ?? 0))
  }, 0)
  return Math.max(0, due - Math.max(0, countedFor(f, [event]) - covered))
}

/** Noted in `countedSessions`, so a saved entry counts once. */
export function withEntryRounds(
  record: UserRecord,
  id: string,
  rounds: number,
  now = new Date(),
  event?: string,
  siblings: readonly { id: string; rounds: number }[] = [],
) {
  const due = entryRoundsDue(record, id, rounds, event, siblings)
  if (record.kind !== 'firearm' || due < 1) return
  return withSessionRounds(record, entryRef(id), record.data.roundCount, rounds, due, now)
}

/** Noted as 0 rounds so linked entries share the event's rounds in either order (#974); shortcut: an entry counted before and declined after a raise still covers the event, a separate declined field would tell them apart. */
export function withEntryDeclined(record: UserRecord, id: string, now = new Date()) {
  if (record.kind !== 'firearm') return
  if (record.data.countedSessions?.some((c) => c.session === entryRef(id))) return
  return withCountedRounds(record, entryRef(id), 0, now)
}
