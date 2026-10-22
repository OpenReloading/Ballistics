import type { ChronoShot } from '@openreloading/schema'
import {
  buildChronoImport,
  type ChronoFormatId,
  type ChronoImport,
  type ChronoParserOptions,
  type SessionCandidate,
} from './result.ts'
import { bracketed, splitDelimited, splitLines } from './text.ts'
import { parseVelocity, parseVelocityUnit, resolveUnit } from './units.ts'

/** A column number counted from 1, or the header text of the column. */
export type Column = number | string

/**
 * Which column holds what, each a column number counted from 1 or header text. `velocity` is
 * required. `string` labels the string of a shot, `velocityUnit` names the velocity unit per row,
 * `coldBore` and `excluded` flag a shot.
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
 * Column mapping (required), delimiter (detected when absent), number of file rows before the
 * data (numeric columns only), and the device.
 */
export interface DelimitedOptions extends ChronoParserOptions {
  columns: ColumnMap
  /** Cell separator; detected when absent. */
  delimiter?: Delimiter
  /** File rows before the data, used when every mapped column is a number. */
  skipRows?: number
  /** Device of the session; kind `other` without manufacturer name or model when absent. */
  device?: SessionCandidate['device']
}

const falsy = ['', '0', 'no', 'false']
const truthy = ['1', 'x', 'yes', 'true']

const candidates = ['\t', ';', ','] as const

/** The cells of a line split at `d`; `none` keeps the trimmed line as one cell. */
export const splitCells = (line: string, d: Delimiter) =>
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
 * Delimited text with a user column mapping: one row per shot in firing order.
 * Never detected; the caller names the columns.
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
    ([, c]) => c !== undefined,
  ) as MappedColumn[]
  for (const [key, c] of columns) {
    if (typeof c === 'number' && !(Number.isInteger(c) && c >= 1)) {
      throw new Error(`column ${key} = ${c}: column numbers count from 1`)
    }
    if (typeof c === 'string' && !c.trim()) throw new Error(`column ${key}: empty header text`)
  }
  if (options.skipRows !== undefined) {
    if (!Number.isInteger(options.skipRows) || options.skipRows < 0) {
      throw new Error('skipRows must be a whole number >= 0')
    }
  }
  if (columns.some(([, c]) => typeof c === 'string') && options.skipRows !== undefined) {
    throw new Error(
      'skipRows applies only when every column is a number; the header row is found by name',
    )
  }
  return columns
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
      const h = headerIndex(
        lines.map((l) => splitCells(l, d)),
        names,
      )
      return h >= 0 && splits(lines[h], d)
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
): { header?: string[]; headerText?: string; data: Row[] } {
  if (names.length === 0) return { data: rows }
  const h = headerIndex(
    rows.map((r) => r.cells),
    names,
  )
  if (h < 0) throw new Error(`no header row holds ${names.map((n) => `"${n}"`).join(', ')}`)
  const header = rows[h].cells.map((c) => c.toLowerCase())
  const headerText =
    typeof velocity === 'string'
      ? rows[h].cells[header.indexOf(velocity.trim().toLowerCase())]
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
  index: Partial<Record<keyof ColumnMap, number>>,
  commaMayCut: boolean,
  remedy: string,
  warnings: string[],
): void {
  const vi = index.velocity ?? 0
  const nextMapped = header !== undefined && Object.values(index).includes(vi + 1)
  const pair = (r: Row): [string, string] | undefined => {
    const [before, v, after] = [r.cells[vi - 1] ?? '', r.cells[vi] ?? '', r.cells[vi + 1] ?? '']
    if (header)
      return !nextMapped && /^\d+$/.test(v) && /^\d{1,3}$/.test(after) ? [v, after] : undefined
    if (/^\d+$/.test(v) && /^\d+(\.\d+)?$/.test(after)) return [v, after]
    if (/^\d{1,3}$/.test(before) && /^\d{3}(\.\d+)?$/.test(v)) return [before, v]
    return undefined
  }
  const suspect: number[] = []
  let first: [string, string] | undefined
  for (const r of data) {
    if (header && r.cells.length > header.length) {
      const hint = commaMayCut
        ? `; an unquoted comma inside a cell (a decimal comma or a thousands separator) splits it: ${remedy}`
        : ''
      throw new Error(
        `row ${r.lineNumber}: ${r.cells.length} cells, the header has ${header.length}${hint}`,
      )
    }
    const p = commaMayCut ? pair(r) : undefined
    if (p && !header) {
      throw new Error(
        `row ${r.lineNumber}: "${p.join(',')}" may be one velocity with a decimal comma or a thousands separator; ${remedy}`,
      )
    }
    if (p) {
      suspect.push(r.lineNumber)
      first ??= p
    }
    if (!header && r.cells.length !== data[0].cells.length) {
      throw new Error(
        `row ${r.lineNumber}: ${r.cells.length} cells, row ${data[0].lineNumber} has ${data[0].cells.length}`,
      )
    }
  }
  if (first) {
    const rowsText =
      suspect.length === 1
        ? `row ${suspect[0]}`
        : `rows ${suspect.slice(0, 5).join(', ')}${suspect.length > 5 ? ` and ${suspect.length - 5} more` : ''}`
    warnings.push(
      `${rowsText}: "${first.join(',')}" may be a velocity with a decimal comma or a thousands separator split by the delimiter; check the values or ${remedy}`,
    )
  }
}

/**
 * The shot of one row from its mapped cells (`cell` returns undefined for an unmapped column):
 * a non-empty unit cell wins over the header `token`, the token over the caller's unit.
 */
function readRowShot(
  cell: (key: keyof ColumnMap) => string | undefined,
  token: string | undefined,
  headerText: string | undefined,
  options: DelimitedOptions,
  warnings: string[],
): ChronoShot {
  const v = cell('velocity') ?? ''
  const unitCell = cell('velocityUnit')
  const [fromCell, fromHeader] = [parseVelocityUnit(unitCell), parseVelocityUnit(token)]
  if (fromCell && fromHeader && fromCell !== fromHeader) {
    throw new Error(
      `velocityUnit "${unitCell}" differs from "${token}" in the velocity header "${headerText}"`,
    )
  }
  // an unknown unit cell does not hide a recognised header token
  const unitText = fromCell || !fromHeader ? unitCell || token : token
  const shot: ChronoShot = {
    velocity: parseVelocity(v, unitText, resolveUnit(unitText, options, warnings)),
  }
  const cold = cell('coldBore')?.toLowerCase()
  if (cold !== undefined && truthy.includes(cold)) shot.coldBore = true
  else if (cold !== undefined && !falsy.includes(cold)) {
    throw new Error(
      `coldBore "${cell('coldBore')}" is not one of ${[...truthy, ...falsy.slice(1)].join(', ')} or empty`,
    )
  }
  const excluded = cell('excluded')
  if (excluded !== undefined && !falsy.includes(excluded.toLowerCase())) shot.excluded = excluded
  return shot
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
  const rows: Row[] = lines
    .map((line, i) => ({ lineNumber: i + 1, cells: splitCells(line, delimiter) }))
    .slice(skip)
    .filter((r) => r.cells.some((c) => c !== ''))
  const { header, headerText, data } = findHeader(rows, names, options.columns.velocity)
  const index = {} as Partial<Record<keyof ColumnMap, number>>
  for (const [key, c] of columns) {
    index[key] = typeof c === 'number' ? c - 1 : (header ?? []).indexOf(c.trim().toLowerCase())
  }

  const commaMayCut = (options.delimiter === undefined || detected) && delimiter === ','
  // a template takes its delimiter from the header line, so the user cannot name another one
  const remedy = detected ? "quote the cell or use ';' as the delimiter" : 'name the delimiter'
  const warnings: string[] = []
  checkRows(data, header, index, commaMayCut, remedy, warnings)

  const token = headerText === undefined ? undefined : unitToken(headerText)
  const strings: { shots: ChronoShot[] }[] = []
  const labels: (string | undefined)[] = []
  const seen = new Set<string>()
  let current: string | undefined
  for (const r of data) {
    const cell = (key: keyof ColumnMap) => {
      const i = index[key]
      return i === undefined ? undefined : (r.cells[i] ?? '')
    }
    if (!cell('velocity')) {
      warnings.push(`row ${r.lineNumber}: no velocity; skipped`)
      continue
    }
    let shot: ChronoShot
    try {
      shot = readRowShot(cell, token, headerText, options, warnings)
    } catch (e) {
      throw new Error(`row ${r.lineNumber}: ${(e as Error).message}`)
    }
    const label = cell('string')
    if (strings.length === 0 || label !== current) {
      if (label !== undefined && seen.has(label)) {
        warnings.push(
          `row ${r.lineNumber}: string "${label}" returns after another string; read as a new string`,
        )
      }
      if (label !== undefined) seen.add(label)
      strings.push({ shots: [] })
      labels.push(label || undefined)
      current = label
    }
    strings[strings.length - 1].shots.push(shot)
  }

  return buildChronoImport(
    format,
    { device: options.device ?? { kind: 'other' }, strings },
    labels,
    warnings,
    options,
  )
}
