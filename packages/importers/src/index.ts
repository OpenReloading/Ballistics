import type { Workbook } from './cells.ts'
import { type DelimitedOptions, parseDelimited } from './generic.ts'
import { isOpenReloadingJson, parseOpenReloadingJson } from './openreloading-json.ts'
import type { ChronoImport, ChronoParserOptions } from './result.ts'
import {
  isShotViewHeader,
  parseShotView,
  parseShotViewWorkbook,
  shotViewHeaderIndex,
} from './shotview.ts'
import { isOpenReloadingCsv, parseOpenReloadingCsv } from './template.ts'
import { splitLines } from './text.ts'

export type { Workbook, Worksheet } from './cells.ts'
export { readCsrLoad } from './csrload.ts'
export type { Column, ColumnMap, DelimitedOptions, Delimiter } from './generic.ts'
export { parseDelimited } from './generic.ts'
export type { GrtLoadRead } from './grtload.ts'
export { readGrtLoad } from './grtload.ts'
export {
  isOpenReloadingJson,
  parseOpenReloadingJson,
  sessionJsonFormat,
  stringifyOpenReloadingJson,
} from './openreloading-json.ts'
export type {
  PressureHistoryImport,
  PressureHistoryOptions,
  PressureUnit,
  SensorPosition,
  TimeUnit,
} from './pressure-history.ts'
export { parsePressureHistory } from './pressure-history.ts'
export type { ColumnUnit, FieldSpec, TableKind } from './record-fields.ts'
export { fieldSpecs, tableKinds } from './record-fields.ts'
export { idOfKey } from './record-ids.ts'
export type {
  BuiltEntry,
  BuiltRecords,
  KindScore,
  KindSuggestion,
  RowCounts,
  RowIssue,
  TableColumnMap,
  Tier,
} from './records.ts'
export { autoMap, buildRecords, suggestKind, tierFloors } from './records.ts'
export type { ChronoImport, ChronoParserOptions, SessionCandidate } from './result.ts'
export { parseShotView, parseShotViewWorkbook } from './shotview.ts'
export type { Table, TableRead } from './tables.ts'
export { readTable, tableOfRows } from './tables.ts'
export type { TemplateOptions } from './template.ts'
export { parseOpenReloadingCsv } from './template.ts'
export { decodeText, formatMinutes } from './text.ts'
export type { VelocityUnit } from './units.ts'
export { parseVelocityUnit } from './units.ts'
export { isWorkbook, readWorkbook } from './workbook.ts'
export type { WorkbookOptions } from './worksheet-strings.ts'
export type { Inflate } from './zip.ts'

/** Options of `parseChrono`, each passed only to the formats that take it. */
export interface ParseChronoOptions
  extends ChronoParserOptions,
    Partial<Omit<DelimitedOptions, keyof ChronoParserOptions>> {
  /** `YYYY-MM-DD`: the formats that read it keep only this day. */
  date?: string | undefined
}

/** A chronograph format that reads text. */
export interface TextChronoFormat {
  id: string
  /** Shown to users. */
  name: string
  reads: 'text'
  /** True when the text is in this format; absent when the format needs a column mapping. */
  detect?: (text: string) => boolean
  /** Reads the text; throws when it does not fit the format. */
  parse: (text: string, options: ParseChronoOptions) => ChronoImport
}

/** A chronograph format that reads a workbook read by `readWorkbook`. */
export interface WorkbookChronoFormat {
  id: string
  /** Shown to users. */
  name: string
  reads: 'workbook'
  /** True when the workbook is in this format, told by its cells alone. */
  detect: (book: Workbook) => boolean
  /** Reads the workbook; throws when it does not fit the format. */
  parse: (book: Workbook, options: ParseChronoOptions) => ChronoImport
}

/** One entry of `chronoFormats`. */
export type ChronoFormat = TextChronoFormat | WorkbookChronoFormat

/** Options of the format parsers that read none of `date`, `device` and the column mapping. */
function withoutFormatOptions(options: ParseChronoOptions): ChronoParserOptions {
  const { date, device, columns, delimiter, skipRows, ...rest } = options
  return rest
}

/** Workbook detection by its cells alone (never by file or worksheet names). */
const anyRow = (book: Workbook, test: (cells: string[]) => boolean) =>
  book.worksheets.some((s) => s.rows.some(test))

// the literal list: `ChronoFormatId` and `WorkbookFormat` read its ids; a format registers here only
const formats = [
  {
    id: 'openreloading-json',
    name: 'OpenReloading JSON',
    reads: 'text',
    /** True when the text is JSON with `format` `openreloading-session`. */
    detect: isOpenReloadingJson,
    /** Parses an OpenReloading session JSON text; velocities are m/s. */
    parse: (text: string, options: ParseChronoOptions) =>
      parseOpenReloadingJson(text, withoutFormatOptions(options)),
  },
  {
    id: 'shotview-csv',
    name: 'Garmin Xero ShotView CSV',
    reads: 'text',
    /** True when a line is a ShotView header row. */
    detect: (text: string) => shotViewHeaderIndex(splitLines(text)) >= 0,
    /** Reads a ShotView CSV text into one string; velocity unit from the header brackets, date from the footer. */
    parse: (text: string, options: ParseChronoOptions) =>
      parseShotView(text, withoutFormatOptions(options)),
  },
  {
    id: 'shotview-xlsx',
    name: 'Garmin Xero ShotView workbook',
    reads: 'workbook',
    /** True when a worksheet row is a ShotView header row. */
    detect: (book: Workbook) => anyRow(book, isShotViewHeader),
    /** Reads a ShotView workbook into one string per worksheet; `date` (`YYYY-MM-DD`) keeps one day. */
    parse: (book: Workbook, options: ParseChronoOptions) =>
      parseShotViewWorkbook(book, { ...withoutFormatOptions(options), date: options.date }),
  },
  {
    id: 'openreloading-csv',
    name: 'OpenReloading CSV template',
    reads: 'text',
    /** True when the first row holds known column names with `velocity` among them. */
    detect: isOpenReloadingCsv,
    /** Parses an OpenReloading CSV template; `device` sets the device. */
    parse: (text: string, options: ParseChronoOptions) =>
      parseOpenReloadingCsv(text, { ...withoutFormatOptions(options), device: options.device }),
  },
  {
    id: 'delimited',
    name: 'delimited text with a column mapping',
    reads: 'text',
    /** Parses delimited text with the column mapping in `columns`; throws without it. */
    parse: (text: string, options: ParseChronoOptions) => {
      const { columns, delimiter, skipRows, device } = options
      if (!columns) throw new Error('the delimited format needs a column mapping')
      return parseDelimited(text, {
        ...withoutFormatOptions(options),
        columns,
        delimiter,
        skipRows,
        device,
      })
    },
  },
] as const satisfies readonly ChronoFormat[]

/**
 * Every chronograph format, listed to users in this order by `name`; detection walks the list.
 * `delimited` has no `detect`: it needs a column mapping.
 */
export const chronoFormats: readonly ChronoFormat[] = formats

/** A chronograph format id, one per entry of `chronoFormats`. */
export type ChronoFormatId = (typeof formats)[number]['id']

type WorkbookFormat = Extract<(typeof formats)[number], { reads: 'workbook' }>['id']

/**
 * The format of a chronograph export, told by its shape, or null when none matches.
 * `delimited` is never returned: it needs a column mapping.
 */
export function detectFormat(text: string): ChronoFormatId | null {
  for (const f of formats) if (f.reads === 'text' && 'detect' in f && f.detect(text)) return f.id
  return null
}

/**
 * The format of a workbook read by `readWorkbook`, told by its cells alone (never by file or
 * worksheet names), or null when none matches.
 */
export function detectWorkbookFormat(book: Workbook): WorkbookFormat | null {
  for (const f of formats) if (f.reads === 'workbook' && f.detect(book)) return f.id
  return null
}

/**
 * Parses text or a workbook (read by the caller) as `format`, detected by `detectFormat` or
 * `detectWorkbookFormat` when not given; null when none is detected.
 */
export function parseChrono(
  input: string | Workbook,
  options: ParseChronoOptions,
  format: ChronoFormatId,
): ChronoImport
export function parseChrono(
  input: string | Workbook,
  options?: ParseChronoOptions,
): ChronoImport | null
export function parseChrono(
  input: string | Workbook,
  options: ParseChronoOptions = {},
  format?: ChronoFormatId,
): ChronoImport | null {
  const text = typeof input === 'string'
  const id = format ?? (text ? detectFormat(input) : detectWorkbookFormat(input))
  const f = chronoFormats.find((c) => c.id === id)
  if (!f) return null
  if (f.reads === 'text') {
    if (!text) throw new Error(`${f.id} reads text files; this file is a workbook`)
    return f.parse(input, options)
  }
  if (text) throw new Error(`${f.id} reads workbooks; this file is text`)
  return f.parse(input, options)
}
