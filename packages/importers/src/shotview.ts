import type { Workbook } from './cells.ts'
import { buildChronoImport, type ChronoImport, type ChronoParserOptions } from './result.ts'
import { readShotRows, workbookFooterStarts } from './shot-rows.ts'
import { warnStatistics } from './statistics.ts'
import {
  bracketed,
  isoDate,
  parseNumber,
  splitDelimited,
  splitLines,
  withoutTrailingCommas,
} from './text.ts'
import { resolveUnit } from './units.ts'
import {
  collectWorksheetStrings,
  type FoundWorksheet,
  type WorkbookOptions,
} from './worksheet-strings.ts'

/** A ShotView header row: first cell `#`, the velocity unit in brackets in the second. */
export const isShotViewHeader = (cells: string[]) =>
  cells[0] === '#' && bracketed(cells[1] ?? '') !== undefined

/** Index of the `#` header row whose second cell names the velocity unit in brackets, or -1. */
export function shotViewHeaderIndex(lines: string[]): number {
  return lines.findIndex((line) => isShotViewHeader(splitDelimited(line)))
}

/** Lines joined where a quoted cell holds a line break, so a note line is never read as a row. */
function joinQuoted(lines: string[]): string[] {
  const out: string[] = []
  let open: string | undefined
  let quotes = 0
  for (const line of lines) {
    open = open === undefined ? line : `${open}\n${line}`
    quotes += line.split('"').length - 1
    if (quotes % 2 === 0) {
      out.push(open)
      open = undefined
      quotes = 0
    }
  }
  if (open !== undefined) out.push(open)
  return out
}

const months: Record<string, number> = {}
for (const names of [
  'january february march april may june july august september october november december',
  'januar februar m\u00E4rz april mai juni juli august september oktober november dezember',
]) {
  names.split(' ').forEach((name, i) => {
    months[name] = i + 1
  })
}

/** Footer dates such as `April 6, 2026 at 1:36 PM` or `8. Februar 2026 um 10:08`; English and German month names only. */
function footerDate(text: string): string | undefined {
  const words =
    text
      .replace(/\d{1,2}:\d{2}(:\d{2})?/g, ' ')
      .toLowerCase()
      .match(/\p{L}+|\d+/gu) ?? []
  const month = words.map((w) => months[w]).find((m) => m !== undefined)
  const year = words.find((w) => /^\d{4}$/.test(w))
  const day = words.find((w) => /^\d{1,2}$/.test(w))
  return month && year && day ? isoDate(Number(year), month, Number(day)) : undefined
}

const footerLabels: [string[], string[], string[]] = [
  ['AVERAGE SPEED'],
  ['STD DEV', 'STANDARDABWEICHUNG'],
  ['SPREAD', 'STREUUNG'],
]

/**
 * Parses a ShotView CSV text into one session with one string; velocity unit from the header brackets.
 */
export function parseShotView(text: string, options: ChronoParserOptions = {}): ChronoImport {
  const lines = splitLines(text)
  const h = shotViewHeaderIndex(lines)
  const headerLine = lines[h]
  if (headerLine === undefined) {
    throw new Error('not a ShotView CSV: no "#" header row with a velocity unit')
  }
  const warnings: string[] = []
  const unitText = bracketed(splitDelimited(headerLine)[1] ?? '')
  const unit = resolveUnit(unitText, options, warnings)

  const nameLine = lines.slice(0, h).find((l) => l.trim()) ?? ''
  const name = nameLine.trim().startsWith('"')
    ? splitDelimited(nameLine)[0]
    : withoutTrailingCommas(nameLine).trim()

  // only rows after the header can hold quoted line breaks; blank lines become empty rows
  const rows = joinQuoted(lines.slice(h + 1)).map((l) => (l.trim() ? splitDelimited(l) : []))
  // the first `-` row ends the shots
  const { shots, values, flags, footer } = readShotRows(rows, unitText, unit, (c) => c[0] === '-')

  const date = dateFromFooter(footer, warnings)
  checkFooter(footer, values, warnings)

  return buildChronoImport(
    'shotview-csv',
    {
      ...(date ? { date } : {}),
      device: { kind: 'doppler-radar', manufacturerName: 'Garmin' },
      strings: shots.length > 0 ? [{ shots }] : [],
      ...(flags.length > 0 ? { note: `ShotView bore flags: ${flags.join('; ')}` } : {}),
    },
    [name || undefined],
    warnings,
    options,
  )
}

/** The date row follows the last `-` row; its label depends on the phone's language. */
function dateFromFooter(footer: string[][], warnings: string[]): string | undefined {
  const dash = footer.findLastIndex((cells) => cells[0] === '-')
  const text = dash < 0 ? undefined : footer[dash + 1]?.[1]
  if (!text) return undefined
  const date = footerDate(text)
  if (!date) warnings.push(`footer date "${text}" is not recognised; enter the date`)
  return date
}

/** Footer statistics against the shots, as warnings; `prefix` names the worksheet. */
function checkFooter(footer: string[][], values: number[], warnings: string[], prefix = ''): void {
  const notFound = `${prefix}footer statistics`
  warnStatistics(footer, values, footerLabels, parseNumber, warnings, `${prefix}footer `, notFound)
}

const dateLabels = ['DATE', 'DATUM']

/**
 * Garmin Xero ShotView XLSX export: one session, one string per worksheet with a ShotView header
 * row. The date row is found by its label, the first cell above the header.
 */
export function parseShotViewWorkbook(book: Workbook, options: WorkbookOptions = {}): ChronoImport {
  const warnings: string[] = []
  const found: FoundWorksheet[] = []
  book.worksheets.forEach((sheet, k) => {
    const n = k + 1
    const h = sheet.rows.findIndex(isShotViewHeader)
    const headerCells = sheet.rows[h]
    if (headerCells === undefined) {
      warnings.push(`worksheet ${n}: no ShotView header row; skipped`)
      return
    }
    const after = sheet.rows.slice(h + 1)
    const dateRow = after.find((cells) => dateLabels.includes((cells[0] ?? '').toUpperCase()))
    const date = footerDate(dateRow?.[1] ?? '')
    const dateWarning = !dateRow
      ? `worksheet ${n}: footer date row not found; enter the date`
      : `worksheet ${n}: footer date "${dateRow[1] ?? ''}" is not recognised; enter the date`
    found.push({
      position: n,
      ...(date ? { date } : { dateWarning }),
      read: (warnings) => {
        const unitText = bracketed(headerCells[1] ?? '')
        const unit = resolveUnit(unitText, options, warnings)
        const r = readShotRows(after, unitText, unit, workbookFooterStarts)
        if (r.shots.length === 0) return
        checkFooter(r.footer, r.values, warnings, `worksheet ${n}: `)
        const label = sheet.rows.slice(0, h).flat().find(Boolean) || sheet.name
        return { shots: r.shots, flags: r.flags, label }
      },
    })
  })
  const s = collectWorksheetStrings(found, options, warnings)
  return buildChronoImport(
    'shotview-xlsx',
    {
      ...(s.date ? { date: s.date } : {}),
      device: { kind: 'doppler-radar', manufacturerName: 'Garmin' },
      strings: s.strings,
      ...(s.flags.length > 0 ? { note: `ShotView bore flags: ${s.flags.join('; ')}` } : {}),
    },
    s.labels,
    warnings,
    options,
  )
}
