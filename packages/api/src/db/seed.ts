import { createHash } from 'node:crypto'
import type { Bundle } from '@open-reloading/data'
import type {
  Bullet,
  Cartridge,
  CaseCapacity,
  Discipline,
  Federation,
  Manufacturer,
  Powder,
  TargetFace,
  TargetMapping,
} from '@open-reloading/schema'
import type { InferInsertModel } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { Db } from './index.ts'
import {
  bullets,
  bundleState,
  cartridges,
  caseCapacities,
  disciplines,
  federations,
  manufacturers,
  powders,
  specValues,
  targetFaces,
  targetMappings,
} from './schema.ts'

const insertChunkSize = 1000

async function insertChunked<T>(rows: T[], insert: (part: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += insertChunkSize)
    await insert(rows.slice(i, i + insertChunkSize))
}

/** A table and its rows, the rows checked against the table's columns. */
const fill = <T extends PgTable>(table: T, rows: InferInsertModel<T>[]) => ({
  table,
  insert: (db: Db) => insertChunked(rows, (part) => db.insert(table).values(part)),
})

const cartridgeRow = (c: Cartridge) => ({
  id: c.id,
  name: c.name,
  aliases: c.aliases ?? [],
  cipTable: c.table,
  country: c.country ?? null,
  published: c.published,
  revised: c.revised ?? null,
  pressureMethod: c.pressureMethod ?? null,
  verification: c.verification,
  exceptions: c.exceptions ?? null,
  provenance: c.provenance,
})

const specValueRows = (c: Cartridge) =>
  c.values.map((v, position) => ({
    cartridgeId: c.id,
    position,
    side: v.side ?? null,
    symbol: v.symbol,
    quantity: v.quantity,
    value: v.value ?? null,
    raw: v.raw ?? null,
    limit: v.limit ?? null,
    toleranceLower: v.tolerance?.lower ?? null,
    toleranceUpper: v.tolerance?.upper ?? null,
    variant: v.variant ?? null,
    basic: v.basic ?? null,
    footnotes: v.footnotes ?? null,
  }))

const manufacturerRow = (m: Manufacturer) => ({ id: m.id, name: m.name, record: m })

const powderRow = (p: Powder) => ({
  id: p.id,
  manufacturer: p.manufacturer,
  name: p.name,
  record: p,
})

const bulletRow = (b: Bullet) => ({
  id: b.id,
  manufacturer: b.manufacturer,
  name: b.name,
  diameter: b.diameter.value,
  mass: b.mass.value,
  record: b,
})

const capacityRow = (c: CaseCapacity) => ({ id: c.id, cartridgeId: c.cartridge, record: c })

const targetFaceRow = (f: TargetFace) => ({
  id: f.id,
  name: f.name,
  organization: f.organization,
  record: f,
})

const federationRow = (f: Federation) => ({
  id: f.id,
  name: f.name,
  abbreviation: f.abbreviation,
  record: f,
})

const disciplineRow = (d: Discipline) => ({
  id: d.id,
  federationId: d.federation,
  name: d.name,
  record: d,
})

const targetMappingRow = (m: TargetMapping) => ({
  id: m.id,
  disciplineId: m.discipline,
  faceId: m.face,
  record: m,
})

/** One insertable row array per table, from the bundle; `rowsHash` hashes it so a changed mapping reloads the database. */
function seedRows(bundle: Bundle) {
  return {
    cartridges: bundle.cartridges.map(cartridgeRow),
    specValues: bundle.cartridges.flatMap(specValueRows),
    manufacturers: bundle.manufacturers.map(manufacturerRow),
    powders: bundle.powders.map(powderRow),
    bullets: bundle.bullets.map(bulletRow),
    capacities: bundle.capacities.map(capacityRow),
    targetFaces: bundle.targetFaces.map(targetFaceRow),
    federations: bundle.federations.map(federationRow),
    disciplines: bundle.disciplines.map(disciplineRow),
    targetMappings: bundle.targetMappings.map(targetMappingRow),
  }
}

/** Hash of the rows to write: a change to the data or to how it is mapped to rows reloads the database. */
function rowsHash(rows: ReturnType<typeof seedRows>) {
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex')
}

/**
 * Replaces every table with the bundle's records, unless the bundle is already loaded. Needs the
 * `bundle_state` row that `ensureTables` writes.
 */
export function seedBundle(db: Db, bundle: Bundle): Promise<boolean> {
  const rows = seedRows(bundle)
  const sha256 = rowsHash(rows)
  return db.transaction(async (tx) => {
    const [state] = await tx.select().from(bundleState)
    if (state?.sha256 === sha256) return false
    // in insert order, each table after the tables it references; deleted in reverse
    const tables = [
      fill(cartridges, rows.cartridges),
      fill(specValues, rows.specValues),
      fill(manufacturers, rows.manufacturers),
      fill(powders, rows.powders),
      fill(bullets, rows.bullets),
      fill(caseCapacities, rows.capacities),
      fill(targetFaces, rows.targetFaces),
      fill(federations, rows.federations),
      fill(disciplines, rows.disciplines),
      fill(targetMappings, rows.targetMappings),
    ]
    for (const { table } of [...tables].reverse()) await tx.delete(table)
    for (const { insert } of tables) await insert(tx)
    await tx.update(bundleState).set({ sha256 })
    return true
  })
}
