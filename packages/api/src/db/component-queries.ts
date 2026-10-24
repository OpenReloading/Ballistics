import { bulletWindow } from '@open-reloading/core'
import { and, asc, count, eq, type SQL, sql } from 'drizzle-orm'
import { compact } from '../catalogue/derive.ts'
import type { Db } from './index.ts'
import { cartridgeFit, escapeLike, type ListPage, recordById } from './queries.ts'
import { bullets, manufacturers, powders } from './schema.ts'

/**
 * Query of the powder and bullet lists: `q` matches the manufacturer's name or one of its aliases
 * followed by the product name, `manufacturer` is a manufacturer id, `limit` and `offset` page the
 * list.
 */
export type ComponentListParams = {
  q?: string
  manufacturer?: string
  /** Cartridge id; bullets only: those that fit its C.I.P. G1, F and Z (`bulletFits` of core). */
  cartridge?: string
  limit: number
  offset: number
}

function componentFilter(
  table: typeof powders | typeof bullets,
  params: ComponentListParams,
): SQL | undefined {
  const conditions: SQL[] = []
  if (params.q) {
    const pattern = `%${escapeLike(params.q)}%`
    conditions.push(
      sql`((${manufacturers.name} || ' ' || ${table.name}) ilike ${pattern} or exists (select 1 from jsonb_array_elements_text(coalesce(${manufacturers.record}->'aliases', '[]'::jsonb)) as alias where (alias || ' ' || ${table.name}) ilike ${pattern}))`,
    )
  }
  if (params.manufacturer) conditions.push(eq(table.manufacturer, params.manufacturer))
  return conditions.length > 0 ? and(...conditions) : undefined
}

/** One page of powder summaries ordered by manufacturer name, name and id, with `total` the count before paging. */
export async function listPowders(db: Db, params: ComponentListParams) {
  const where = componentFilter(powders, params)
  const [{ total }] = await db
    .select({ total: count() })
    .from(powders)
    .innerJoin(manufacturers, eq(manufacturers.id, powders.manufacturer))
    .where(where)
  const items = await db
    .select({
      id: powders.id,
      manufacturer: powders.manufacturer,
      name: powders.name,
      grainForm: sql<string | null>`${powders.record}->>'grainForm'`,
      propellantBase: sql<string | null>`${powders.record}->>'propellantBase'`,
      country: sql<string | null>`${powders.record}->>'country'`,
      // what the burn-rate curve needs (the web app's burn-rate order), not the whole model
      interior: sql<Record<
        string,
        unknown
      > | null>`case when ${powders.record}->'interior' is not null then jsonb_build_object('vivacity', ${powders.record}#>'{interior,vivacity}', 'pressureExponent', ${powders.record}#>'{interior,pressureExponent}', 'referencePressure', ${powders.record}#>'{interior,referencePressure}', 'burnForm', ${powders.record}#>'{interior,burnForm}') end`,
    })
    .from(powders)
    .innerJoin(manufacturers, eq(manufacturers.id, powders.manufacturer))
    .where(where)
    .orderBy(asc(manufacturers.name), asc(powders.name), asc(powders.id))
    .limit(params.limit)
    .offset(params.offset)
  return { total, items: items.map(compact) }
}

/** The record's first coefficient of a drag model (a manufacturer's banded sheet lists the top band first), or null. */
const firstBallisticCoefficient = (model: 'G1' | 'G7') =>
  sql<
    number | null
  >`(jsonb_path_query_first(${bullets.record}, ${`$.ballisticCoefficients[*] ? (@.dragModel == "${model}").value`}::jsonpath))::float8`

/**
 * A bullet of {@link listBullets}: values of the record, null where it has none; `country`,
 * `tipType` and `construction` are absent without a value.
 */
interface BulletSummary {
  id: string
  manufacturer: string
  name: string
  diameter: number
  mass: number
  length: number | null
  ballisticCoefficientG1: number | null
  ballisticCoefficientG7: number | null
  country?: string
  tipType?: string
  construction?: string
}

/** One page of bullet summaries ordered by manufacturer name, name and id, with `total` the count before paging; `cartridge` keeps the bullets that fit it, none for a cartridge without its C.I.P. values. */
export async function listBullets(
  db: Db,
  params: ComponentListParams,
): Promise<ListPage<BulletSummary>> {
  const conditions = [componentFilter(bullets, params)]
  if (params.cartridge !== undefined) {
    const fit = await cartridgeFit(db, params.cartridge)
    if (!fit) return { total: 0, items: [] }
    const w = bulletWindow(fit)
    conditions.push(sql`${bullets.diameter} > ${w.above} and ${bullets.diameter} <= ${w.upTo}`)
  }
  const where = and(...conditions)
  const [{ total }] = await db
    .select({ total: count() })
    .from(bullets)
    .innerJoin(manufacturers, eq(manufacturers.id, bullets.manufacturer))
    .where(where)
  const items = await db
    .select({
      id: bullets.id,
      manufacturer: bullets.manufacturer,
      name: bullets.name,
      diameter: bullets.diameter,
      mass: bullets.mass,
      length: sql<number | null>`(${bullets.record}->'length'->>'value')::float8`,
      ballisticCoefficientG1: firstBallisticCoefficient('G1'),
      ballisticCoefficientG7: firstBallisticCoefficient('G7'),
      country: sql<string | null>`${bullets.record}->>'country'`,
      tipType: sql<string | null>`${bullets.record}->'tip'->>'type'`,
      // the structure; else the core material as "<material>-core"
      construction: sql<
        string | null
      >`coalesce(${bullets.record}->'construction'->>'structure', (${bullets.record}->'construction'->'core'->>'material') || '-core')`,
    })
    .from(bullets)
    .innerJoin(manufacturers, eq(manufacturers.id, bullets.manufacturer))
    .where(where)
    .orderBy(asc(manufacturers.name), asc(bullets.name), asc(bullets.id))
    .limit(params.limit)
    .offset(params.offset)
  // a field without a value stays absent, as in the records
  return {
    total,
    items: items.map(({ country, tipType, construction, ...b }) => ({
      ...b,
      ...compact({ country, tipType, construction }),
    })),
  }
}

/** The whole powder record; undefined if unknown. */
export const getPowder = (db: Db, id: string) => recordById(db, powders, id)

/** The whole bullet record; undefined if unknown. */
export const getBullet = (db: Db, id: string) => recordById(db, bullets, id)

/** Every manufacturer as `{ id, name, aliases?, website? }`, ordered by name and id. */
export async function listManufacturers(db: Db) {
  const rows = await db
    .select({ record: manufacturers.record })
    .from(manufacturers)
    .orderBy(asc(manufacturers.name), asc(manufacturers.id))
  const items = rows.map(({ record: { id, name, aliases, website } }) =>
    compact({ id, name, aliases, website }),
  )
  return { total: items.length, items }
}

/** The whole manufacturer record; undefined if unknown. */
export const getManufacturer = (db: Db, id: string) => recordById(db, manufacturers, id)
