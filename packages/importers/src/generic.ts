import type { ChronoShot } from '@open-reloading/schema'
import { type ChronoDiagnostic, ReaderError, refuse } from './diagnostics.ts'
import {
  buildChronoImport,
  type ChronoFormatId,
  type ChronoImport,
  type ChronoParserOptions,
  type SessionCandidate,
} from './result.ts'
import { bracketed, joinQuotedLines, splitDelimited, splitLines } from './text.ts'
import { parseVelocity, parseVelocityUnit, resolveUnit } from './units.ts'

/** A column number counted from 1, or the header text of the column. */
export type Column = number | string

/**
 * Which column holds what. `velocity` is required. `string` labels the string of a shot,
 * `velocityUnit` names the velocity unit per row, `coldBore` and `excluded` flag a shot.
 */
export interface ColumnMap {
  velocity: Column
  string?: Column
  velocityUnit?: Column
  coldBore?: Column
  excluded?: Column
}

/** Cell separator of a delimited file: tab, `;`, `,`, or `none` for one cell per line. */
export type Delimiter = ',' | ';' | '\t' | 'none'

/**
 * Options of `parseDelimited`; `columns` is required.
 */
export interface DelimitedOptions extends ChronoParserOptions {
  columns: ColumnMap
  /** Cell separator; detected when absent. */
  delimiter?: Delimiter | undefined
  /** File rows before the data, used when every mapped column is a number. */
  skipRows?: number | undefined
  /** Device of the session; kind `other` without manufacturer name or model when absent. */
  device?: SessionCandidate['device'] | undefined
}

const falsy = ['', '0', 'no', 'false']
const truthy = ['1', 'x', 'yes', 'true']

const candidates = ['\t', ';', ','] as const

/** The cells of a line split at `d`; `none` keeps the trimmed line as one cell. */
export const splitCells = (line: string, d: Delimiter): string[] =>
  d === 'none' ? [line.trim()] : splitDelimited(line, d)

/** True when `d` separates cells of the line outside quoted cells. */
const splits = (line: string, d: Delimiter) => splitCells(line, d).length > 1

/**
 * Tab, `;` or `,`, the first that separates cells in every non-empty line (outside quotes),
 * else the first that does in any line, else one column.
 */
export function detectDelimiter(lines: string[]): Delimiter {
  const filled = lines.filter((l) => l.trim())
  return (
    candidates.find((d) => filled.length > 0 && filled.every((l) => splits(l, d))) ??
    candidates.find((d) => filled.some((l) => splits(l, d))) ??
    'none'
  )
}

/** Index of the first row whose cells hold every name (trimmed, case-insensitive), or -1. */
const headerIndex = (rows: string[][], names: string[]) =>
  rows.findIndex((cells) => {
    const lower = cells.map((c) => c.toLowerCase())
    return names.every((name) => lower.includes(name))
  })

/** The unit token of a header cell: its recognised bracketed text (`SPEED (FPS)`), else a recognised last word (`v fps`). */
function unitToken(cell: string): string | undefined {
  const inside = bracketed(cell)
  if (parseVelocityUnit(inside)) return inside
  const last = cell.split(' ').at(-1)
  return parseVelocityUnit(last) ? last : undefined
}

interface Row {
  lineNumber: number
  cells: string[]
}

type MappedColumn = [keyof ColumnMap, Column]

/**
 * What reading the data rows of one file shares: the cell index of each mapped column, the unit
 * token and text of the velocity header, the options, and the warnings so far.
 */
interface RowContext {
  index: Partial<Record<keyof ColumnMap, number>>
  token: string | undefined
  headerText: string | undefined
  options: DelimitedOptions
  warnings: ChronoDiagnostic[]
}

/**
 * What the user can do about a detected comma that may cut a velocity, the `remedy` param of
 * `commaMaySplit`, `commaMayCutVelocity` and `moreCellsThanHeaderComma`: quote the cell or use `;`
 * (`quoteOrSemicolon`, a template), else name the delimiter (`nameDelimiter`).
 */
export type CommaRemedy = 'quoteOrSemicolon' | 'nameDelimiter'

/** Whether a detected comma may cut a velocity, and the remedy. */
interface CommaCheck {
  mayCut: boolean
  remedy: CommaRemedy
}

/**
 * Delimited text with a user column mapping: one row per shot in firing order. Never detected.
 */
export function parseDelimited(text: string, options: DelimitedOptions): ChronoImport {
  return parseDelimitedRows('delimited', text, options)
}

/**
 * The mapped columns; throws on a column number below 1, empty header text, or a `skipRows` that
 * is not a whole number or comes with a header-text column.
 */
function validateColumns(options: DelimitedOptions): MappedColumn[] {
  const columns = Object.entries(options.columns).filter(
    (column): column is MappedColumn => column[1] !== undefined,
  )
  for (const column of columns) checkColumn(column)
  const { skipRows } = options
  if (skipRows !== undefined && !(Number.isInteger(skipRows) && skipRows >= 0))
    refuse('skipRowsNotWhole')
  if (skipRows !== undefined && columns.some(([, c]) => typeof c === 'string'))
    refuse('skipRowsWithHeaderText')
  return columns
}

/** Throws on a column number below 1 or empty header text. */
function checkColumn([key, c]: MappedColumn): void {
  if (typeof c === 'number' && !(Number.isInteger(c) && c >= 1))
    refuse('columnBelowOne', { column: key, number: c })
  if (typeof c === 'string' && !c.trim()) refuse('emptyHeaderText', { column: key })
}

/** The cell index of each mapped column: its number, or the place of its header text. */
function columnIndex(
  columns: MappedColumn[],
  header: string[] | undefined,
): Partial<Record<keyof ColumnMap, number>> {
  const index: Partial<Record<keyof ColumnMap, number>> = {}
  for (const [key, c] of columns) {
    index[key] = typeof c === 'number' ? c - 1 : (header ?? []).indexOf(c.trim().toLowerCase())
  }
  return index
}

/**
 * The delimiter named by the user, else, with header-text columns, the first under which the
 * header row is found and splits into cells, else one detected from the lines (after the header
 * row or the skipped rows).
 */
function chooseDelimiter(
  lines: string[],
  named: Delimiter | undefined,
  names: string[],
  skip: number,
): Delimiter {
  let delimiter = named
  if (delimiter === undefined && names.length > 0) {
    delimiter = candidates.find((d) => {
      const cells = lines.map((l) => splitCells(l, d))
      const row = cells[headerIndex(cells, names)]
      return row !== undefined && row.length > 1
    })
    if (delimiter === undefined) {
      const h = headerIndex(
        lines.map((l) => splitCells(l, 'none')),
        names,
      )
      delimiter = detectDelimiter(h < 0 ? lines : lines.slice(h + 1))
    }
  }
  return delimiter ?? detectDelimiter(lines.slice(skip))
}

/**
 * The header row holding every name (lower case), the text of a header-text velocity column, and
 * the rows after the header; all rows are data without names.
 */
function findHeader(
  rows: Row[],
  names: string[],
  velocity: Column,
): { header?: string[] | undefined; headerText?: string | undefined; data: Row[] } {
  if (names.length === 0) return { data: rows }
  const h = headerIndex(
    rows.map((r) => r.cells),
    names,
  )
  const row = rows[h]
  if (row === undefined) refuse('noHeaderRow', { names })
  const header = row.cells.map((c) => c.toLowerCase())
  const headerText =
    typeof velocity === 'string'
      ? row.cells[header.indexOf(velocity.trim().toLowerCase())]
      : undefined
  return { header, headerText, data: rows.slice(h + 1) }
}

/**
 * Cell counts against the header (or the first row without one), and velocities a detected comma
 * may have split. `2,800`, `2,800.0` or `812,5` split at a detected comma would cut the velocity
 * silently. Without a header row such a row throws. After a header row only an integer velocity
 * followed by 1 to 3 digits in an unmapped column is suspicious and adds one warning naming the
 * rows; mapped columns and the cell before the velocity (often a shot number) are read as they are.
 */
function checkRows(
  data: Row[],
  header: string[] | undefined,
  { index, warnings }: RowContext,
  comma: CommaCheck,
): void {
  const vi = index.velocity ?? 0
  const nextMapped = header !== undefined && Object.values(index).includes(vi + 1)
  const suspect: number[] = []
  let first: [string, string] | undefined
  const [firstRow] = data
  for (const r of data) {
    const pair = comma.mayCut ? commaPair(r, vi, header, nextMapped) : undefined
    checkRow(r, header, firstRow, { ...comma, pair })
    if (pair) {
      suspect.push(r.lineNumber)
      first ??= pair
    }
  }
  if (first) {
    warnings.push({
      code: 'commaMaySplit',
      params: { rows: suspect.map(String), cells: first.join(','), remedy: comma.remedy },
    })
  }
}

/**
 * Throws for a row with more cells than the header, for a velocity a comma may have cut in a file
 * without a header (`pair`), and for a row whose cell count differs from the first row's there.
 */
function checkRow(
  r: Row,
  header: string[] | undefined,
  firstRow: Row | undefined,
  { mayCut, remedy, pair }: CommaCheck & { pair: [string, string] | undefined },
): void {
  checkOverflow(r, header, mayCut, remedy)
  if (pair && !header)
    refuse('commaMayCutVelocity', { row: r.lineNumber, cells: pair.join(','), remedy })
  if (!header && firstRow && r.cells.length !== firstRow.cells.length) {
    refuse('cellCountDiffers', {
      row: r.lineNumber,
      cells: r.cells.length,
      firstRow: firstRow.lineNumber,
      firstCells: firstRow.cells.length,
    })
  }
}

/** Throws when a row has more cells than the header. */
function checkOverflow(
  r: Row,
  header: string[] | undefined,
  commaMayCut: boolean,
  remedy: CommaCheck['remedy'],
): void {
  if (!header || r.cells.length <= header.length) return
  const params = { row: r.lineNumber, cells: r.cells.length, header: header.length }
  if (commaMayCut) refuse('moreCellsThanHeaderComma', { ...params, remedy })
  refuse('moreCellsThanHeader', params)
}

/** The two cells of a row that may be one velocity split at a comma, when there are such. */
function commaPair(
  r: Row,
  vi: number,
  header: string[] | undefined,
  nextMapped: boolean,
): [string, string] | undefined {
  const at = (k: number) => r.cells[k] ?? ''
  const [before, v, after] = [at(vi - 1), at(vi), at(vi + 1)]
  if (header)
    return !nextMapped && /^\d+$/.test(v) && /^\d{1,3}$/.test(after) ? [v, after] : undefined
  if (/^\d+$/.test(v) && /^\d+(\.\d+)?$/.test(after)) return [v, after]
  if (/^\d{1,3}$/.test(before) && /^\d{3}(\.\d+)?$/.test(v)) return [before, v]
  return undefined
}

/**
 * The unit text of a row's velocity: a non-empty unit cell wins over the header `token`; refused
 * when both name different units.
 */
function velocityUnitText(
  unitCell: string | undefined,
  token: string | undefined,
  headerText: string | undefined,
): string | undefined {
  const [fromCell, fromHeader] = [parseVelocityUnit(unitCell), parseVelocityUnit(token)]
  if (fromCell && fromHeader && fromCell !== fromHeader) {
    refuse('unitCellDiffersFromHeader', {
      cell: unitCell ?? '',
      token: token ?? '',
      header: headerText ?? '',
    })
  }
  // an unknown unit cell does not hide a recognised header token
  return fromCell || !fromHeader ? unitCell || token : token
}

/** True for a cold bore flag, false for none; refused for any other text. */
function isColdBore(text: string | undefined): boolean {
  if (text === undefined) return false
  const lower = text.toLowerCase()
  if (truthy.includes(lower)) return true
  if (falsy.includes(lower)) return false
  return refuse('coldBoreUnknown', { text, choices: [...truthy, ...falsy.slice(1)] })
}

/**
 * The shot of one row from its mapped cells (`cell` returns undefined for an unmapped column):
 * a non-empty unit cell wins over the header token, the token over the caller's unit.
 */
function readRowShot(
  cell: (key: keyof ColumnMap) => string | undefined,
  { token, headerText, options, warnings }: RowContext,
): ChronoShot {
  const unitText = velocityUnitText(cell('velocityUnit'), token, headerText)
  const shot: ChronoShot = {
    velocity: parseVelocity(
      cell('velocity') ?? '',
      unitText,
      resolveUnit(unitText, options, warnings),
    ),
  }
  if (isColdBore(cell('coldBore'))) shot.coldBore = true
  const excluded = cell('excluded')
  if (excluded !== undefined && !falsy.includes(excluded.toLowerCase())) shot.excluded = excluded
  return shot
}

/** `readRowShot` with the row's line number in the diagnostic of a refusal. */
function readRowShotAt(
  lineNumber: number,
  cell: (key: keyof ColumnMap) => string | undefined,
  context: RowContext,
): ChronoShot {
  try {
    return readRowShot(cell, context)
  } catch (e) {
    if (!(e instanceof ReaderError)) throw e
    const d = e.diagnostic
    throw new ReaderError({ ...d, params: { ...d.params, row: lineNumber } }, { cause: e })
  }
}

/** The rows from line `skip` on that hold a cell, a quoted line break kept inside its row. */
function filledRows(lines: string[], delimiter: Delimiter, skip: number): Row[] {
  const joined =
    delimiter === 'none'
      ? lines.map((line, index) => ({ text: line, index }))
      : joinQuotedLines(lines, delimiter)
  return joined
    .filter(({ index }) => index >= skip)
    .map(({ text, index }) => ({ lineNumber: index + 1, cells: splitCells(text, delimiter) }))
    .filter((r) => r.cells.some((c) => c !== ''))
}

/**
 * Reads delimited text with `options.columns` as `format`. `detected`: the delimiter in
 * `options` was detected, not named by the user.
 */
export function parseDelimitedRows(
  format: ChronoFormatId,
  text: string,
  options: DelimitedOptions,
  detected = false,
): ChronoImport {
  const columns = validateColumns(options)
  const lines = splitLines(text)
  const names = columns.flatMap(([, c]) => (typeof c === 'string' ? [c.trim().toLowerCase()] : []))
  const skip = options.skipRows ?? 0
  const delimiter = chooseDelimiter(lines, options.delimiter, names, skip)
  const rows = filledRows(lines, delimiter, skip)
  const { header, headerText, data } = findHeader(rows, names, options.columns.velocity)
  const context: RowContext = {
    index: columnIndex(columns, header),
    token: headerText === undefined ? undefined : unitToken(headerText),
    headerText,
    options,
    warnings: [],
  }
  checkRows(data, header, context, {
    mayCut: (options.delimiter === undefined || detected) && delimiter === ',',
    // a template takes its delimiter from the header line, so the user cannot name another one
    remedy: detected ? 'quoteOrSemicolon' : 'nameDelimiter',
  })
  const { strings, labels } = readStrings(data, context)

  return buildChronoImport(
    format,
    { device: options.device ?? { kind: 'other' }, strings },
    { labels, warnings: context.warnings },
    options,
  )
}

/** The strings of the data rows: consecutive rows with an equal `string` cell form one string. */
function readStrings(
  data: Row[],
  context: RowContext,
): { strings: { shots: ChronoShot[] }[]; labels: (string | undefined)[] } {
  const { index, warnings } = context
  const strings: { shots: ChronoShot[] }[] = []
  const labels: (string | undefined)[] = []
  const seen = new Set<string>()
  let current: string | undefined
  let open: { shots: ChronoShot[] } | undefined
  for (const r of data) {
    const cell = (key: keyof ColumnMap) => {
      const i = index[key]
      return i === undefined ? undefined : (r.cells[i] ?? '')
    }
    if (!cell('velocity')) {
      warnings.push({ code: 'noVelocity', params: { row: r.lineNumber } })
      continue
    }
    const shot = readRowShotAt(r.lineNumber, cell, context)
    const label = cell('string')
    if (open === undefined || label !== current) {
      if (label !== undefined && seen.has(label))
        warnings.push({ code: 'stringReturns', params: { row: r.lineNumber, label } })
      if (label !== undefined) seen.add(label)
      open = { shots: [] }
      strings.push(open)
      labels.push(label || undefined)
      current = label
    }
    open.shots.push(shot)
  }
  return { strings, labels }
}
