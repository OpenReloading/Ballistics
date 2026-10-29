// Text of export files: bytes to text, lines, cells, numbers and dates.

/**
 * UTF-16 LE after FF FE, UTF-16 BE after FE FF, else UTF-8, all strict: other encodings (Windows-1252
 * from spreadsheets) and damaged text throw, so labels and reasons never hold replacement
 * characters. A UTF-8 byte order mark stays as U+FEFF; the parsers remove it.
 */
export function decodeText(bytes: Uint8Array): string {
  const le = bytes[0] === 0xff && bytes[1] === 0xfe
  const be = bytes[0] === 0xfe && bytes[1] === 0xff
  if ((le || be) && bytes.length % 2 !== 0)
    throw new Error('UTF-16 text with an odd number of bytes')
  const encoding = le ? 'utf-16le' : be ? 'utf-16be' : 'utf-8'
  const decoder = new TextDecoder(encoding, { fatal: true, ignoreBOM: true })
  try {
    return decoder.decode(le || be ? bytes.subarray(2) : bytes)
  } catch {
    throw new Error(
      'the file is not UTF-8 or UTF-16 text; save it as UTF-8 (CSV UTF-8) and import again',
    )
  }
}

/** The text of a quoted cell from `from`, after its opening quote, and the position after its closing quote. */
function readQuoted(line: string, from: number): { cell: string; next: number } {
  let cell = ''
  let i = from
  while (i < line.length && !(line[i] === '"' && line[i + 1] !== '"')) {
    if (line[i] === '"') i++
    cell += line[i++]
  }
  return { cell, next: i + 1 }
}

/**
 * Cells split at `delimiter`; quotes may follow spaces, `""` is a quote inside a quoted cell, and
 * text between a closing quote and the delimiter is kept. Tabs before a cell are skipped only
 * when the delimiter is not a tab.
 */
export function splitDelimited(line: string, delimiter: ',' | ';' | '\t' = ','): string[] {
  const cells: string[] = []
  let i = 0
  while (i <= line.length) {
    while (line[i] === ' ' || (line[i] === '\t' && delimiter !== '\t')) i++
    let cell = ''
    if (line[i] === '"') {
      const quoted = readQuoted(line, i + 1)
      cell = quoted.cell
      i = quoted.next
    }
    const end = line.indexOf(delimiter, i)
    cell += line.slice(i, end < 0 ? line.length : end)
    i = end < 0 ? line.length + 1 : end + 1
    cells.push(cell.trim())
  }
  return cells
}

/** Lines without byte order marks or NUL characters, which exports carry in varying places. */
export function splitLines(text: string): string[] {
  return text
    .replaceAll('﻿', '')
    .replaceAll('\0', '')
    .split(/\r\n|\r|\n/)
}

/**
 * A number with a decimal point or a decimal comma; NaN for anything else, including both
 * a lone comma before exactly three digits (`2,800`), which may be a thousands separator,
 * and a digit run too long for a finite number.
 */
export function parseNumber(text: string): number {
  const t = text.trim()
  if (t.includes(',') && t.includes('.')) return Number.NaN
  if (/^[+-]?\d{1,3},\d{3}$/.test(t)) return Number.NaN
  const s = t.replace(',', '.')
  const n = /^[+-]?\d+(\.\d+)?$/.test(s) ? Number(s) : Number.NaN
  return Number.isFinite(n) ? n : Number.NaN
}

/** Text from the first `(` to the last `)` when it is not empty, else undefined; linear time. */
export function bracketed(text: string): string | undefined {
  const a = text.indexOf('(')
  const b = text.lastIndexOf(')')
  return a >= 0 && b > a + 1 ? text.slice(a + 1, b) : undefined
}

/** The text without the commas that end it and the white space after them; linear time. */
export function withoutTrailingCommas(text: string): string {
  let end = text.trimEnd().length
  while (end > 0 && text[end - 1] === ',') end--
  return text.slice(0, end)
}

/** Seconds as minutes with up to two decimals, `90.5 min`. */
export const formatMinutes = (seconds: number) => `${Number((seconds / 60).toFixed(2))} min`

export function isoDate(year: number, month: number, day: number): string | undefined {
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return undefined
  }
  return d.toISOString().slice(0, 10)
}

/** Year-first dates only (2026-03-05, 2026/3/5); day-month order is never guessed. */
export function yearFirstDate(text: string): string | undefined {
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text.trim())
  return m ? isoDate(Number(m[1]), Number(m[2]), Number(m[3])) : undefined
}
