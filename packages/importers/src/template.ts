// The OpenReloading CSV template: delimited text whose first row names the columns.
import {
  type ColumnMap,
  type Delimiter,
  detectDelimiter,
  parseDelimitedRows,
  splitCells,
} from './generic.ts'
import type { ChronoImport, ChronoParserOptions, SessionCandidate } from './result.ts'
import { splitLines } from './text.ts'

/** Options of `parseOpenReloadingCsv`: the parser options and the device of the session. */
export interface TemplateOptions extends ChronoParserOptions {
  /** Device of the session; kind `other` without manufacturer name or model when absent. */
  device?: SessionCandidate['device']
}

const templateNames = ['string', 'velocity', 'velocityUnit', 'coldBore', 'excluded'] as const

function templateHeader(
  text: string,
): { names: (typeof templateNames)[number][]; delimiter: Delimiter } | undefined {
  const first = splitLines(text).find((l) => l.trim())
  if (first === undefined) return undefined
  const delimiter = detectDelimiter([first])
  const cells = splitCells(first, delimiter)
  while (cells.length > 1 && cells[cells.length - 1] === '') cells.pop()
  const names = cells.map((c) => templateNames.find((n) => n.toLowerCase() === c.toLowerCase()))
  if (!names.includes('velocity') || names.some((n) => n === undefined)) return undefined
  return { names: names as (typeof templateNames)[number][], delimiter }
}

/** OpenReloading CSV template: a first row of known column names, `velocity` among them. */
export function isOpenReloadingCsv(text: string): boolean {
  return templateHeader(text) !== undefined
}

/**
 * Parses an OpenReloading CSV template (first row names columns, delimiter read from it) into one
 * `ChronoImport`; velocities in the unit of the `velocityUnit` column or the `velocityUnit` option.
 */
export function parseOpenReloadingCsv(text: string, options: TemplateOptions = {}): ChronoImport {
  const h = templateHeader(text)
  if (!h) {
    throw new Error(
      `not an OpenReloading CSV template: the first row must name columns from ${templateNames.join(', ')}, velocity among them`,
    )
  }
  const columns = Object.fromEntries(h.names.map((n) => [n, n])) as unknown as ColumnMap
  return parseDelimitedRows(
    'openreloading-csv',
    text,
    { ...options, columns, delimiter: h.delimiter },
    true,
  )
}
