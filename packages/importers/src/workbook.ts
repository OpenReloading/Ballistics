// XLSX workbooks (ECMA-376 Part 1 SpreadsheetML, Part 2 Open Packaging Conventions;
// https://ecma-international.org/publications-and-standards/standards/ecma-376/) read into rows
// of cell text: no styles, number formats or formulas are applied.
import { type CellBudget, clean, placeCell, type Workbook, type Worksheet } from './cells.ts'
import {
  maxCellCharacters,
  maxCells,
  maxElements,
  maxTotalSize,
  maxXmlCharacters,
} from './limits.ts'
import { readXls } from './xls.ts'
import { parseXml, scanXml, type XmlBudget, type XmlElement } from './xml.ts'
import { type Inflate, inflateRaw, readEntry, type ZipEntry, zipEntries } from './zip.ts'

// assumed bound, not a cited one, for the relationships and workbook parts read into an element
// tree
const maxTreePartSize = 1024 * 1024

const zipSignature = [0x50, 0x4b, 0x03, 0x04]
const legacySignature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
const startsWith = (bytes: Uint8Array, signature: number[]) =>
  signature.every((b, i) => bytes[i] === b)

/** True for bytes starting with a ZIP local header or the legacy Excel (OLE2) signature. */
export function isWorkbook(bytes: Uint8Array): boolean {
  return startsWith(bytes, zipSignature) || startsWith(bytes, legacySignature)
}

const elements = (e: XmlElement | undefined, name: string) =>
  (e?.children ?? []).filter((c): c is XmlElement => typeof c !== 'string' && c.name === name)

/**
 * True when a text event at `path` belongs to the rich text of the element at depth `d` (a shared
 * string `si` or an inline string `is`): text of its `t` children and of the `t` of its `r` runs;
 * phonetic runs (`rPh`) and other children are left out.
 */
const richTextAt = (path: readonly string[], d: number) =>
  (path.length === d + 2 && path[d + 1] === 't') ||
  (path.length === d + 3 && path[d + 1] === 'r' && path[d + 2] === 't')

/** Part name for a relationship target, relative to the folder of `source` unless absolute. */
function resolveTarget(source: string, target: string): string {
  const segments = target.startsWith('/') ? [] : source.split('/').slice(0, -1)
  for (const s of target.split('/')) {
    if (s === '' || s === '.') continue
    if (s !== '..') segments.push(s)
    else if (segments.pop() === undefined) {
      throw new Error(`relationship target ${target} leaves the package`)
    }
  }
  return segments.join('/')
}

/** Column number of the letters of a cell reference, bijective base 26 (`A` 1, `IV` 256). */
const columnOf = (letters: string) =>
  [...letters].reduce((col, l) => col * 26 + l.charCodeAt(0) - 64, 0)

/**
 * Text of a cell from its type, the text of its first `v` and of its first `is`. `ref` names the
 * cell, built only for a refusal.
 */
function cellText(
  t: string | undefined,
  v: string | undefined,
  is: string | undefined,
  strings: string[],
  ref: () => string,
): string {
  let text: string
  if (t === 'inlineStr') {
    text = is ?? ''
  } else {
    text = v ?? ''
    if (t === 's' && text !== '') {
      const k = /^\d+$/.test(text.trim()) ? Number(text) : Number.NaN
      if (!(k < strings.length)) {
        throw new Error(`cell ${ref()} refers to shared string ${text} of ${strings.length}`)
      }
      // shared strings are cleaned once when the table is read
      return strings[k]
    }
    if (t === 'b' && text.trim() === '0') return ''
  }
  return clean(text)
}

/** Shared strings, read in one pass: each `si` child of the root, trimmed and U+FEFF removed. */
function sharedStrings(text: string, xmlRemaining: XmlBudget): string[] {
  const strings: string[] = []
  let current: string | undefined
  scanXml(
    text,
    {
      open(name, _attributes, path) {
        if (path.length === 1 && name === 'si') current = ''
      },
      text(t, path) {
        if (current !== undefined && path[1] === 'si' && richTextAt(path, 1)) current += t
      },
      close(name, path) {
        if (path.length === 1 && name === 'si' && current !== undefined) {
          strings.push(clean(current))
          current = undefined
        }
      },
    },
    xmlRemaining,
  )
  return strings
}

/**
 * Rows of cell text, read in one pass: the `row` children of the first `sheetData` child of the
 * root and their `c` children. `remaining` counts down the cells (gaps included) and characters every
 * worksheet of the workbook may still produce; a shared string counts at each cell that refers
 * to it. Each cell is placed when its element closes.
 */
function sheetRows(
  text: string,
  strings: string[],
  remaining: CellBudget,
  xmlRemaining: XmlBudget,
): string[][] {
  const rows: string[][] = []
  let sheetData: 'before' | 'open' | 'after' = 'before'
  let cells: string[] | undefined
  let cell: { t?: string; r?: string; v?: string; is?: string; vs: number; iss: number } | undefined
  scanXml(
    text,
    {
      open(name, attributes, path) {
        const depth = path.length
        if (depth === 1 && name === 'sheetData' && sheetData === 'before') sheetData = 'open'
        else if (depth === 2 && name === 'row' && sheetData === 'open') cells = []
        else if (depth === 3 && name === 'c' && cells) {
          cell = { t: attributes.t, r: attributes.r, vs: 0, iss: 0 }
        } else if (depth === 4 && cell) {
          if (name === 'v' && ++cell.vs === 1) cell.v = ''
          else if (name === 'is' && ++cell.iss === 1) cell.is = ''
        }
      },
      text(t, path) {
        if (!cell || path.length < 5) return
        if (path.length === 5 && path[4] === 'v' && cell.vs === 1) cell.v += t
        else if (path[4] === 'is' && cell.iss === 1 && richTextAt(path, 4)) cell.is += t
      },
      close(name, path) {
        const depth = path.length
        if (depth === 1 && name === 'sheetData' && sheetData === 'open') sheetData = 'after'
        else if (depth === 2 && name === 'row' && cells) {
          if (cells.length > 0) rows.push(cells)
          cells = undefined
        } else if (depth === 3 && name === 'c' && cells && cell) {
          const ref = cell.r
          let column = cells.length + 1
          if (ref !== undefined) {
            const m = /^([A-Z]{1,3})[0-9]+$/.exec(ref)
            if (!m) throw new Error(`cell reference "${ref}" is malformed`)
            column = columnOf(m[1])
          }
          const name = () => ref ?? `at column ${column}`
          placeCell(
            cells,
            column,
            cellText(cell.t, cell.v, cell.is, strings, name),
            name,
            remaining,
          )
          cell = undefined
        }
      },
    },
    xmlRemaining,
  )
  return rows
}

/** Reads a part of the archive as UTF-8 text with `read`; `limit` caps its declared size. */
type ReadPart = <T>(name: string, read: (text: string) => T, limit?: number) => Promise<T>

/**
 * A part reader over the entries of the archive; `budget.left` is the declared size the workbook
 * may still read and `xmlRemaining` the XML budget, both shared by all parts.
 */
function partReader(
  bytes: Uint8Array,
  entries: Map<string, ZipEntry>,
  inflate: Inflate,
  budget: { left: number },
  xmlRemaining: XmlBudget,
): ReadPart {
  return async (name, read, limit) => {
    const entry = entries.get(name.toLowerCase())
    if (!entry) throw new Error(`XLSX part ${name} is missing`)
    const data = await readEntry(bytes, entry, inflate, budget, limit)
    try {
      // the Encoding Standard's UTF-8 reading drops a byte order mark and marks bad bytes U+FFFD
      const text = await new Response(data).text()
      if (text.includes('\uFFFD')) throw new Error('not valid UTF-8')
      return read(text)
    } catch (e) {
      // the budget is shared by all parts, so name it, not only the part that used it up
      const over =
        xmlRemaining.elements < 0
          ? `${maxElements} elements`
          : xmlRemaining.characters < 0
            ? `${maxXmlCharacters} characters of text and attribute markup`
            : undefined
      const message = over ? `the XML parts hold more than ${over}` : (e as Error).message
      throw new Error(`XLSX part ${entry.name}: ${message}`)
    }
  }
}

interface Relationship {
  id: string
  type: string
  target: string
}

/**
 * The internal relationships of the part `source` (`''` for the package) with resolved targets,
 * read as an element tree by `tree`; a repeated relationship id is refused.
 */
async function readRelationships(
  tree: (name: string) => Promise<XmlElement>,
  source: string,
): Promise<Relationship[]> {
  const slash = source.lastIndexOf('/')
  const path = `${source.slice(0, slash + 1)}_rels/${source.slice(slash + 1)}.rels`
  const all = elements(await tree(path), 'Relationship').map((r) => r.attributes)
  const ids = new Set<string>()
  for (const r of all) {
    const id = r.Id ?? ''
    if (ids.has(id)) throw new Error(`XLSX part ${path}: relationship ${id} appears twice`)
    ids.add(id)
  }
  return all
    .filter((r) => r.TargetMode !== 'External')
    .map((r) => ({
      id: r.Id ?? '',
      type: r.Type ?? '',
      target: resolveTarget(source, r.Target ?? ''),
    }))
}

/**
 * The worksheets the `sheet` elements of the workbook part `office` list, in that order, each
 * part read at most once; chart and dialog sheets are left out.
 */
async function readWorksheets(
  part: ReadPart,
  office: string,
  sheetList: Record<string, string>[],
  rels: Relationship[],
  strings: string[],
  xmlRemaining: XmlBudget,
): Promise<Worksheet[]> {
  const byId = new Map(rels.map((r) => [r.id, r]))
  const remaining = { cells: maxCells, characters: maxCellCharacters }
  const read = new Set<string>()
  const worksheets: Worksheet[] = []
  for (const sheet of sheetList) {
    const rel = byId.get(sheet.id ?? '')
    if (!rel) throw new Error(`XLSX part ${office}: sheet ${sheet.name} has no relationship`)
    // chart sheets and dialog sheets hold no cells
    if (!rel.type.endsWith('/worksheet')) continue
    if (read.has(rel.target)) {
      throw new Error(`XLSX part ${office}: sheet ${sheet.name} names part ${rel.target} again`)
    }
    read.add(rel.target)
    const rows = await part(rel.target, (text) => sheetRows(text, strings, remaining, xmlRemaining))
    worksheets.push({ name: sheet.name ?? '', rows })
  }
  return worksheets
}

/**
 * Reads an XLSX workbook, or a legacy BIFF8 `.xls` workbook (`readXls`), from its file bytes: the
 * worksheets in workbook order with their names and cell text. Only the relationships, workbook,
 * shared strings and worksheet parts of an XLSX archive are read.
 */
export async function readWorkbook(
  bytes: Uint8Array,
  options: { inflate?: Inflate } = {},
): Promise<Workbook> {
  if (startsWith(bytes, legacySignature)) return readXls(bytes)
  if (!options.inflate && typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream is not available; pass an inflate function')
  }
  const inflate = options.inflate ?? inflateRaw
  const entries = zipEntries(bytes)
  const budget = { left: maxTotalSize }
  const xmlRemaining = { elements: maxElements, characters: maxXmlCharacters }
  const part = partReader(bytes, entries, inflate, budget, xmlRemaining)
  const tree = (name: string) => part(name, (text) => parseXml(text, xmlRemaining), maxTreePartSize)
  const office = (await readRelationships(tree, '')).find((r) => r.type.endsWith('/officeDocument'))
  if (!office) throw new Error('XLSX part _rels/.rels names no workbook')
  // only the sheet attributes are kept, so the workbook tree can be collected
  const sheetList = elements(elements(await tree(office.target), 'sheets')[0], 'sheet').map(
    (s) => s.attributes,
  )
  const rels = await readRelationships(tree, office.target)
  const shared = rels.find((r) => r.type.endsWith('/sharedStrings'))
  const declared = [shared, ...rels.filter((r) => r.type.endsWith('/worksheet'))].reduce(
    (n, r) => n + (r ? (entries.get(r.target.toLowerCase())?.size ?? 0) : 0),
    0,
  )
  if (declared > budget.left) {
    throw new Error(`XLSX parts declare more than ${maxTotalSize} bytes in total`)
  }
  const strings = shared
    ? await part(shared.target, (text) => sharedStrings(text, xmlRemaining))
    : []
  const worksheets = await readWorksheets(
    part,
    office.target,
    sheetList,
    rels,
    strings,
    xmlRemaining,
  )
  return { worksheets }
}
