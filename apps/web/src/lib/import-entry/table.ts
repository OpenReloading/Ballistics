/** Tables out of text, JSON and worksheets: rows of cell text, the header row, numbers in either decimal mark. */

export type Delimiter = ',' | ';' | '\t'

export interface Table {
  /** Header cells, or `Column A`, `Column B`, ... when the first row holds numbers. */
  header: string[]
  hasHeader: boolean
  /** Data rows of cell text, each as long as the header. */
  rows: string[][]
}

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

/** Rows of cells of `text` split at `delimiter`, with quoted cells (a quoted cell may span lines); blank rows are left out. */
export function splitRows(text: string, delimiter: Delimiter): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let i = 0
  const endCell = () => {
    row.push(cell)
    cell = ''
  }
  const endRow = () => {
    endCell()
    if (!isBlank(row)) rows.push(row)
    row = []
  }
  while (i < text.length) {
    const c = text.charAt(i)
    if (c === '"' && cell === '') {
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

/** The delimiter that gives the most rows of equal, larger-than-one length; none when no delimiter makes a table. */
export function detectDelimiter(text: string): Delimiter | undefined {
  const sample = text.slice(0, 20_000)
  let best: { d: Delimiter; score: number } | undefined
  for (const d of [',', ';', '\t'] as const) {
    const rows = splitRows(sample, d).slice(0, 30)
    const width = rows[0]?.length ?? 0
    if (width < 2) continue
    const score = rows.filter((r) => r.length === width).length * width
    if (!best || score > best.score) best = { d, score }
  }
  return best?.d
}

const numberLike = /^[+-]?(\d+([.,]\d+)?|[.,]\d+)$/

/** Letters of a spreadsheet column: 0 is A. */
const columnLetters = (i: number): string =>
  i < 26 ? String.fromCharCode(65 + i) : `A${columnLetters(i - 26)}`

/** A table from rows of cell text; the first row is the header unless most of its cells are numbers. */
export function tableOf(raw: string[][]): Table | undefined {
  const width = Math.max(0, ...raw.map((r) => r.length))
  if (width < 2 || raw.length < 1) return undefined
  const padded = raw.map((r) => Array.from({ length: width }, (_, i) => (r[i] ?? '').trim()))
  const first = padded[0] ?? []
  const filled = first.filter((c) => c !== '')
  const hasHeader =
    filled.length > 0 && filled.filter((c) => numberLike.test(c)).length * 2 < filled.length
  const header = hasHeader
    ? first.map((c, i) => c || `Column ${columnLetters(i)}`)
    : first.map((_, i) => `Column ${columnLetters(i)}`)
  return { header, hasHeader, rows: hasHeader ? padded.slice(1) : padded }
}

/** A table from a JSON list of objects: the keys of all objects as columns. */
export function tableOfObjects(list: unknown[]): Table | undefined {
  const objects = list.filter(
    (x): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x),
  )
  if (objects.length === 0 || objects.length !== list.length) return undefined
  const keys = [...new Set(objects.flatMap((o) => Object.keys(o)))]
  if (keys.length < 2) return undefined
  const cell = (v: unknown) =>
    v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
  return { header: keys, hasHeader: true, rows: objects.map((o) => keys.map((k) => cell(o[k]))) }
}

/** The header as words: lower case, accents and umlauts folded, units in brackets removed. */
export function headerWords(header: string): string[] {
  return header
    .replace(/[([{].*?[)\]}]/g, ' ')
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

/** The unit word a header carries in brackets or after a slash or underscore, lower case; undefined for none. */
export function headerUnit(header: string): string | undefined {
  const bracket = /[([{]\s*([^)\]}]+?)\s*[)\]}]/.exec(header)?.[1]
  const tail = /[_/ ]([a-z]{1,4})$/i.exec(header)?.[1]
  return (bracket ?? tail)?.toLowerCase()
}

/** A number in text with `decimal` as its mark: spaces and the other mark are grouping. Undefined for no number. */
export function readNumber(text: string, decimal: '.' | ','): number | undefined {
  const t = text.trim().replace(/[\s ']/g, '')
  if (t === '') return undefined
  const group = decimal === '.' ? ',' : '.'
  const plain = t.replaceAll(group, '').replace(decimal, '.')
  return /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(plain) ? Number(plain) : undefined
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
