/** One inspection per file, from its bytes: a load file of a known format, a table (CSV, workbook, JSON list) with a suggested kind, or a refusal with the reason. */
import { decodeText, isWorkbook, readWorkbook } from '@open-reloading/importers'
import { fromSi, type UserRecord, userDataFormat } from '@open-reloading/schema'
import { unitsOf } from '../units.ts'
import { maxFileBytes, parseUserDataFile } from '../user-data.ts'
import { kindNames, type TableKind } from './fields.ts'
import { idOfKey } from './ids.ts'
import {
  autoMap,
  type ColumnMap,
  type KindScore,
  scoreKinds,
  type Tier,
  tierFloors,
  tierOf,
} from './map.ts'
import { detectDelimiter, splitRows, type Table, tableOf, tableOfObjects } from './table.ts'

/** A load-file format of the entry: told from the bytes, read into user records. */
export interface InspectFormat {
  name: string
  detect: (text: string) => boolean
  parse: (
    text: string,
    now: string,
  ) => { records: UserRecord[]; notes: string[] } | { reason: string }
}

const demoHeader = 'DEMO-LOAD 1'

/** An invented text format for the prototype: a header line, then `key: value` lines. It reads a bullet and a powder. */
const demoLoad: InspectFormat = {
  name: 'Demo load text',
  detect: (text) => text.trimStart().startsWith(demoHeader),
  parse(text, now) {
    const lines = Object.fromEntries(
      text
        .split(/\r?\n/)
        .slice(1)
        .flatMap((l) => {
          const i = l.indexOf(':')
          return i > 0 ? [[l.slice(0, i).trim().toLowerCase(), l.slice(i + 1).trim()] as const] : []
        }),
    )
    const bullet = lines.bullet
    const powder = lines.powder
    if (!bullet && !powder)
      return {
        reason: 'The file names no bullet and no powder. Add a "bullet:" or "powder:" line.',
      }
    const grains = /^([\d.]+)\s*gr$/.exec(lines['bullet mass'] ?? '')?.[1]
    const inches = /^([\d.]+)\s*in$/.exec(lines['bullet diameter'] ?? '')?.[1]
    const records: UserRecord[] = []
    if (bullet) {
      records.push({
        kind: 'bullet',
        id: idOfKey(`bullet|${bullet.toLowerCase()}|`),
        name: bullet,
        saved: now,
        data: {
          origin: 'user',
          overrides: {
            name: bullet,
            ...(grains && {
              mass: {
                value: fromSi('mass', unitsOf.mass.gr.toSi(Number(grains))),
                raw: `${grains} gr`,
              },
            }),
            ...(inches && {
              diameter: {
                value: fromSi('length', unitsOf.length.in.toSi(Number(inches))),
                raw: `${inches} in`,
              },
            }),
          },
        },
      })
    }
    if (powder) {
      records.push({
        kind: 'powder',
        id: idOfKey(`powder|${powder.toLowerCase()}|`),
        name: powder,
        saved: now,
        data: { origin: 'user', draft: {} },
      })
    }
    const read = new Set(['bullet', 'bullet mass', 'bullet diameter', 'powder'])
    const left = Object.keys(lines).filter((k) => !read.has(k))
    return { records, notes: left.length > 0 ? [`Not read: ${left.join(', ')}.`] : [] }
  },
}

/** The OpenReloading user data file, told by its `format` member. */
const openReloading: InspectFormat = {
  name: 'OpenReloading data',
  detect(text) {
    if (!text.trimStart().startsWith('{')) return false
    try {
      return (JSON.parse(text) as { format?: unknown }).format === userDataFormat
    } catch {
      return false
    }
  },
  parse(text) {
    const p = parseUserDataFile(text)
    return p.ok ? { records: p.records, notes: p.warnings ?? [] } : { reason: p.reason }
  },
}

export const inspectFormats: InspectFormat[] = [openReloading, demoLoad]

/** A table file as inspected: the table, the kind scores and the suggestion. */
export interface TableCard {
  type: 'table'
  name: string
  origin: 'csv' | 'workbook' | 'json'
  /** The worksheet read, and the others the workbook has. */
  sheet?: string
  otherSheets?: string[]
  delimiter?: string
  table: Table
  scores: KindScore[]
  /** The suggested kind and how sure; undefined when no kind reaches the floor. */
  kind?: TableKind
  tier?: Tier
  map: ColumnMap[]
  /** Why no kind is suggested, when none reaches the floor. */
  refusal?: string
}

export type Inspection =
  | TableCard
  | { type: 'load'; name: string; format: string; records: UserRecord[]; notes: string[] }
  | { type: 'refused'; name: string; reason: string }

const refused = (name: string, reason: string): Inspection => ({ type: 'refused', name, reason })

function cardOf(
  base: Pick<TableCard, 'name' | 'origin'> &
    Partial<Pick<TableCard, 'sheet' | 'otherSheets' | 'delimiter'>>,
  table: Table,
): Inspection {
  const scores = scoreKinds(table)
  const best = scores[0]
  const tier = best ? tierOf(best.score) : undefined
  const card: TableCard = { type: 'table', ...base, table, scores, map: [] }
  if (best && tier) {
    card.kind = best.kind
    card.tier = tier
    card.map = autoMap(table, best.kind)
  } else {
    card.map = table.header.map(() => ({ decimal: '.' as const }))
    const top = scores.map((x) => `${kindNames[x.kind]} ${x.score.toFixed(2)}`).join(', ')
    card.refusal = `No column matches a bullet, powder or cartridge field (${top}; the floor is ${tierFloors.low.toFixed(2)}). Pick the kind by hand, or export a table with headers such as Name, Diameter, Weight.`
  }
  return card
}

/** A workbook's first sheet with cells as a table card. */
async function inspectWorkbook(name: string, bytes: Uint8Array): Promise<Inspection> {
  let sheets: { name: string; rows: string[][] }[]
  try {
    const book = await readWorkbook(bytes)
    sheets = book.worksheets.filter((s) => s.rows.some((r) => r.some((c) => c !== '')))
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e)
    return refused(name, `The workbook cannot be read: ${why}. Save it again as XLSX or CSV.`)
  }
  const first = sheets[0]
  if (!first)
    return refused(
      name,
      'The workbook has no cells with text. Open the right file or paste the table into a sheet.',
    )
  const table = tableOf(first.rows)
  if (!table)
    return refused(
      name,
      `Sheet "${first.name}" has no table of two columns or more. Move the table to the first sheet.`,
    )
  return cardOf(
    {
      name,
      origin: 'workbook',
      sheet: first.name,
      otherSheets: sheets.slice(1).map((s) => s.name),
    },
    table,
  )
}

/** A JSON text as a list-of-objects table card. */
function inspectJson(name: string, text: string): Inspection {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return refused(
      name,
      'The text looks like JSON but does not parse. Fix the file or export it again.',
    )
  }
  const table = Array.isArray(json) ? tableOfObjects(json) : undefined
  return table
    ? cardOf({ name, origin: 'json' }, table)
    : refused(
        name,
        'The JSON is neither an OpenReloading data file nor a list of objects with the same keys. Export a table instead.',
      )
}

/** A text file as a load file of a known format, a JSON list or delimited text. */
function inspectText(name: string, text: string, now: string): Inspection {
  const format = inspectFormats.find((f) => f.detect(text))
  if (format) {
    const r = format.parse(text, now)
    return 'reason' in r
      ? refused(name, `${format.name}: ${r.reason}`)
      : { type: 'load', name, format: format.name, ...r }
  }
  if (/^\s*[[{]/.test(text)) return inspectJson(name, text)
  const delimiter = detectDelimiter(text)
  if (!delimiter)
    return refused(
      name,
      'The text has no table: no row repeats a comma, semicolon or tab as separator. Export the table as CSV.',
    )
  const table = tableOf(splitRows(text, delimiter))
  if (!table || table.rows.length === 0)
    return refused(name, 'The table has a header but no rows. Add rows or choose another file.')
  return cardOf({ name, origin: 'csv', delimiter }, table)
}

/** The inspection of one file's bytes. */
export function inspectFile(name: string, bytes: Uint8Array, now: string): Promise<Inspection> {
  if (bytes.byteLength > maxFileBytes) {
    return Promise.resolve(
      refused(name, 'The file is larger than 40 MB. Split it and import the parts.'),
    )
  }
  if (isWorkbook(bytes)) return inspectWorkbook(name, bytes)
  try {
    return Promise.resolve(inspectText(name, decodeText(bytes), now))
  } catch (e) {
    const why = e instanceof Error ? e.message : 'the file is not text'
    return Promise.resolve(refused(name, `${why.replace(/^./, (c) => c.toUpperCase())}.`))
  }
}
