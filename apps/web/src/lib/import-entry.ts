/** The Import entry's work on tables: reading a file, building its records, planning and writing them. Runs in a worker. */
import {
  autoMap,
  type BuiltRecords,
  buildRecords,
  decodeText,
  fieldSpecs,
  isWorkbook,
  type KindScore,
  type RowCounts,
  type RowIssue,
  readTable,
  readWorkbook,
  suggestKind,
  type Table,
  type TableColumnMap,
  type TableKind,
  type Tier,
  tableKinds,
  tableOfRows,
} from '@open-reloading/importers'
import { type UserRecord, userRecord } from '@open-reloading/schema'
import { storageName } from './edition.ts'
import { type LoadFileFormat, loadFileFormats, loadFormatOf } from './load-file-formats.ts'
import { maxFileBytes, planImport } from './user-data.ts'

/**
 * What a card shows of a read file: the refusal (with the load-file format that refused it), the
 * load file's format, record count and what it did not read, or the table's header, samples and
 * kind suggestion.
 */
export type CardView =
  | { refusal: string; format?: string | undefined }
  | { format: string; records: number; warnings: string[]; unmapped: string[] }
  | {
      header: string[]
      /** Up to three non-empty cells per column. */
      samples: string[][]
      rows: number
      scores: KindScore[]
      kind?: TableKind | undefined
      tier?: Tier | undefined
      /** The sheet of a workbook the table was read from. */
      sheet?: string | undefined
    }

/** The counts and first rejected rows of a built table, planned against the browser store. */
export interface BuildView {
  /** The column map used: the request's, or the automatic one for the kind. */
  map: TableColumnMap[]
  counts: RowCounts
  /** The first rejected rows, at most `shownIssues`. */
  rejected: RowIssue[]
  firstWarning?: RowIssue | undefined
  /** Rows of the file new to the browser, already there with the same content, there with other content, repeated in the file. */
  added: number
  equal: number
  changed: number
  repeated: number
}

/** The source of an import as each written record carries it. */
interface Imported {
  source: string
  file: string
  day: string
}

export type ImportRequest =
  | { type: 'read'; id: number; bytes: ArrayBuffer }
  | { type: 'build'; id: number; kind: TableKind; map?: TableColumnMap[] | undefined }
  | { type: 'commit'; id: number; imported: Imported; replace: boolean }
  | { type: 'drop'; id: number }

export type ImportReply =
  | { type: 'read'; id: number; card: CardView }
  | { type: 'built'; id: number; build: BuildView }
  /** `written` counts the rows written, makers left out; `build` is the plan after the write. */
  | { type: 'committed'; id: number; written: number; build: BuildView }
  | { type: 'failed'; id: number; message: string }

/** How many rejected rows a card lists. */
const shownIssues = 8

/** The browser store as the worker reads and writes it; tests pass their own. */
interface ImportStore {
  records: () => Promise<UserRecord[]>
  put: (records: UserRecord[]) => Promise<unknown>
}

/** The plan of a build against the stored records. */
interface Plan {
  added: UserRecord[]
  /** Rows (no makers) whose id is stored with other content. */
  changed: UserRecord[]
  equal: number
  repeated: number
}

interface Held {
  table?: { header: string[]; hasHeader: boolean; rows: string[][] }
  kind?: TableKind
  map?: TableColumnMap[]
  built?: BuiltRecords
  plan?: Plan
}

/** A file's table and the sheet it is on, a load file's card, or its refusal. */
type FileRead =
  | { refusal: string; format?: string | undefined }
  | { load: Extract<CardView, { records: number }> }
  | { table: Table; sheet?: string | undefined }

/** The first table of a workbook's sheets, or the refusal of the first sheet. */
async function workbookTable(bytes: Uint8Array): Promise<FileRead> {
  let worksheets: Awaited<ReturnType<typeof readWorkbook>>['worksheets']
  try {
    worksheets = (await readWorkbook(bytes)).worksheets
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    return { refusal: `The workbook cannot be read: ${reason}. Save it again as XLSX or CSV.` }
  }
  let first: string | undefined
  for (const sheet of worksheets) {
    const read = tableOfRows(sheet.rows)
    if ('table' in read) return { ...read, sheet: sheet.name }
    first ??= `Sheet "${sheet.name}" has no table of two columns or more. Move the table to the first sheet.`
  }
  return {
    refusal:
      first ??
      'The workbook has no cells with text. Open the right file or paste the table into a sheet.',
  }
}

/** `decodeText`'s two reasons as refusals that end with the action. */
const textRefusals: Record<string, string> = {
  'UTF-16 text with an odd number of bytes':
    'UTF-16 text with an odd number of bytes; save it as UTF-8 (CSV UTF-8) and import again.',
}
const notText =
  'The file is not UTF-8 or UTF-16 text; save it as UTF-8 (CSV UTF-8) and import again.'

/**
 * One inspection of a file's bytes, its extension not read: the size, the load-file formats in
 * their order, a workbook by its signature, then the text as a JSON list or a delimited table.
 */
function readFile(bytes: Uint8Array, formats: LoadFileFormat[]): FileRead | Promise<FileRead> {
  if (bytes.byteLength > maxFileBytes)
    return { refusal: 'The file is larger than 40 MB. Split it and import the parts.' }
  const format = loadFormatOf(bytes, formats)
  if (format) {
    const p = format.parse(bytes)
    if (!p.ok) return { refusal: p.reason, format: format.name }
    const { records, warnings = [], unmapped = [] } = p
    return { load: { format: format.name, records: records.length, warnings, unmapped } }
  }
  if (isWorkbook(bytes)) return workbookTable(bytes)
  let text: string
  try {
    text = decodeText(bytes)
  } catch (e) {
    return { refusal: textRefusals[e instanceof Error ? e.message : ''] ?? notText }
  }
  return readTable(text.replace(/^\uFEFF/, ''))
}

const samplesOf = (t: { header: string[]; rows: string[][] }) =>
  t.header.map((_, i) =>
    t.rows
      .slice(0, 200)
      .map((r) => r[i] ?? '')
      .filter((c) => c !== '')
      .slice(0, 3),
  )

/**
 * `built` against `stored`: rows with one id in the file collapse (same content) or keep the first
 * (other content); makers count only as written, never as changed.
 */
function planOf(built: BuiltRecords, stored: UserRecord[]): Plan {
  const first = new Map<string, UserRecord>()
  let repeated = 0
  for (const { record } of built.entries) {
    const seen = first.get(record.id)
    if (!seen) first.set(record.id, record)
    else repeated++
  }
  const makers = planImport(
    built.makers.map((m) => m.record),
    stored,
  )
  const rows = planImport([...first.values()], stored)
  return {
    added: [...makers.added, ...rows.added],
    changed: rows.conflicts.map((c) => c.incoming),
    equal: rows.equal.length,
    repeated,
  }
}

/** Each record parsed with the user record schema; a record it refuses turns its row into a rejected one. */
function checked(built: BuiltRecords): BuiltRecords {
  const entries: BuiltRecords['entries'] = []
  const rejected = [...built.rejected]
  for (const e of built.entries) {
    const parsed = userRecord.safeParse(e.record)
    if (parsed.success) entries.push(e)
    else {
      const issue = parsed.error.issues[0]
      rejected.push({
        row: e.row,
        column: issue?.path.join('.') ?? '',
        cell: '',
        reason: `${issue?.message ?? 'Invalid record'}. Fix the row or delete it.`,
      })
    }
  }
  rejected.sort((a, b) => a.row - b.row)
  const warnedRows = new Set(entries.map((e) => e.row))
  const warnings = built.warnings.filter((w) => warnedRows.has(w.row))
  return {
    ...built,
    entries,
    rejected,
    warnings,
    counts: {
      accepted: entries.length,
      warned: new Set(warnings.map((w) => w.row)).size,
      rejected: rejected.length,
    },
  }
}

const viewOf = (held: Held): BuildView => {
  const { built, plan, map } = held
  if (!built || !plan || !map) throw new Error('the file is not built')
  return {
    map,
    counts: built.counts,
    rejected: built.rejected.slice(0, shownIssues),
    firstWarning: built.warnings[0],
    added: plan.added.filter((r) => r.kind !== 'manufacturer').length,
    equal: plan.equal,
    changed: plan.changed.length,
    repeated: plan.repeated,
  }
}

/** The records a commit writes: the new rows and makers, and the changed rows when `replace`. */
const toWrite = (plan: Plan, replace: boolean) => [...plan.added, ...(replace ? plan.changed : [])]

/** The card of a read file: its refusal, its load-file card, or its table with the suggested kind. */
function cardOf(read: FileRead): CardView {
  if ('refusal' in read) return read
  if ('load' in read) return read.load
  const { table } = read
  const s = suggestKind(table)
  return {
    header: table.header,
    samples: samplesOf(table),
    rows: table.rows.length,
    scores: s.scores,
    kind: s.kind,
    tier: s.tier,
    ...(read.sheet !== undefined && { sheet: read.sheet }),
  }
}

/**
 * The worker's handler: reads, builds and writes the files of one Import entry by id, keeping
 * tables and records here so the page receives summaries only.
 */
export function importWorker(
  store: ImportStore,
  post: (r: ImportReply) => void,
  formats = loadFileFormats,
) {
  const files = new Map<number, Held>()
  const held = (id: number) => {
    const h = files.get(id)
    if (!h?.table) throw new Error('the file is not read')
    return h as Held & { table: NonNullable<Held['table']> }
  }

  async function build(id: number, kind: TableKind, map: TableColumnMap[] | undefined) {
    const h = held(id)
    h.kind = kind
    h.map = map ?? autoMap(h.table, kind)
    h.built = checked(buildRecords(h.table, kind, h.map, new Date().toISOString()))
    h.plan = planOf(h.built, await store.records())
    return viewOf(h)
  }

  async function answer(m: ImportRequest): Promise<ImportReply | undefined> {
    if (m.type === 'drop') {
      files.delete(m.id)
      return
    }
    if (m.type === 'read') {
      const read = await readFile(new Uint8Array(m.bytes), formats)
      files.set(m.id, 'table' in read ? { table: read.table } : {})
      return { type: 'read', id: m.id, card: cardOf(read) }
    }
    if (m.type === 'build')
      return { type: 'built', id: m.id, build: await build(m.id, m.kind, m.map) }
    const h = held(m.id)
    if (!h.built || !h.kind) throw new Error('the file is not built')
    // planned again: another file of this import or another tab may have stored a row since the build
    h.plan = planOf(h.built, await store.records())
    const write = toWrite(h.plan, m.replace).map((r) => ({ ...r, imported: m.imported }))
    await store.put(write)
    const written = write.filter((r) => r.kind !== 'manufacturer').length
    return { type: 'committed', id: m.id, written, build: await build(m.id, h.kind, h.map) }
  }

  return async (m: ImportRequest) => {
    try {
      const r = await answer(m)
      if (r) post(r)
    } catch (e) {
      post({ type: 'failed', id: m.id, message: e instanceof Error ? e.message : String(e) })
    }
  }
}

/** A column map saved by name, for the next file with the same header. */
interface SavedMapping {
  kind: TableKind
  header: string[]
  map: TableColumnMap[]
}

export type SavedMappings = Record<string, SavedMapping>

const mappingsKey = storageName('import-mappings')

const isObject = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object'
const unitSources: unknown[] = [undefined, 'header', 'values', 'default', 'unknown']

/** Whether `m` is a column of a map `build` reads as `kind`: a field of the kind with one of its units, or none. */
function isColumnMap(m: unknown, kind: TableKind) {
  if (!isObject(m) || (m.decimal !== '.' && m.decimal !== ',')) return false
  if (!unitSources.includes(m.unitFrom)) return false
  if (m.ambiguousDecimal !== undefined && typeof m.ambiguousDecimal !== 'boolean') return false
  if (m.field === undefined) return m.unit === undefined || typeof m.unit === 'string'
  const field = fieldSpecs[kind].find((f) => f.key === m.field)
  return !!field && (m.unit === undefined || !!field.units?.some((u) => u.symbol === m.unit))
}

/** Whether `m` has the shape of a saved mapping: one of an older build or damaged storage has not. */
function isSavedMapping(m: unknown): m is SavedMapping {
  if (!isObject(m) || !tableKinds.includes(m.kind as TableKind)) return false
  const kind = m.kind as TableKind
  return (
    Array.isArray(m.header) &&
    m.header.every((h) => typeof h === 'string') &&
    Array.isArray(m.map) &&
    m.map.every((c) => isColumnMap(c, kind))
  )
}

/** The mappings saved in this browser that have the current shape; none where the storage is not available. */
export function readMappings(): SavedMappings {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(mappingsKey) ?? '{}')
    if (!isObject(saved)) return {}
    return Object.fromEntries(
      Object.entries(saved).filter((e): e is [string, SavedMapping] => isSavedMapping(e[1])),
    )
  } catch {
    return {}
  }
}

/** `saved` with `mapping` under `name`, kept in the browser where it can be. */
export function saveMapping(saved: SavedMappings, name: string, mapping: SavedMapping) {
  const next = { ...saved, [name]: mapping }
  try {
    localStorage.setItem(mappingsKey, JSON.stringify(next))
  } catch {}
  return next
}

/** The names of the saved mappings made for `header`: the same cells in the same order. */
export const mappingsFor = (saved: SavedMappings, header: readonly string[]) =>
  Object.entries(saved)
    .filter(
      ([, m]) => m.header.length === header.length && m.header.every((h, i) => h === header[i]),
    )
    .map(([name]) => name)

/**
 * The first build of a read table: the last saved mapping made for its header, else the suggested
 * kind with the automatic map; none for a refused file, a load file or a table no kind reaches.
 */
export function firstBuild(card: CardView, saved: SavedMappings) {
  if (!('header' in card)) return
  const name = mappingsFor(saved, card.header).at(-1)
  const mapping = name === undefined ? undefined : saved[name]
  if (mapping) return { kind: mapping.kind, map: mapping.map, mapping: name }
  return card.kind && { kind: card.kind, map: undefined, mapping: undefined }
}

/** One file of the Import entry as the commit counts it. */
interface CountedFile {
  build?: BuildView | undefined
  /** The source of this file; empty takes the shared one. */
  source: string
}

/**
 * The rows an Import writes over `files`, and whether one of the files that writes rows has no
 * source: then the Import button stays disabled.
 */
export function importCount(files: readonly CountedFile[], shared: string, replace: boolean) {
  let total = 0
  let missingSource = false
  for (const f of files) {
    const n = f.build ? f.build.added + (replace ? f.build.changed : 0) : 0
    total += n
    if (n > 0 && (f.source.trim() || shared.trim()) === '') missingSource = true
  }
  return { total, missingSource }
}
