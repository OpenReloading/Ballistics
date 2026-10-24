import type {
  Bullet,
  Cartridge,
  CaseCapacity,
  CaseType,
  Discipline,
  Federation,
  Manufacturer,
  Powder,
  Renames,
  TargetFace,
  TargetMapping,
} from '@openreloading/schema'

/** The entities of the catalogue, the names `Catalogue.get` takes. */
export type CatalogueKind =
  | 'cartridge'
  | 'manufacturer'
  | 'powder'
  | 'bullet'
  | 'caseCapacity'
  | 'targetFace'
  | 'federation'
  | 'discipline'
  | 'targetMapping'

/** The record type of each {@link CatalogueKind}. */
export interface RecordOfKind {
  cartridge: Cartridge
  manufacturer: Manufacturer
  powder: Powder
  bullet: Bullet
  caseCapacity: CaseCapacity
  targetFace: TargetFace
  federation: Federation
  discipline: Discipline
  targetMapping: TargetMapping
}

/**
 * A record as `Catalogue.get` answers it: the stored record with its `kind`, `origin` (always
 * `catalogue`) and `revision` (a hash of the stored record, it changes with any field). The
 * generated record file holds none of the three.
 */
export type Catalogued<K extends CatalogueKind> = RecordOfKind[K] & {
  kind: K
  origin: 'catalogue'
  revision: string
}

/** One page of a list: `total` counts the items before paging. */
export interface CataloguePage<T> {
  total: number
  items: T[]
}

/** Paging of a list: `limit` items from `offset`, every item without them. */
export interface Paging {
  limit?: number
  offset?: number
}

/** Query of `Catalogue.cartridges`: `q` searches names and aliases, `table` is the C.I.P. table. */
export interface CartridgeQuery extends Paging {
  q?: string
  table?: string
}

/** Query of `Catalogue.powders`: `q` searches the manufacturer's name or alias with the product name, `manufacturer` is a manufacturer id. */
export interface PowderQuery extends Paging {
  q?: string
  manufacturer?: string
}

/** Query of `Catalogue.bullets`: as {@link PowderQuery}, `cartridge` keeps the bullets that fit that cartridge (`bulletWindow` of core). */
export interface BulletQuery extends PowderQuery {
  cartridge?: string
}

/** A cartridge of the list, the fields of `GET /cartridges`. Lengths and diameters in mm, `pmax` in bar. */
export interface CartridgeItem {
  id: string
  name: string
  aliases: string[]
  table: string
  maxBulletDiameter?: number
  boreDiameter?: number
  grooveDiameter?: number
  caseLength?: number
  cartridgeLength?: number
  pmax?: number
  caseType?: CaseType
  country?: string
}

/** A manufacturer of the list. */
export interface ManufacturerItem {
  id: string
  name: string
  aliases?: string[]
  website?: string
}

/** The part of a powder's M3 parameters the burn-rate curve reads. */
export interface PowderInteriorItem {
  vivacity?: unknown
  pressureExponent?: number
  referencePressure?: unknown
  burnForm?: unknown
}

/** A powder of the list. */
export interface PowderItem {
  id: string
  manufacturer: string
  name: string
  grainForm?: string
  propellantBase?: string
  country?: string
  interior?: PowderInteriorItem
}

/** A bullet of the list: values of the record, null where it has none. Diameter, mass and length as stored (mm, g). */
export interface BulletItem {
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

/** A target face of the list, with the caliber classes and categories it is used for. */
export interface TargetFaceItem {
  id: string
  organization: string
  name: string
  caliberClasses: string[]
  categories: string[]
}

/** A federation of the list. */
export interface FederationItem {
  id: string
  name: string
  abbreviation: string
  country?: string
  internationalFederation?: string
}

/** A discipline of the list. */
export interface DisciplineItem {
  id: string
  federation: string
  name: string
  number?: string
  distanceMm: number
  category?: string
}

/** A target mapping of the list. */
export interface TargetMappingItem {
  id: string
  discipline: string
  face: string
  event?: string
  stage?: string
  gaugeMm?: number
}

/**
 * A row of the index: the list item, the key it is ordered by (`sortKey` of the schema package)
 * and the key it is searched by (`searchKey`). Rows are stored in the default order of their list.
 */
export interface IndexRow<T> {
  item: T
  sortKey: string
  search: string
}

/** The layout of the index and the record file; a file of another format is refused. */
export const catalogueFormat = 1

/**
 * The version of what `derive.ts` computes (list items, sort and search keys, revisions). Raise it
 * with any change to those, so a build made by older code is refused instead of read as current.
 */
export const deriveVersion = 1

/** The first fields of the index and of the record file: what built them. */
export interface CatalogueHeader {
  format: typeof catalogueFormat
  derive: typeof deriveVersion
}

/** The typed summary index: every list of the catalogue, each in its default order. */
export interface CatalogueIndex extends CatalogueHeader {
  cartridges: IndexRow<CartridgeItem>[]
  manufacturers: IndexRow<ManufacturerItem>[]
  powders: IndexRow<PowderItem>[]
  bullets: IndexRow<BulletItem>[]
  targetFaces: IndexRow<TargetFaceItem>[]
  federations: IndexRow<FederationItem>[]
  disciplines: IndexRow<DisciplineItem>[]
  targetMappings: IndexRow<TargetMappingItem>[]
  /** The capacity record ids of each cartridge that has any, ordered by id. */
  capacities: Record<string, string[]>
  /** The ids that no longer name a record, by kind, each with the id that replaces it. */
  renames: Renames
}

/** The record file: the header and every record by id, one map per kind. */
export type RecordFile = CatalogueHeader & {
  [K in CatalogueKind]: Record<string, RecordOfKind[K]>
}

/** The records a catalogue is built from; `Bundle` of `@openreloading/data` has them. */
export interface CatalogueSource {
  cartridges: Cartridge[]
  manufacturers: Manufacturer[]
  powders: Powder[]
  bullets: Bullet[]
  capacities: CaseCapacity[]
  targetFaces: TargetFace[]
  federations: Federation[]
  disciplines: Discipline[]
  targetMappings: TargetMapping[]
  /** `renames.json` of the records; absent: none. */
  renames?: Renames
}

/** What `openCatalogue` opens: the index and the record file, or a function that reads it on the first `get`. */
export interface CatalogueData {
  index: CatalogueIndex
  /** The record file, or a function that reads it. */
  records: RecordFile | (() => RecordFile)
}

/** The read-only catalogue: lists in their default order, records by id. The same in the API server, the Pages build, the browser and tests. */
export interface Catalogue {
  /** Cartridges, ranked by `q` where set. */
  cartridges(query?: CartridgeQuery): CataloguePage<CartridgeItem>
  /** Manufacturers by name. */
  manufacturers(): CataloguePage<ManufacturerItem>
  /** Powders by manufacturer name and name, ranked by `q` where set. */
  powders(query?: PowderQuery): CataloguePage<PowderItem>
  /** Bullets by manufacturer name and name, ranked by `q` where set; none for a `cartridge` that is unknown or lacks its C.I.P. G1, F or Z. */
  bullets(query?: BulletQuery): CataloguePage<BulletItem>
  /** Every target face. */
  targetFaces(): CataloguePage<TargetFaceItem>
  /** Every federation. */
  federations(): CataloguePage<FederationItem>
  /** Disciplines, of one federation where `federation` is set. */
  disciplines(query?: { federation?: string }): CataloguePage<DisciplineItem>
  /** Target mappings, of one discipline and one face where set. */
  targetMappings(query?: { discipline?: string; face?: string }): CataloguePage<TargetMappingItem>
  /** The record `id` of `kind`; undefined if unknown. */
  get<K extends CatalogueKind>(kind: K, id: string): Catalogued<K> | undefined
  /** The id that replaces `id` of a route kind where it was renamed or removed; undefined otherwise. */
  renamed(kind: string, id: string): string | undefined
  /** The case capacity records of a cartridge, ordered by id. */
  capacities(cartridge: string): Catalogued<'caseCapacity'>[]
}
