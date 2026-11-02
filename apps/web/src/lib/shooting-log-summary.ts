/**
 * The yearly summary of the shooting log: rounds per firearm and per cartridge, entries (range
 * days) per month, and the competition events of the year with the entries that link them, read from the entries of one
 * calendar year. The firearm's `roundCount` stays the one counter (#604): the summary is a sum of
 * the log, not a second total.
 */
import type { ShootingLogRecord, UserRecord } from '@open-reloading/schema'
import type { EventRecord } from './competition-events.ts'
import { toCsv } from './csv.ts'
import { entryYear, userIdOf } from './shooting-log.ts'

type LoadRecord = Extract<UserRecord, { kind: 'load' }>
type FirearmRecord = Extract<UserRecord, { kind: 'firearm' }>

/** A total of the summary: the reference it is for (empty for none) and its rounds and entries. */
export interface SummaryRow {
  /** The firearm or cartridge reference as stored; empty for entries without one. */
  ref: string
  rounds: number
  entries: number
}

/** The summary of one calendar year. */
export interface YearSummary {
  year: string
  /** Entries of the year. */
  entries: number
  /** Rounds of the year. */
  rounds: number
  /** Per firearm, most rounds first; entries without a firearm under `ref` ''. */
  firearms: SummaryRow[]
  /** Per cartridge of the entry's load, most rounds first; entries without a load are not here. */
  cartridges: SummaryRow[]
  /** Rounds of the entries without a load, which no cartridge row holds. */
  withoutLoad: number
  /** Entries (range days) per month, January first: 12 counts. */
  months: number[]
  /** The competition events dated in the year, by date, each with the entries of the year that link it. */
  events: { event: EventRecord; entries: ShootingLogRecord[] }[]
}

/**
 * The cartridge of a load: its own `cartridge`, else its firearm's. undefined when neither names one
 * or the load is not in `records`.
 */
function cartridgeOfLoad(
  ref: string | undefined,
  loads: ReadonlyMap<string, LoadRecord>,
  firearms: ReadonlyMap<string, FirearmRecord>,
) {
  const load = loads.get(userIdOf(ref) ?? '')
  if (!load) return
  return load.data.cartridge ?? firearms.get(userIdOf(load.data.firearm) ?? '')?.data.cartridge
}

function add(rows: Map<string, SummaryRow>, ref: string, rounds: number) {
  const row = rows.get(ref) ?? { ref, rounds: 0, entries: 0 }
  row.rounds += rounds
  row.entries += 1
  rows.set(ref, row)
}

const byRounds = (a: SummaryRow, b: SummaryRow) => b.rounds - a.rounds || a.ref.localeCompare(b.ref)

/**
 * The summary of `year` from the log `entries` and the browser's `records` (for the cartridge of
 * each load, and the competition events): only the entries and events dated in that calendar year count. An entry without a load counts
 * under its firearm only; a load whose cartridge is unknown counts under `ref` ''.
 */
export function yearSummary(
  entries: readonly ShootingLogRecord[],
  records: readonly UserRecord[],
  year: string,
): YearSummary {
  const loads = new Map(
    records.filter((r): r is LoadRecord => r.kind === 'load').map((r) => [r.id, r]),
  )
  const firearms = new Map(
    records.filter((r): r is FirearmRecord => r.kind === 'firearm').map((r) => [r.id, r]),
  )
  const firearmRows = new Map<string, SummaryRow>()
  const cartridgeRows = new Map<string, SummaryRow>()
  const months = Array.from({ length: 12 }, () => 0)
  const shown = entries.filter((r) => entryYear(r.data) === year)
  let rounds = 0
  let withoutLoad = 0
  for (const { data: e } of shown) {
    rounds += e.rounds
    add(firearmRows, e.firearm ?? '', e.rounds)
    if (e.load) add(cartridgeRows, cartridgeOfLoad(e.load, loads, firearms) ?? '', e.rounds)
    else withoutLoad += e.rounds
    const month = Number(e.date.slice(5, 7)) - 1
    months[month] = (months[month] ?? 0) + 1
  }
  return {
    year,
    entries: shown.length,
    rounds,
    firearms: [...firearmRows.values()].sort(byRounds),
    cartridges: [...cartridgeRows.values()].sort(byRounds),
    withoutLoad,
    months,
    events: records
      .filter((r): r is EventRecord => r.kind === 'event' && entryYear(r.data) === year)
      .sort((a, b) => a.data.date.localeCompare(b.data.date))
      .map((event) => ({
        event,
        entries: shown.filter((r) => r.data.event === `user:${event.id}`),
      })),
  }
}

/** The years with entries or competition events, latest first: the years the summary offers. */
export const summaryYears = (
  entries: readonly ShootingLogRecord[],
  events: readonly EventRecord[],
) =>
  [...new Set([...entries, ...events].map((r) => entryYear(r.data)))].sort((a, b) =>
    b.localeCompare(a),
  )

/** The names the summary shows for its references. */
export interface SummaryNames {
  firearm: (ref: string) => string
  cartridge: (ref: string) => string
}

/** The month `index` (0 for January) of `year` as `YYYY-MM`, the CSV's month name. */
export const monthKey = (year: string, index: number) =>
  `${year}-${String(index + 1).padStart(2, '0')}`

/**
 * The summary as CSV rows: `Year`, then a header `Section`, `Name`, `Rounds`, `Entries` and one row
 * per total, the sections `Firearm`, `Cartridge`, `Without a load`, `Month` (named `YYYY-MM`, entries
 * only), `Competition` (a competition event of the year, named by its day and name, with the rounds
 * and entries of the log entries that link it) and `Total`;
 * documented in the shooting log guide.
 */
export function summaryRows(s: YearSummary, names: SummaryNames): (string | number)[][] {
  return [
    ['Year', s.year],
    ['Section', 'Name', 'Rounds', 'Entries'],
    ...s.firearms.map((r) => ['Firearm', names.firearm(r.ref), r.rounds, r.entries]),
    ...s.cartridges.map((r) => ['Cartridge', names.cartridge(r.ref), r.rounds, r.entries]),
    ...(s.withoutLoad > 0 ? [['Without a load', '', s.withoutLoad, '']] : []),
    ...s.months.map((n, i) => ['Month', monthKey(s.year, i), '', n]),
    ...s.events.map(({ event, entries }) => [
      'Competition',
      `${event.data.date} ${event.name}`,
      entries.reduce((n, r) => n + r.data.rounds, 0),
      entries.length,
    ]),
    ['Total', '', s.rounds, s.entries],
  ]
}

/** CSV text of the summary, with a byte order mark so spreadsheets read UTF-8. */
export const summaryCsv = (s: YearSummary, names: SummaryNames) =>
  `\ufeff${toCsv(summaryRows(s, names))}\n`

/** The file name of the summary CSV: `openreloading-shooting-log-<year>-summary.csv`. */
export const summaryFileName = (year: string) => `openreloading-shooting-log-${year}-summary.csv`
