import {
  type Bullet,
  type CaseCapacity,
  cartridge,
  type Discipline,
  type Federation,
  type Manufacturer,
  type Powder,
  pressureMethod,
  specValue,
  type TargetFace,
  type TargetMapping,
} from '@open-reloading/schema'
import { type SQLWrapper, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
} from 'drizzle-orm/pg-core'

// Query layer rebuilt from the data bundle; never edited directly.

/** Check constraint that keeps a text column to the values of a record schema enum (null passes). */
function oneOf(name: string, column: SQLWrapper, values: readonly string[]) {
  return check(name, sql`${column} in (${sql.raw(values.map((v) => `'${v}'`).join(', '))})`)
}

/** Cartridge records, one per C.I.P. sheet: names, table, country, dates, pressure method, verification, exceptions and provenance. */
export const cartridges = pgTable(
  'cartridges',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    aliases: text('aliases').array().notNull(),
    cipTable: text('cip_table').notNull(),
    country: text('country'),
    published: date('published', { mode: 'string' }).notNull(),
    revised: date('revised', { mode: 'string' }),
    pressureMethod: text('pressure_method'),
    verification: text('verification').notNull(),
    exceptions: jsonb('exceptions'),
    provenance: jsonb('provenance').notNull(),
  },
  (t) => [
    oneOf('cartridges_pressure_method_check', t.pressureMethod, pressureMethod.options),
    oneOf('cartridges_verification_check', t.verification, cartridge.shape.verification.options),
  ],
)

/** Values of a cartridge's sheet in file order, with symbol, quantity, side and tolerances. */
export const specValues = pgTable(
  'spec_values',
  {
    cartridgeId: text('cartridge_id')
      .notNull()
      .references(() => cartridges.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    side: text('side'),
    symbol: text('symbol').notNull(),
    quantity: text('quantity').notNull(),
    value: doublePrecision('value'),
    raw: text('raw'),
    limit: text('limit'),
    toleranceLower: doublePrecision('tolerance_lower'),
    toleranceUpper: doublePrecision('tolerance_upper'),
    variant: text('variant'),
    basic: boolean('basic'),
    footnotes: text('footnotes').array(),
  },
  (t) => [
    primaryKey({ columns: [t.cartridgeId, t.position] }),
    oneOf('spec_values_side_check', t.side, specValue.shape.side.unwrap().options),
    oneOf('spec_values_limit_check', t.limit, specValue.shape.limit.unwrap().options),
  ],
)

/** Hashes of the DDL the tables were built from and of the bundle last loaded into them; one row. */
export const bundleState = pgTable('bundle_state', {
  id: integer('id').primaryKey(),
  schema: text('schema').notNull(),
  sha256: text('sha256'),
})

// Component records are stored whole (`record`), with the columns that lists filter and sort on.

/** Manufacturer records, stored whole in `record`; `name` is the sort column of the lists. */
export const manufacturers = pgTable('manufacturers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  record: jsonb('record').$type<Manufacturer>().notNull(),
})

/** Powder records, stored whole in `record`; `manufacturer` (id) and `name` are the list's filter and sort columns. */
export const powders = pgTable('powders', {
  id: text('id').primaryKey(),
  manufacturer: text('manufacturer')
    .notNull()
    .references(() => manufacturers.id),
  name: text('name').notNull(),
  record: jsonb('record').$type<Powder>().notNull(),
})

/** Bullet records, stored whole in `record`; `diameter` in mm and `mass` in g, as in the record. */
export const bullets = pgTable('bullets', {
  id: text('id').primaryKey(),
  manufacturer: text('manufacturer')
    .notNull()
    .references(() => manufacturers.id),
  name: text('name').notNull(),
  diameter: doublePrecision('diameter').notNull(),
  mass: doublePrecision('mass').notNull(),
  record: jsonb('record').$type<Bullet>().notNull(),
})

/** Target face records, stored whole in `record`; `name` and `organization` are the list's sort columns. */
export const targetFaces = pgTable('target_faces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  organization: text('organization').notNull(),
  record: jsonb('record').$type<TargetFace>().notNull(),
})

/** Federation records, stored whole in `record`; `abbreviation` is the list's sort column. */
export const federations = pgTable('federations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  abbreviation: text('abbreviation').notNull(),
  record: jsonb('record').$type<Federation>().notNull(),
})

/** Discipline records of a federation, stored whole in `record`. */
export const disciplines = pgTable(
  'disciplines',
  {
    id: text('id').primaryKey(),
    federationId: text('federation_id')
      .notNull()
      .references(() => federations.id),
    name: text('name').notNull(),
    record: jsonb('record').$type<Discipline>().notNull(),
  },
  (t) => [index('disciplines_federation_idx').on(t.federationId)],
)

/** Target mapping records (a discipline on a target face), stored whole in `record`. */
export const targetMappings = pgTable(
  'target_mappings',
  {
    id: text('id').primaryKey(),
    disciplineId: text('discipline_id')
      .notNull()
      .references(() => disciplines.id),
    faceId: text('face_id')
      .notNull()
      .references(() => targetFaces.id),
    record: jsonb('record').$type<TargetMapping>().notNull(),
  },
  (t) => [
    index('target_mappings_discipline_idx').on(t.disciplineId),
    index('target_mappings_face_idx').on(t.faceId),
  ],
)

/** Case capacity records of a cartridge, stored whole in `record`. */
export const caseCapacities = pgTable(
  'case_capacities',
  {
    id: text('id').primaryKey(),
    cartridgeId: text('cartridge_id')
      .notNull()
      .references(() => cartridges.id),
    record: jsonb('record').$type<CaseCapacity>().notNull(),
  },
  (t) => [index('case_capacities_cartridge_id_idx').on(t.cartridgeId)],
)
