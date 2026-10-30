// Tables out of delimited text, JSON lists and worksheet rows: cell text, the header row, numbers in either decimal mark.

import { maxCells, maxColumn } from './limits.ts'

/** A table of cell text: the header and the data rows. */
export interface Table {
  /** Header cells, or `Column A`, `Column B`, ... when the first row holds numbers. */
  header: string[]
  hasHeader: boolean
  /** Data rows of cell text, each as long as the header. */
  rows: string[][]
}

/** A table, or the refusal text that says why the input is none. */
export type TableRead = { table: Table } | { refusal: string }

type TableDelimiter = ',' | ';' | '\t'

/** The text of a quoted cell from `from`, after its opening quote, and the position after its closing quote (`""` is a quote). */
function readQuoted(text: string, from: number): { cell: string; next: number } {
  let cell = ''
  let i = from
  while (i < text.length) {
    const c = text.charAt(i)
    if (c === '"' && text.charAt(i + 1) === '"') {
      cell += '"'
      i += 2
    } else if (c === '"') return { cell, next: i + 1 }
    else {
      cell += c
      i++
    }
  }
  return { cell, next: i }
}

const isBlank = (row: string[]) => row.every((x) => x.trim() === '')

/**
 * Rows of cells of `text` split at `delimiter`, with quoted cells (a quoted cell may follow spaces and span lines); blank rows are left out.
 * Cells past `maxColumn + 1` in a row are dropped and splitting stops past `maxCells` cells, enough for the size refusal.
 */
function splitRows(text: string, delimiter: TableDelimiter): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let cells = 0
  let droppedFilled = false
  let i = 0
  const endCell = () => {
    if (row.length <= maxColumn) row.push(cell)
    else if (cell.trim() !== '') droppedFilled = true
    cell = ''
  }
  const endRow = () => {
    endCell()
    if (droppedFilled || !isBlank(row)) {
      rows.push(row)
      cells += row.length
    }
    row = []
    droppedFilled = false
  }
  while (i < text.length && cells <= maxCells) {
    const c = text.charAt(i)
    if (c === '"' && /^[ \t]*$/.test(cell)) {
      const q = readQuoted(text, i + 1)
      cell = q.cell
      i = q.next
    } else if (c === delimiter) {
      endCell()
      i++
    } else if (c === '\n' || c === '\r') {
      endRow()
      i += c === '\r' && text.charAt(i + 1) === '\n' ? 2 : 1
    } else {
      cell += c
      i++
    }
  }
  endRow()
  return rows
}

/**
 * The delimiter that gives the most rows as wide as the first, which must be two cells or more
 * and repeat in a second row; none when no delimiter makes a table.
 */
function detectDelimiter(text: string): TableDelimiter | undefined {
  const sample = text.slice(0, 20_000)
  let best: { d: TableDelimiter; score: number } | undefined
  for (const d of [',', ';', '\t'] as const) {
    const rows = splitRows(sample, d).slice(0, 30)
    const width = rows[0]?.length ?? 0
    const same = rows.filter((r) => r.length === width).length
    if (width < 2 || same < 2) continue
    const score = same * width
    if (!best || score > best.score) best = { d, score }
  }
  return best?.d
}

const numberLike = /^[+-]?(\d+([.,]\d+)?|[.,]\d+)$/

/** Letters of a spreadsheet column: 0 is A, 26 is AA. */
function columnLetters(i: number): string {
  let letters = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26))
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters
  return letters
}

/** The refusal of a table of `width` columns and `rows` rows beyond the size the readers take. */
function tooLarge(width: number, rows: number): TableRead | undefined {
  if (width > maxColumn)
    return {
      refusal: `The table has more than ${maxColumn} columns. Remove the extra columns or choose another file.`,
    }
  if (width * rows > maxCells)
    return {
      refusal: `The table has more than ${maxCells} cells. Split it into smaller files.`,
    }
  return undefined
}

const headerOnly: TableRead = {
  refusal: 'The table has a header but no rows. Add rows or choose another file.',
}

/**
 * A table from rows of cell text, such as the rows of a worksheet; the first row is the header
 * unless most of its cells are numbers. Refused below two columns or without data rows.
 */
export function tableOfRows(raw: string[][]): TableRead {
  const width = raw.reduce((m, r) => Math.max(m, r.length), 0)
  if (width < 2) return { refusal: 'The rows have no table of two columns or more.' }
  const refused = tooLarge(width, raw.length)
  if (refused) return refused
  const padded = raw.map((r) => Array.from({ length: width }, (_, i) => (r[i] ?? '').trim()))
  const first = padded[0] ?? []
  const filled = first.filter((c) => c !== '')
  const hasHeader =
    filled.length > 0 && filled.filter((c) => numberLike.test(c)).length * 2 < filled.length
  const header = hasHeader
    ? first.map((c, i) => c || `Column ${columnLetters(i)}`)
    : first.map((_, i) => `Column ${columnLetters(i)}`)
  const rows = hasHeader ? padded.slice(1) : padded
  return rows.length === 0 ? headerOnly : { table: { header, hasHeader, rows } }
}

/** A table from a JSON list of objects: the keys of all objects as columns. Undefined for no such list. */
function tableOfObjects(list: unknown): TableRead | undefined {
  if (!Array.isArray(list)) return undefined
  const objects = list.filter(
    (x): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x),
  )
  if (objects.length === 0 || objects.length !== list.length) return undefined
  const keys = [...new Set(objects.flatMap((o) => Object.keys(o)))]
  if (keys.length < 2) return undefined
  const refused = tooLarge(keys.length, objects.length)
  if (refused) return refused
  const cell = (v: unknown) =>
    v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
  return {
    table: {
      header: keys,
      hasHeader: true,
      rows: objects.map((o) => keys.map((k) => cell(Object.hasOwn(o, k) ? o[k] : undefined))),
    },
  }
}

/**
 * The table of a text: a JSON list of objects, or delimited text (comma, semicolon or tab) with
 * two or more rows of equal width. Otherwise the refusal names the cause and one action.
 */
export function readTable(raw: string): TableRead {
  const text = raw.replace(/^\uFEFF/, '')
  if (/^\s*[[{]/.test(text)) {
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      return {
        refusal: 'The text looks like JSON but does not parse. Fix the file or export it again.',
      }
    }
    return (
      tableOfObjects(json) ?? {
        refusal:
          'The JSON is neither an OpenReloading data file nor a list of objects with the same keys. Export a table instead.',
      }
    )
  }
  const delimiter = detectDelimiter(text)
  if (!delimiter) {
    return {
      refusal:
        'The text has no table: no row repeats a comma, semicolon or tab as separator. Export the table as CSV.',
    }
  }
  return tableOfRows(splitRows(text, delimiter))
}

const opening = '([{'
const closing = ')]}'

/** Each bracketed part on one line replaced by a space, from an opening bracket to the next closing one of any kind; linear time. */
function withoutBrackets(text: string): string {
  let out = ''
  let open: string | undefined
  for (const c of text) {
    if (open === undefined) {
      if (opening.includes(c)) open = c
      else out += c
    } else if (closing.includes(c)) {
      out += ' '
      open = undefined
    } else if ('\n\r\u2028\u2029'.includes(c)) {
      out += open + c
      open = undefined
    } else open += c
  }
  return out + (open ?? '')
}

/** The trimmed text inside the first brackets that hold any, their last character when they hold only white space; linear time. */
function firstBracketed(text: string): string | undefined {
  let open = -1
  for (let i = 0; i < text.length; i++) {
    const c = text.charAt(i)
    if (open < 0) {
      if (opening.includes(c)) open = i
    } else if (closing.includes(c)) {
      if (i > open + 1) return text.slice(open + 1, i).trim() || text.charAt(i - 1)
      open = -1
    }
  }
  return undefined
}

/** The header as words: lower case, accents and umlauts folded, units in brackets removed. */
export function headerWords(header: string): string[] {
  return withoutBrackets(header)
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

/** The unit word a header carries in brackets or after a slash, underscore or space, lower case; undefined for none. */
export function headerUnit(header: string): string | undefined {
  const bracket = firstBracketed(header)
  const tail = /[_/ ]([a-z]{1,6})$/i.exec(header)?.[1]
  return (bracket ?? tail)?.toLowerCase()
}

/** A number in text with `decimal` as its mark: spaces and the other mark are grouping. Undefined for no finite number. */
export function readNumber(text: string, decimal: '.' | ','): number | undefined {
  const t = text.trim().replace(/[\s ']/g, '')
  if (t === '') return undefined
  const group = decimal === '.' ? ',' : '.'
  const plain = t.replaceAll(group, '').replace(decimal, '.')
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i.test(plain)) return undefined
  const n = Number(plain)
  return Number.isFinite(n) ? n : undefined
}

/** The decimal mark of a column from its cells, and whether a cell could also read as a grouped integer. */
export function guessDecimal(cells: string[]): { decimal: '.' | ','; ambiguous: boolean } {
  let comma = 0
  let point = 0
  let ambiguous = false
  for (const c of cells) {
    const t = c.trim()
    if (/^[+-]?\d+,\d+$/.test(t)) {
      comma++
      if (/^[+-]?\d{1,3},\d{3}$/.test(t)) ambiguous = true
    } else if (/^[+-]?\d*\.\d+$/.test(t)) point++
    else if (/^[+-]?\d{1,3}(\.\d{3})+,\d+$/.test(t)) comma++
  }
  return { decimal: comma > point ? ',' : '.', ambiguous: ambiguous && comma > 0 && point === 0 }
}
