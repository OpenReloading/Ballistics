// Kind scoring, column mapping and the user records a mapped table becomes, with a report per row.
import type { UserRecord } from '@open-reloading/schema'
import {
  type ColumnUnit,
  type FieldSpec,
  fieldSpecs,
  kindNames,
  type TableKind,
  tableKinds,
} from './record-fields.ts'
import { idOfKey } from './record-ids.ts'
import { guessDecimal, headerUnit, headerWords, readNumber, type Table } from './tables.ts'

/** How sure a kind suggestion is. */
export type Tier = 'high' | 'medium' | 'low'

/** Lowest kind score that suggests a kind, and the scores from which the tier is medium and high. */
export const tierFloors = { low: 0.4, medium: 0.6, high: 0.8 } as const

const tierOf = (score: number): Tier | undefined =>
  score >= tierFloors.high
    ? 'high'
    : score >= tierFloors.medium
      ? 'medium'
      : score >= tierFloors.low
        ? 'low'
        : undefined

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

/** The kind scores of a table, best first, and the suggested kind with its tier, or the refusal when none reaches the floor. */
export interface KindSuggestion {
  scores: KindScore[]
  kind?: TableKind | undefined
  tier?: Tier | undefined
  refusal?: string | undefined
}

const sampleOf = (table: Table, column: number) =>
  table.rows
    .slice(0, 200)
    .map((r) => r[column] ?? '')
    .filter((c) => c !== '')

/** The unit the header names, `unknown` for a unit in brackets or after a slash or underscore the field does not take. */
const unitFromHeader = (
  header: string,
  units: ColumnUnit[],
): ColumnUnit | 'unknown' | undefined => {
  const raw = headerUnit(header)
  if (!raw) return
  const key = raw.replace(/inch(es)?|"/g, 'in').replace(/grains?/g, 'gr')
  const plain = (s: string) =>
    s
      .toLowerCase()
      .replaceAll('²', '2')
      .replaceAll('³', '3')
      .replace(/[^a-z0-9]/g, '')
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

/** The unit of a numeric column: from its header, else the one that fits the usual range best, else the stored unit. */
function unitOf(
  field: FieldSpec,
  first: ColumnUnit,
  header: string,
  cells: string[],
  decimal: '.' | ',',
): { unit?: ColumnUnit; from: 'header' | 'values' | 'default' | 'unknown' } {
  const all = field.units ?? [first]
  const named = unitFromHeader(header, all)
  if (named === 'unknown') return { from: 'unknown' }
  if (named) return { unit: named, from: 'header' }
  const units = all.filter((u) => !u.named)
  if (units.length === 1 || !field.range) return { unit: first, from: 'default' }
  const typical = field.typical ?? field.range
  let best = { unit: first, fit: -1, usual: -1 }
  for (const unit of units) {
    const fit = inRange(cells, decimal, unit, field.range)
    const usual = inRange(cells, decimal, unit, typical)
    if (fit > best.fit || (fit === best.fit && usual > best.usual)) best = { unit, fit, usual }
  }
  return { unit: best.unit, from: best.fit > 0 ? 'values' : 'default' }
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
    return cells.filter((c) => choices[c.trim().toLowerCase()] !== undefined).length / cells.length
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
  return field.choices ? 0.5 * v : field.units ? 0.2 * v : 0
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
    .sort((a, b) => b.score - a.score)
}

/**
 * The kind a table suggests from its header words and value ranges: high from 0.80, medium from
 * 0.60, low from 0.40. Below 0.40 no kind is suggested and the refusal names the scores and the floor.
 */
export function suggestKind(table: Table): KindSuggestion {
  const scores = scoreKinds(table)
  const best = scores[0]
  const tier = best && tierOf(best.score)
  if (best && tier) return { scores, kind: best.kind, tier }
  const all = scores.map((x) => `${kindNames[x.kind]} ${x.score.toFixed(2)}`).join(', ')
  return {
    scores,
    refusal: `No column matches a bullet, powder or cartridge field (${all}; the floor is ${tierFloors.low.toFixed(2)}). Pick the kind by hand, or export a table with headers such as Name, Diameter, Weight.`,
  }
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
      const u = unitOf(hit.field, first, header, sample, decimal)
      map.unit = u.unit?.symbol
      map.unitFrom = u.from
    }
    return map
  })
}

/** Where a row was rejected or warned: the 1-based row of the file (the header is row 1), the column's header, the cell and why. */
export interface RowIssue {
  row: number
  column: string
  cell: string
  reason: string
}

/** Counts of the row report: rows accepted (those with a warning among them), rows with a warning and rows rejected. */
export interface RowCounts {
  accepted: number
  warned: number
  rejected: number
}

/** One record of an accepted row, with the key its id is made from. */
export interface BuiltEntry {
  key: string
  row: number
  record: UserRecord
}

/** The records of a table and its row report. */
export interface BuiltRecords {
  /** One entry per accepted row. */
  entries: BuiltEntry[]
  /** The makers the rows name, as manufacturer records the entries refer to. */
  makers: { key: string; record: UserRecord }[]
  counts: RowCounts
  rejected: RowIssue[]
  warnings: RowIssue[]
}

const stored = (map: TableColumnMap, field: FieldSpec) =>
  field.units?.find((u) => u.symbol === map.unit) ?? field.units?.[0]

/** A number cell in the stored unit with its raw text when the unit differs and a plausibility warning, or why the row is rejected. */
function numberCell(
  cell: string,
  map: TableColumnMap,
  field: FieldSpec,
): { value: number; raw?: string; warning?: string } | { problem: string } {
  if (map.unitFrom === 'unknown' && map.unit === undefined) {
    const symbols = field.units?.map((u) => u.symbol).join(', ')
    return {
      problem: `${field.label}: the header names a unit other than ${symbols}. Choose the unit of the column.`,
    }
  }
  const unit = stored(map, field)
  if (!unit) return { problem: `${field.label} has no unit. Choose a unit for the column.` }
  const x = readNumber(cell, map.decimal)
  if (x === undefined) {
    return {
      problem: `${field.label} "${cell}" is not a number with "${map.decimal}" as decimal mark. Fix the cell or change the decimal mark of the column.`,
    }
  }
  const value = unit.toStored(x)
  if (!(value > 0))
    return { problem: `${field.label} ${cell} is not above 0. Fix the cell or leave it empty.` }
  const first = field.units?.[0]
  const range = field.range
  const out = range && (value < range[0] || value > range[1])
  return {
    value,
    ...(unit !== first && { raw: cell }),
    ...(out && {
      warning: `${field.label} ${cell} ${unit.symbol} is outside the usual ${range[0]} to ${range[1]} ${first?.symbol}. Check the unit of the column.`,
    }),
  }
}

/** The cells of one row by field key: numbers in the stored unit with their raw text, or text. */
type Cells = Record<string, { value: number; raw?: string } | string>

const quantityOf = (c: Cells[string] | undefined) =>
  c !== undefined && typeof c !== 'string'
    ? { value: c.value, ...(c.raw && { raw: c.raw }) }
    : undefined

/** The record of one row of `kind`; `makerId` is the id of its maker's record. */
function recordOf(
  kind: TableKind,
  id: string,
  name: string,
  saved: string,
  c: Cells,
  makerId: string | undefined,
): UserRecord {
  if (kind === 'bullet') {
    const coefficients = (['G1', 'G7'] as const).flatMap((m) => {
      const q = quantityOf(c[`bc${m}`])
      return q ? [{ dragModel: m, value: q.value }] : []
    })
    const diameter = quantityOf(c.diameter)
    const mass = quantityOf(c.mass)
    const length = quantityOf(c.length)
    const caliber = typeof c.caliber === 'string' ? c.caliber : undefined
    return {
      kind,
      id,
      name,
      saved,
      data: {
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
      },
    }
  }
  if (kind === 'powder') {
    const bulk = quantityOf(c.bulkDensity)
    return {
      kind,
      id,
      name,
      saved,
      data: {
        origin: 'user',
        provenanceKind: 'measured',
        draft: {
          // the choices of the field spell only these values
          ...(typeof c.grainForm === 'string' && {
            grainForm: c.grainForm as 'ball' | 'extruded' | 'flake' | 'other',
          }),
          ...(typeof c.propellantBase === 'string' && {
            propellantBase: c.propellantBase as 'single' | 'double' | 'triple',
          }),
          ...(bulk && { bulkDensity: bulk }),
        },
      },
    }
  }
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
  return {
    kind,
    id,
    name,
    saved,
    data: { origin: 'user', overrides: { name, ...(values.length > 0 && { values }) } },
  }
}

/** Lower case, accents and extra spaces folded: the form of a name in a key. */
const keyText = (s: string) =>
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

/** One cell into `c` as the field says: a choice, a number in the stored unit, or text. Returns the issue that rejects the row. */
function readCell(
  col: Column,
  cell: string,
  at: { row: number; header: string; map: TableColumnMap },
  c: Cells,
  warnings: RowIssue[],
): RowIssue | undefined {
  const { f } = col
  const issue = (reason: string): RowIssue => ({ row: at.row, column: at.header, cell, reason })
  if (cell === '')
    return f.required ? issue(`${f.label} is empty. Fill the cell or delete the row.`) : undefined
  if (f.choices) {
    const v = f.choices[cell.toLowerCase()]
    if (v === undefined) {
      warnings.push(
        issue(
          `${f.label} "${cell}" is not one of ${[...new Set(Object.values(f.choices))].join(', ')}. The value is left out; change the cell to keep it.`,
        ),
      )
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

/** The cells of one row by field, or the issue that rejects it. */
function readRow(
  columns: Column[],
  table: Table,
  cells: string[],
  row: number,
  map: TableColumnMap[],
  warnings: RowIssue[],
): Cells | RowIssue {
  const c: Cells = {}
  for (const col of columns) {
    if (col.i < 0) continue
    const bad = readCell(
      col,
      (cells[col.i] ?? '').trim(),
      { row, header: table.header[col.i] ?? col.f.label, map: map[col.i] ?? { decimal: '.' } },
      c,
      warnings,
    )
    if (bad) return bad
  }
  return c
}

const isIssue = (x: Cells | RowIssue): x is RowIssue =>
  typeof x.row === 'number' && typeof x.reason === 'string'

/**
 * The user records of `table` read with `map` as `kind`, saved at `now` (ISO 8601). Each row is
 * checked on its own: a row that fails is listed with row, column, cell and reason and never
 * blocks the others. Ids are deterministic (`idOfKey` of kind, name, maker and, for a bullet,
 * diameter and mass), so the same row read again gets the same id. The caller still parses each
 * record with the user record schema before storing it.
 */
export function buildRecords(
  table: Table,
  kind: TableKind,
  map: TableColumnMap[],
  now: string,
): BuiltRecords {
  const columns = fieldSpecs[kind].map((f) => ({ f, i: map.findIndex((m) => m.field === f.key) }))
  const out: BuiltRecords = {
    entries: [],
    makers: [],
    counts: { accepted: 0, warned: 0, rejected: 0 },
    rejected: [],
    warnings: [],
  }
  const missing = columns.filter((c) => c.f.required && c.i < 0)
  if (missing.length > 0) {
    const labels = missing.map((c) => c.f.label).join(', ')
    out.rejected.push({
      row: 1,
      column: labels,
      cell: '',
      reason: `No column is mapped to ${labels}. Map a column to ${missing.length > 1 ? 'each' : 'it'} or read the file as another kind.`,
    })
    out.counts.rejected = table.rows.length
    return out
  }
  const makers = new Map<string, string>()
  const makerOf = (maker: string) => {
    const key = `manufacturer|${keyText(maker)}`
    const known = makers.get(key)
    if (known) return known
    const id = idOfKey(key)
    makers.set(key, id)
    out.makers.push({
      key,
      record: { kind: 'manufacturer', id, name: maker, saved: now, data: { origin: 'user' } },
    })
    return id
  }
  const warned = new Set<number>()
  table.rows.forEach((cells, r) => {
    const row = r + (table.hasHeader ? 2 : 1)
    const before = out.warnings.length
    const c = readRow(columns, table, cells, row, map, out.warnings)
    if (isIssue(c)) {
      // warnings of a rejected row are dropped with it
      out.warnings.length = before
      out.rejected.push(c)
      return
    }
    if (out.warnings.length > before) warned.add(row)
    const name = String(c.name ?? '')
    const maker = typeof c.maker === 'string' ? c.maker : undefined
    const key = keyOf(kind, name, maker, c)
    const record = recordOf(kind, idOfKey(key), name, now, c, maker && makerOf(maker))
    out.entries.push({ key, row, record })
  })
  out.counts = { accepted: out.entries.length, warned: warned.size, rejected: out.rejected.length }
  return out
}
