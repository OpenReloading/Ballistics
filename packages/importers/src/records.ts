// Kind scoring, column mapping and the record candidates a mapped table becomes, with a report per row.
import type { UserRecord } from '@rangefoundry/schema'
import type { Diagnostic } from '@rangefoundry/statistics'
import type { Candidate, ReaderDiagnostic } from './diagnostics.ts'
import {
  type ColumnUnit,
  type FieldSpec,
  fieldSpecs,
  type TableKind,
  tableKinds,
} from './record-fields.ts'
import { idOfKey } from './record-ids.ts'
import { guessDecimal, headerUnit, headerWords, readNumber, type Table } from './tables.ts'

/** How sure a kind suggestion is. */
export type Tier = 'high' | 'medium' | 'low'

/** Lowest kind score that suggests a kind, and the scores from which the tier is medium and high. */
export const tierFloors = { low: 0.4, medium: 0.6, high: 0.8 } as const

function tierOf(score: number): Tier | undefined {
  if (score >= tierFloors.high) return 'high'
  if (score >= tierFloors.medium) return 'medium'
  return score >= tierFloors.low ? 'low' : undefined
}

/** How a column of a table is read: the field it fills, the unit and decimal mark of its numbers. */
export interface TableColumnMap {
  field?: string | undefined
  /** Symbol of one of the field's units. */
  unit?: string | undefined
  decimal: '.' | ','
  /** Where the unit came from: the header, the values or the stored unit as the default; `unknown` when the header names a unit the field does not take. */
  unitFrom?: 'header' | 'values' | 'default' | 'unknown' | undefined
  /** The cells could also read as grouped integers: the decimal mark is a guess. */
  ambiguousDecimal?: boolean | undefined
}

/** The score of one kind for a table, 0 to 1. */
export interface KindScore {
  kind: TableKind
  score: number
}

/** No kind reaches `floor`, the lowest score that suggests one: the scores of every kind, best first. The app words it. */
export type KindDiagnostic = Diagnostic<
  'noKind',
  { readonly scores: readonly KindScore[]; readonly floor: number }
>

/** The kind scores of a table, best first, and the suggested kind with its tier, or the refusal when none reaches the floor. */
export interface KindSuggestion {
  scores: KindScore[]
  kind?: TableKind | undefined
  tier?: Tier | undefined
  refusal?: KindDiagnostic | undefined
}

const sampleOf = (table: Table, column: number) =>
  table.rows
    .slice(0, 200)
    .map((r) => r[column] ?? '')
    .filter((c) => c !== '')

/** A unit symbol folded for comparison: lower case, letters and digits only, ² and ³ as digits. */
const plain = (s: string) =>
  s
    .toLowerCase()
    .replaceAll('²', '2')
    .replaceAll('³', '3')
    .replace(/[^a-z0-9]/g, '')

/** The unit the header names, `unknown` for a unit in brackets or after a slash or underscore the field does not take. */
const unitFromHeader = (
  header: string,
  units: ColumnUnit[],
): ColumnUnit | 'unknown' | undefined => {
  const raw = headerUnit(header)
  if (!raw) return undefined
  const key = raw.replace(/inch(es)?|"/g, 'in').replace(/grains?/g, 'gr')
  const named = units.find((u) => plain(u.symbol) === plain(key))
  // a last word after a space may be a word of the name (Case length, Max OAL), not a unit
  return named ?? (header.toLowerCase().endsWith(` ${raw}`) ? undefined : 'unknown')
}

/** Share of `cells` read as numbers in `unit` that fall in `range` of the stored unit. */
const inRange = (
  cells: string[],
  decimal: '.' | ',',
  unit: ColumnUnit,
  range: [number, number],
) => {
  let n = 0
  for (const c of cells) {
    const x = readNumber(c, decimal)
    if (x === undefined) continue
    const v = unit.toStored(x)
    if (v >= range[0] && v <= range[1]) n++
  }
  return cells.length === 0 ? 0 : n / cells.length
}

/** The first non-empty cells of a column and their decimal mark. */
interface Sample {
  cells: string[]
  decimal: '.' | ','
}

/** The unit of a numeric column: from its header, else the one that fits the usual range best, else the stored unit. */
function unitOf(
  field: FieldSpec,
  first: ColumnUnit,
  header: string,
  sample: Sample,
): { unit?: ColumnUnit; from: 'header' | 'values' | 'default' | 'unknown' } {
  const all = field.units ?? [first]
  const named = unitFromHeader(header, all)
  if (named === 'unknown') return { from: 'unknown' }
  if (named) return { unit: named, from: 'header' }
  const units = all.filter((u) => !u.named)
  if (units.length === 1 || !field.range) return { unit: first, from: 'default' }
  const spans = { range: field.range, typical: field.typical ?? field.range }
  const best = bestFit(units, first, sample, spans)
  return { unit: best.unit, from: best.fit > 0 ? 'values' : 'default' }
}

/** The unit whose reading puts most sample values in `range`, ties broken by `typical`; `first` with no fit when the sample has no number. */
function bestFit(
  units: ColumnUnit[],
  first: ColumnUnit,
  { cells, decimal }: Sample,
  { range, typical }: { range: [number, number]; typical: [number, number] },
): { unit: ColumnUnit; fit: number } {
  let best = { unit: first, fit: -1, usual: -1 }
  for (const unit of units) {
    const fit = inRange(cells, decimal, unit, range)
    const usual = inRange(cells, decimal, unit, typical)
    if (fit > best.fit || (fit === best.fit && usual > best.usual)) best = { unit, fit, usual }
  }
  return best
}

/** How much the words of a header say it names a field: 1 for the whole header, 0.8 for a word, 0.5 for a part. */
function headerScore(field: FieldSpec, header: string): number {
  const words = headerWords(header)
  const joined = words.join('')
  if (field.aliases.includes(joined)) return 1
  if (words.some((w) => field.aliases.includes(w))) return 0.8
  return field.aliases.some((a) => a.length >= 4 && joined.includes(a)) ? 0.5 : 0
}

/** How well the cells fit a field, 0 to 1: spelled choices, numbers in the usual and the possible range, else text. */
function valueScore(field: FieldSpec, cells: string[]): number {
  if (cells.length === 0) return 0
  const { decimal } = guessDecimal(cells)
  const { choices, units, range } = field
  if (choices)
    return cells.filter((c) => Object.hasOwn(choices, c.trim().toLowerCase())).length / cells.length
  if (units && range) {
    const typical = field.typical ?? range
    return Math.max(
      ...units
        .filter((u) => !u.named)
        .map(
          (u) =>
            inRange(cells, decimal, u, typical) * 0.5 + inRange(cells, decimal, u, range) * 0.5,
        ),
    )
  }
  return cells.filter((c) => readNumber(c, decimal) === undefined).length / cells.length
}

/** How well a column fills a field, 0 to 1: the header's words weigh most, the values confirm. */
function columnScore(field: FieldSpec, header: string, cells: string[]): number {
  const h = headerScore(field, header)
  const v = valueScore(field, cells)
  if (h > 0) return 0.65 * h + 0.35 * v
  if (field.choices) return 0.5 * v
  return field.units ? 0.2 * v : 0
}

/** Best one-to-one assignment (greedy by score) of columns to the fields of `kind`; scores of the fields that got one. */
function assign(table: Table, kind: TableKind) {
  const cells = table.header.map((_, i) => sampleOf(table, i))
  const pairs: { column: number; field: FieldSpec; score: number }[] = []
  for (const field of fieldSpecs[kind]) {
    table.header.forEach((h, column) => {
      const score = columnScore(field, h, cells[column] ?? [])
      if (score >= 0.3) pairs.push({ column, field, score })
    })
  }
  pairs.sort((a, b) => b.score - a.score)
  const column = new Map<number, { field: FieldSpec; score: number }>()
  const used = new Set<string>()
  for (const p of pairs) {
    if (column.has(p.column) || used.has(p.field.key)) continue
    column.set(p.column, { field: p.field, score: p.score })
    used.add(p.field.key)
  }
  return { column, cells }
}

/** The score of every kind for `table`, best first. */
function scoreKinds(table: Table): KindScore[] {
  return tableKinds
    .map((kind) => {
      const { column } = assign(table, kind)
      const score = Math.min(
        1,
        [...column.values()].reduce((s, c) => s + c.field.weight * c.score, 0),
      )
      return { kind, score }
    })
    .toSorted((a, b) => b.score - a.score)
}

/**
 * The kind a table suggests from its header words and value ranges: high from 0.80, medium from
 * 0.60, low from 0.40. Below 0.40 no kind is suggested and the refusal carries the scores and the floor.
 */
export function suggestKind(table: Table): KindSuggestion {
  const scores = scoreKinds(table)
  const best = scores[0]
  const tier = best && tierOf(best.score)
  if (best && tier) return { scores, kind: best.kind, tier }
  return { scores, refusal: { code: 'noKind', params: { scores, floor: tierFloors.low } } }
}

/** The column map the headers and values suggest for `kind`, one entry per column. */
export function autoMap(table: Table, kind: TableKind): TableColumnMap[] {
  const { column, cells } = assign(table, kind)
  return table.header.map((header, i) => {
    const sample = cells[i] ?? []
    const { decimal, ambiguous } = guessDecimal(sample)
    const hit = column.get(i)
    if (!hit) return { decimal }
    const map: TableColumnMap = { field: hit.field.key, decimal, ambiguousDecimal: ambiguous }
    const first = hit.field.units?.[0]
    if (first) {
      const u = unitOf(hit.field, first, header, { cells: sample, decimal })
      map.unit = u.unit?.symbol
      map.unitFrom = u.from
    }
    return map
  })
}

/** Why a row of a table is rejected or warned, as a code and the values its message names. */
export type TableDiagnostic = ReaderDiagnostic<
  | 'emptyCell'
  | 'noUnit'
  | 'unitOther'
  | 'notNumber'
  | 'notAboveZero'
  | 'outsideUsual'
  | 'notChoice'
  | 'noColumn'
  | 'noColumns'
  | 'sameId'
  | 'sameBulletId'
>

/**
 * Where a row was rejected or warned: the 1-based row of the file (the header is row 1), the
 * column's header, the cell and why; `field` params are field keys.
 */
export interface RowIssue {
  row: number
  column: string
  cell: string
  reason: TableDiagnostic
}

/** Counts of the row report: rows accepted (those with a warning among them), rows with a warning and rows rejected. */
export interface RowCounts {
  accepted: number
  warned: number
  rejected: number
}

/** The candidate of an accepted row. */
export interface BuiltEntry {
  row: number
  candidate: Candidate
}

/** The candidates of a table and its row report. */
export interface BuiltRecords {
  /** One entry per accepted row. */
  entries: BuiltEntry[]
  /** The makers the rows name, as manufacturer candidates the entries refer to. */
  makers: Candidate[]
  counts: RowCounts
  rejected: RowIssue[]
  warnings: RowIssue[]
}

const stored = (map: TableColumnMap, field: FieldSpec) =>
  field.units?.find((u) => u.symbol === map.unit) ?? field.units?.[0]

/** The unit the cells of a column are read in, or why the column has none. */
function columnUnit(
  map: TableColumnMap,
  field: FieldSpec,
): ColumnUnit | { problem: TableDiagnostic } {
  if (map.unitFrom === 'unknown' && map.unit === undefined) {
    const symbols = field.units?.map((u) => u.symbol) ?? []
    return { problem: { code: 'unitOther', params: { field: field.key, symbols } } }
  }
  return stored(map, field) ?? { problem: { code: 'noUnit', params: { field: field.key } } }
}

/** The warning for a value in the stored unit outside the field's usual range. */
function rangeWarning(
  field: FieldSpec,
  cell: string,
  unit: ColumnUnit,
  value: number,
): TableDiagnostic | undefined {
  const range = field.range
  if (!range || (value >= range[0] && value <= range[1])) return undefined
  return {
    code: 'outsideUsual',
    params: {
      field: field.key,
      cell,
      unit: unit.symbol,
      low: range[0],
      high: range[1],
      stored: field.units?.[0]?.symbol ?? '',
    },
  }
}

/** A number cell in the stored unit with its raw text when the unit differs and a plausibility warning, or why the row is rejected. */
function numberCell(
  cell: string,
  map: TableColumnMap,
  field: FieldSpec,
): { value: number; raw?: string; warning?: TableDiagnostic } | { problem: TableDiagnostic } {
  const unit = columnUnit(map, field)
  if ('problem' in unit) return unit
  const x = readNumber(cell, map.decimal)
  if (x === undefined)
    return {
      problem: { code: 'notNumber', params: { field: field.key, cell, mark: map.decimal } },
    }
  const value = unit.toStored(x)
  if (!(value > 0)) return { problem: { code: 'notAboveZero', params: { field: field.key, cell } } }
  const warning = rangeWarning(field, cell, unit, value)
  return {
    value,
    ...(unit !== field.units?.[0] && { raw: cell }),
    ...(warning && { warning }),
  }
}

/** The cells of one row by field key: numbers in the stored unit with their raw text, or text. */
type Cells = Record<string, { value: number; raw?: string } | string>

const quantityOf = (c: Cells[string] | undefined) =>
  c !== undefined && typeof c !== 'string'
    ? { value: c.value, ...(c.raw && { raw: c.raw }) }
    : undefined

/** The data of a record of `kind`. */
type DataOf<K extends TableKind> = Extract<UserRecord, { kind: K }>['data']

/** The candidate of one row of `kind`; `makerId` is the id of its maker's candidate. */
function candidateOf(
  kind: TableKind,
  head: { key: string; name: string },
  c: Cells,
  makerId: string | undefined,
): Candidate {
  if (kind === 'bullet') return { kind, ...head, data: bulletData(head.name, c, makerId) }
  if (kind === 'powder') return { kind, ...head, data: powderData(c) }
  return { kind, ...head, data: cartridgeData(head.name, c) }
}

/** The data of a bullet row: its name, maker and the numbers it gives as overrides. */
function bulletData(name: string, c: Cells, makerId: string | undefined): DataOf<'bullet'> {
  const coefficients = (['G1', 'G7'] as const).flatMap((m) => {
    const q = quantityOf(c[`bc${m}`])
    return q ? [{ dragModel: m, value: q.value }] : []
  })
  const diameter = quantityOf(c['diameter'])
  const mass = quantityOf(c['mass'])
  const length = quantityOf(c['length'])
  const caliber = typeof c['caliber'] === 'string' ? c['caliber'] : undefined
  return {
    origin: 'user',
    ...(makerId && { manufacturer: `user:${makerId}` as const }),
    overrides: {
      name,
      ...(caliber && { caliber }),
      ...(diameter && { diameter }),
      ...(mass && { mass }),
      ...(length && { length }),
      ...(coefficients.length > 0 && { ballisticCoefficients: coefficients }),
    },
  }
}

/** The data of a powder row: a measured draft with the grain form, base and bulk density it gives. */
function powderData(c: Cells): DataOf<'powder'> {
  const bulk = quantityOf(c['bulkDensity'])
  return {
    origin: 'user',
    provenanceKind: 'measured',
    draft: {
      ...(typeof c['grainForm'] === 'string' && {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the choices of the field spell only these values
        grainForm: c['grainForm'] as 'ball' | 'extruded' | 'flake' | 'other',
      }),
      ...(typeof c['propellantBase'] === 'string' && {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the choices of the field spell only these values
        propellantBase: c['propellantBase'] as 'single' | 'double' | 'triple',
      }),
      ...(bulk && { bulkDensity: bulk }),
    },
  }
}

/** The data of a cartridge row: its name and the case length, overall length, bullet diameter and Pmax it gives. */
function cartridgeData(name: string, c: Cells): DataOf<'cartridge'> {
  const spec = (
    symbol: string,
    key: string,
    quantity: 'length' | 'pressure',
    side?: 'cartridge',
  ) => {
    const q = quantityOf(c[key])
    return q
      ? [{ ...(side && { side }), symbol, quantity, value: q.value, ...(q.raw && { raw: q.raw }) }]
      : []
  }
  const values = [
    ...spec('L3', 'caseLength', 'length', 'cartridge'),
    ...spec('L6', 'overallLength', 'length', 'cartridge'),
    ...spec('G1', 'bulletDiameter', 'length', 'cartridge'),
    ...spec('Pmax', 'maxPressure', 'pressure'),
  ]
  return { origin: 'user', overrides: { name, ...(values.length > 0 && { values }) } }
}

/** Lower case, accents and extra spaces folded: the form of a name in a key. */
export const keyText = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** The text the id of a row is made from: kind, name, maker and, for a bullet, its diameter and mass. */
function keyOf(kind: TableKind, name: string, maker: string | undefined, c: Cells): string {
  const num = (k: string) => {
    const q = c[k]
    return q !== undefined && typeof q !== 'string' ? Number(q.value.toPrecision(6)) : ''
  }
  const parts = [kind, keyText(name), keyText(maker ?? '')]
  if (kind === 'bullet') parts.push(String(num('diameter')), String(num('mass')))
  return parts.join('|')
}

interface Column {
  f: FieldSpec
  i: number
}

/** The cells of a row read so far, and the warnings of the table. */
interface RowOut {
  c: Cells
  warnings: RowIssue[]
}

/** One cell into `c` as the field says: a choice, a number in the stored unit, or text. Returns the issue that rejects the row. */
function readCell(
  col: Column,
  cell: string,
  at: { row: number; header: string; map: TableColumnMap },
  { c, warnings }: RowOut,
): RowIssue | undefined {
  const { f } = col
  const issue = (reason: TableDiagnostic): RowIssue => ({
    row: at.row,
    column: at.header,
    cell,
    reason,
  })
  if (cell === '')
    return f.required ? issue({ code: 'emptyCell', params: { field: f.key } }) : undefined
  if (f.choices) {
    const key = cell.toLowerCase()
    const v = Object.hasOwn(f.choices, key) ? f.choices[key] : undefined
    if (v === undefined) {
      const choices = [...new Set(Object.values(f.choices))]
      warnings.push(issue({ code: 'notChoice', params: { field: f.key, cell, choices } }))
    } else c[f.key] = v
    return undefined
  }
  if (!f.units) {
    c[f.key] = cell
    return undefined
  }
  const n = numberCell(cell, at.map, f)
  if ('problem' in n) return issue(n.problem)
  c[f.key] = { value: n.value, ...(n.raw && { raw: n.raw }) }
  if (n.warning) warnings.push(issue(n.warning))
  return undefined
}

/** A table read as a kind: its columns by field and the column map. */
interface TableRead {
  table: Table
  columns: Column[]
  map: TableColumnMap[]
}

/** The cells of one row by field, or the issue that rejects it. */
function readRow(
  { table, columns, map }: TableRead,
  cells: string[],
  row: number,
  warnings: RowIssue[],
): Cells | RowIssue {
  const c: Cells = {}
  for (const col of columns) {
    if (col.i < 0) continue
    const bad = readCell(
      col,
      (cells[col.i] ?? '').trim(),
      { row, header: table.header[col.i] ?? col.f.label, map: map[col.i] ?? { decimal: '.' } },
      { c, warnings },
    )
    if (bad) return bad
  }
  return c
}

/** `out` with every row rejected because no column is mapped to the `missing` required fields. */
function rejectAll(out: BuiltRecords, missing: Column[], rows: number): BuiltRecords {
  out.rejected.push({
    row: 1,
    column: missing.map((c) => c.f.label).join(', '),
    cell: '',
    reason: {
      code: missing.length > 1 ? 'noColumns' : 'noColumn',
      params: { fields: missing.map((c) => c.f.key) },
    },
  })
  out.counts.rejected = rows
  return out
}

/** The id of a maker's candidate by its name, adding the candidate to `makers` the first time. */
function makerCandidates(makers: BuiltRecords['makers']): (maker: string) => string {
  const ids = new Map<string, string>()
  return (maker) => {
    const key = `manufacturer|${keyText(maker)}`
    const known = ids.get(key)
    if (known) return known
    const id = idOfKey(key)
    ids.set(key, id)
    makers.push({ kind: 'manufacturer', key, name: maker, data: { origin: 'user' } })
    return id
  }
}

/** Why the row `row` is not imported: it gives the same id as the earlier row `first`. */
const sameIdReason = (kind: TableKind, first: number, row: number): TableDiagnostic => ({
  code: kind === 'bullet' ? 'sameBulletId' : 'sameId',
  params: { first, row },
})

const isIssue = (x: Cells | RowIssue): x is RowIssue => typeof x.row === 'number' && 'reason' in x

/**
 * The record candidates of `table` read with `map` as `kind`. A row that fails is listed with row,
 * column, cell and reason and never blocks the others. Keys are deterministic (kind, name, maker
 * and, for a bullet, diameter and mass), so the same row read again gets the same id
 * (`idOfKey(key)`). A row whose key repeats an earlier row's gets a warning naming both rows; the
 * caller keeps the first record of an id. The caller makes each candidate a record and parses it
 * with the user record schema before storing it.
 */
export function buildRecords(table: Table, kind: TableKind, map: TableColumnMap[]): BuiltRecords {
  const columns = fieldSpecs[kind].map((f) => ({ f, i: map.findIndex((m) => m.field === f.key) }))
  const out: BuiltRecords = {
    entries: [],
    makers: [],
    counts: { accepted: 0, warned: 0, rejected: 0 },
    rejected: [],
    warnings: [],
  }
  const missing = columns.filter((c) => c.f.required && c.i < 0)
  if (missing.length > 0) return rejectAll(out, missing, table.rows.length)
  const makerOf = makerCandidates(out.makers)
  const warned = new Set<number>()
  const firstRow = new Map<string, number>()
  const nameColumn = columns.find((col) => col.f.key === 'name')
  const nameHeader = nameColumn ? (table.header[nameColumn.i] ?? nameColumn.f.label) : 'Name'
  table.rows.forEach((cells, r) => {
    const row = r + (table.hasHeader ? 2 : 1)
    const before = out.warnings.length
    const c = readRow({ table, columns, map }, cells, row, out.warnings)
    if (isIssue(c)) {
      // warnings of a rejected row are dropped with it
      out.warnings.length = before
      out.rejected.push(c)
      return
    }
    const nameCell = c['name']
    const name = typeof nameCell === 'string' ? nameCell : ''
    const maker = typeof c['maker'] === 'string' ? c['maker'] : undefined
    const key = keyOf(kind, name, maker, c)
    const first = firstRow.get(key)
    if (first === undefined) firstRow.set(key, row)
    else {
      const reason = sameIdReason(kind, first, row)
      out.warnings.push({ row, column: nameHeader, cell: name, reason })
    }
    if (out.warnings.length > before) warned.add(row)
    const candidate = candidateOf(kind, { key, name }, c, maker && makerOf(maker))
    out.entries.push({ row, candidate })
  })
  out.counts = { accepted: out.entries.length, warned: warned.size, rejected: out.rejected.length }
  return out
}
