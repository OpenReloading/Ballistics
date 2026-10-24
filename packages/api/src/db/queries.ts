import { type CartridgeDiameters, leastSpecValue } from '@open-reloading/core'
import type { CaseCapacity } from '@open-reloading/schema'
import { and, asc, count, eq, ilike, or, type SQL, sql } from 'drizzle-orm'
import type { Db } from './index.ts'
import {
  type bullets,
  cartridges,
  caseCapacities,
  type disciplines,
  type federations,
  type manufacturers,
  type powders,
  specValues,
  type targetFaces,
  type targetMappings,
} from './schema.ts'

/** Query of `GET /cartridges`: `q` matches names and aliases, `table` is the C.I.P. table, `limit` and `offset` page the list. */
export type CartridgeListParams = {
  q?: string
  table?: string
  limit: number
  offset: number
}

/** Drops null and undefined fields, so responses match the records' "absent means unknown". */
export function compact<T extends Record<string, unknown>>(row: T) {
  return Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null && v !== undefined))
}

/** A table of whole records: the record id in `id`, the record in `record`. */
type RecordTable =
  | typeof manufacturers
  | typeof powders
  | typeof bullets
  | typeof targetFaces
  | typeof federations
  | typeof disciplines
  | typeof targetMappings

/** The whole record `id` of `table`; undefined if unknown. */
export async function recordById<T extends RecordTable>(db: Db, table: T, id: string) {
  const t: RecordTable = table
  const [row] = await db.select({ record: t.record }).from(t).where(eq(t.id, id))
  return row?.record as T['$inferSelect']['record'] | undefined
}

/** One page of a list: `total` counts the items before paging. */
export interface ListPage<T> {
  total: number
  items: T[]
}

/** `text` with the `like` wildcards `%` and `_` and the escape `\` escaped, to match it literally. */
export function escapeLike(text: string) {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/**
 * The smallest or largest value of a symbol on the sheet of the outer query's `cartridges` row, as
 * a scalar subquery; null when there is none.
 */
function sheetValue(
  db: Db,
  agg: 'min' | 'max',
  symbol: string,
  side: 'cartridge' | 'chamber' | null,
) {
  return sql<number | null>`(${db
    .select({ v: agg === 'min' ? sql`min(${specValues.value})` : sql`max(${specValues.value})` })
    .from(specValues)
    .where(
      and(
        eq(specValues.cartridgeId, cartridges.id),
        side === null ? sql`${specValues.side} is null` : eq(specValues.side, side),
        eq(specValues.symbol, symbol),
      ),
    )})`
}

/** The `where` of the cartridge list: `q` and `table` as `CartridgeListParams` describes them. */
function cartridgeFilter(params: CartridgeListParams) {
  const conditions: SQL[] = []
  if (params.q) {
    const pattern = `%${escapeLike(params.q)}%`
    const byName = or(
      ilike(cartridges.name, pattern),
      sql`array_to_string(${cartridges.aliases}, ' ') ilike ${pattern}`,
    )
    if (byName) conditions.push(byName)
  }
  if (params.table) conditions.push(eq(cartridges.cipTable, params.table))
  return conditions.length > 0 ? and(...conditions) : undefined
}

/** One page of cartridges, ordered by name and id, with `total` the count before paging. The fields are listed in `packages/api/AGENTS.md`. */
export async function listCartridges(db: Db, params: CartridgeListParams) {
  const where = cartridgeFilter(params)
  const [{ total }] = await db.select({ total: count() }).from(cartridges).where(where)
  const items = await db
    .select({
      id: cartridges.id,
      name: cartridges.name,
      aliases: cartridges.aliases,
      table: cartridges.cipTable,
      maxBulletDiameter: sheetValue(db, 'min', 'G1', 'cartridge'),
      boreDiameter: sheetValue(db, 'min', 'F', 'chamber'),
      grooveDiameter: sheetValue(db, 'min', 'Z', 'chamber'),
      caseLength: sheetValue(db, 'min', 'L3', 'cartridge'),
      cartridgeLength: sheetValue(db, 'min', 'L6', 'cartridge'),
      pmax: sheetValue(db, 'max', 'Pmax', null),
      r1: sheetValue(db, 'min', 'R1', 'cartridge'),
      p1: sheetValue(db, 'min', 'P1', 'cartridge'),
      r3: sheetValue(db, 'min', 'R3', 'cartridge'),
      country: cartridges.country,
    })
    .from(cartridges)
    .where(where)
    .orderBy(asc(cartridges.name), asc(cartridges.id))
    .limit(params.limit)
    .offset(params.offset)
  return {
    total,
    items: items.map(({ r1, p1, r3, ...c }) => compact({ ...c, caseType: caseType(r1, p1, r3) })),
  }
}

/**
 * The case head from the cartridge R1 (rim), P1 (body at the head) and R3 (belt), mm: belted with
 * an R3, rimmed with the rim more than 0.7 mm wider than the body, semi-rimmed with it more than
 * 0.3 mm and at most 0.7 mm wider, rebated with it more than 0.25 mm narrower, rimless between.
 * Bounds set by hand.
 */
export function caseType(r1: number | null, p1: number | null, r3: number | null) {
  if (r3 !== null) return 'belted'
  if (r1 === null || p1 === null) return
  // to 0.01 mm, the records' resolution, so a difference on a bound stays on its side
  const d = Math.round((r1 - p1) * 100) / 100
  if (d > 0.7) return 'rimmed'
  if (d > 0.3) return 'semi-rimmed'
  return d < -0.25 ? 'rebated' : 'rimless'
}

type SpecValueRow = typeof specValues.$inferSelect

/** The smallest cartridge-side value of `symbol` among `values`, as the list takes it. */
const sheetMin = (values: SpecValueRow[], symbol: string) =>
  leastSpecValue(values, 'cartridge', symbol) ?? null

/** A value of the sheet with the record's field names: `tolerance` from its two columns, null columns left out. */
function valueView({ cartridgeId, position, toleranceLower, toleranceUpper, ...v }: SpecValueRow) {
  const tolerance = compact({ lower: toleranceLower, upper: toleranceUpper })
  return compact({ ...v, tolerance: Object.keys(tolerance).length > 0 ? tolerance : undefined })
}

/** A cartridge of {@link getCartridge}: the record's fields, its case type and its case capacities. */
interface CartridgeView {
  [field: string]: unknown
  values: Record<string, unknown>[]
  capacities: CaseCapacity[]
}

/** One cartridge record with its values in file order and its case capacities; undefined if unknown. */
export async function getCartridge(db: Db, id: string): Promise<CartridgeView | undefined> {
  const [row] = await db.select().from(cartridges).where(eq(cartridges.id, id))
  if (!row) return

  const values = await db
    .select()
    .from(specValues)
    .where(eq(specValues.cartridgeId, id))
    .orderBy(asc(specValues.position))
  const capacities = await db
    .select({ record: caseCapacities.record })
    .from(caseCapacities)
    .where(eq(caseCapacities.cartridgeId, id))
    .orderBy(asc(caseCapacities.id))

  const { cipTable, ...rest } = row
  return {
    ...compact({
      ...rest,
      table: cipTable,
      caseType: caseType(sheetMin(values, 'R1'), sheetMin(values, 'P1'), sheetMin(values, 'R3')),
    }),
    values: values.map(valueView),
    capacities: capacities.map((c) => c.record),
  }
}

/**
 * The C.I.P. values the bullet fit reads (`CartridgeDiameters` of core): the smallest cartridge-side G1 and
 * chamber-side F and Z of the cartridge's sheet, the same values as the cartridge
 * list's `maxBulletDiameter`, `boreDiameter` and `grooveDiameter`; undefined when one is missing.
 */
export async function cartridgeFit(db: Db, id: string): Promise<CartridgeDiameters | undefined> {
  const [row] = await db
    .select({
      g1: sheetValue(db, 'min', 'G1', 'cartridge'),
      land: sheetValue(db, 'min', 'F', 'chamber'),
      groove: sheetValue(db, 'min', 'Z', 'chamber'),
    })
    .from(cartridges)
    .where(eq(cartridges.id, id))
  if (!row) return
  const { g1, land, groove } = row
  return g1 === null || land === null || groove === null ? undefined : { g1, land, groove }
}
