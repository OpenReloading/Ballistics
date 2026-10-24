// The import step shared by the workbook parsers: one string per worksheet, kept by date.
import type { ChronoShot } from '@open-reloading/schema'
import type { ChronoParserOptions } from './result.ts'

/**
 * `ChronoParserOptions` plus `date`: `YYYY-MM-DD`, keeps the worksheets of that day and the worksheets
 * without a date.
 */
export interface WorkbookOptions extends ChronoParserOptions {
  /** Keep only the worksheets of this day (`YYYY-MM-DD`). */
  date?: string
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
  dateWarning?: string
  /** The string, or undefined when the worksheet holds no shot row. */
  read: (warnings: string[]) => WorksheetString | undefined
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
  warnings: string[],
): { strings: { shots: ChronoShot[] }[]; labels: string[]; flags: string[]; date?: string } {
  const datesOf = (list: FoundWorksheet[]) =>
    [...new Set(list.flatMap((f) => (f.date ? [f.date] : [])))].sort()
  const fill = options.date !== undefined && found.every((f) => !f.date)
  const kept = options.date ? found.filter((f) => !f.date || f.date === options.date) : found
  if (options.date && !fill && !found.some((f) => f.date === options.date)) {
    throw new Error(
      `no string on ${options.date}; dates in the file: ${datesOf(found).join(', ') || 'none'}`,
    )
  }
  const strings: { shots: ChronoShot[] }[] = []
  const labels: string[] = []
  const flags: string[] = []
  const read: FoundWorksheet[] = []
  for (const f of kept) {
    if (options.date && !fill && !f.date) {
      warnings.push(
        `worksheet ${f.position}: no date read; ${options.date} taken from the date option`,
      )
    } else if (!fill && f.dateWarning && !warnings.includes(f.dateWarning)) {
      warnings.push(f.dateWarning)
    }
    const s = f.read(warnings)
    if (!s) {
      warnings.push(`worksheet ${f.position}: no shot rows; skipped`)
      continue
    }
    strings.push({ shots: s.shots })
    labels.push(s.label)
    flags.push(...s.flags.map((flag) => `string ${strings.length} ${flag}`))
    read.push(f)
  }
  const dates = datesOf(read)
  if (dates.length > 1) {
    warnings.push(
      `strings from several days (${dates.join(', ')}); enter the date, or import one day with the date option`,
    )
  }
  const date =
    options.date ||
    (dates.length === 1 && read.every((f) => f.date === dates[0]) ? dates[0] : undefined)
  return { strings, labels, flags, ...(date ? { date } : {}) }
}
