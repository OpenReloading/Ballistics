// The import step shared by the workbook parsers: one string per worksheet, kept by date.
import type { ChronoShot } from '@open-reloading/schema'
import { type ChronoDiagnostic, refuse } from './diagnostics.ts'
import type { ChronoParserOptions } from './result.ts'

/**
 * `ChronoParserOptions` plus `date`: `YYYY-MM-DD`, keeps the worksheets of that day and the worksheets
 * without a date.
 */
export interface WorkbookOptions extends ChronoParserOptions {
  /** Keep only the worksheets of this day (`YYYY-MM-DD`). */
  date?: string | undefined
}

/** The shots, label and bore flags of one worksheet, read as one string of shots. */
export interface WorksheetString {
  shots: ChronoShot[]
  label: string
  /** Bore flags as `shot <n> <flag>`. */
  flags: string[]
}

/** A worksheet a workbook parser found, with its date and a reader for its string. */
export interface FoundWorksheet {
  /** Position in the workbook, from 1. */
  position: number
  date?: string
  dateWarning?: ChronoDiagnostic
  /** The string, or undefined when the worksheet holds no shot row. */
  read: (warnings: ChronoDiagnostic[]) => WorksheetString | undefined
}

/** The distinct dates of the worksheets, ascending. */
const datesOf = (list: FoundWorksheet[]) =>
  [...new Set(list.flatMap((f) => (f.date ? [f.date] : [])))].toSorted((a, b) =>
    a.localeCompare(b, 'en'),
  )

/** Warns about the date of a kept worksheet: a date taken from the option, or its own date warning once. */
function warnDate(
  f: FoundWorksheet,
  options: WorkbookOptions,
  fill: boolean,
  warnings: ChronoDiagnostic[],
): void {
  if (options.date && !fill && !f.date) {
    warnings.push({ code: 'dateFromOption', params: { worksheet: f.position, date: options.date } })
  } else if (!fill && f.dateWarning && !warnings.includes(f.dateWarning)) {
    warnings.push(f.dateWarning)
  }
}

/**
 * Keeps the worksheets of the `date` option (all without it), reads their strings and sets the
 * date when every kept string has the same one. Warnings of other days are not added. The `date`
 * option also keeps the worksheets without a date and is the session date; when some worksheet
 * has a date, each one without a date warns that the option's date was taken.
 */
export function collectWorksheetStrings(
  found: FoundWorksheet[],
  options: WorkbookOptions,
  warnings: ChronoDiagnostic[],
): { strings: { shots: ChronoShot[] }[]; labels: string[]; flags: string[]; date?: string } {
  const fill = options.date !== undefined && found.every((f) => !f.date)
  const kept = options.date ? found.filter((f) => !f.date || f.date === options.date) : found
  checkDateOption(found, options.date, fill)
  const strings: { shots: ChronoShot[] }[] = []
  const labels: string[] = []
  const flags: string[] = []
  const read: FoundWorksheet[] = []
  for (const f of kept) {
    warnDate(f, options, fill, warnings)
    const s = f.read(warnings)
    if (!s) {
      warnings.push({ code: 'noShotRows', params: { worksheet: f.position } })
      continue
    }
    strings.push({ shots: s.shots })
    labels.push(s.label)
    flags.push(...s.flags.map((flag) => `string ${strings.length} ${flag}`))
    read.push(f)
  }
  const date = commonDate(read, options.date, warnings)
  return { strings, labels, flags, ...(date ? { date } : {}) }
}

/** Refuses a `date` option that no worksheet has while some worksheet has a date (`fill` unset). */
function checkDateOption(found: FoundWorksheet[], date: string | undefined, fill: boolean): void {
  // `fill` is unset, so some worksheet has a date and the list is never empty
  if (date && !fill && !found.some((f) => f.date === date))
    refuse('noStringOnDate', { date, dates: datesOf(found) })
}

/**
 * The session date: the `date` option, else the one date every read worksheet has; warns when
 * the read worksheets have several.
 */
function commonDate(
  read: FoundWorksheet[],
  option: string | undefined,
  warnings: ChronoDiagnostic[],
): string | undefined {
  const dates = datesOf(read)
  if (dates.length > 1) warnings.push({ code: 'severalDays', params: { dates } })
  return (
    option || (dates.length === 1 && read.every((f) => f.date === dates[0]) ? dates[0] : undefined)
  )
}
