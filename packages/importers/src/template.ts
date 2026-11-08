// The OpenReloading CSV template: delimited text whose first row names the columns.
import { refuse } from './diagnostics.ts'
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
  device?: SessionCandidate['device'] | undefined
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
  const known = names.filter((n) => n !== undefined)
  if (!known.includes('velocity') || known.length !== names.length) return undefined
  return { names: known, delimiter }
}

/** OpenReloading CSV template: a first row of known column names, `velocity` among them. */
export function isOpenReloadingCsv(text: string): boolean {
  return templateHeader(text) !== undefined
}

/**
 * Parses an OpenReloading CSV template (first row names columns, delimiter read from it);
 * velocities in the unit of the `velocityUnit` column or the `velocityUnit` option.
 */
export function parseOpenReloadingCsv(text: string, options: TemplateOptions = {}): ChronoImport {
  const h = templateHeader(text)
  if (!h) refuse('notTemplate', { columns: templateNames })
  const columns: ColumnMap = { velocity: 'velocity' }
  for (const n of h.names) columns[n] = n
  return parseDelimitedRows(
    'openreloading-csv',
    text,
    { ...options, columns, delimiter: h.delimiter },
    true,
  )
}
