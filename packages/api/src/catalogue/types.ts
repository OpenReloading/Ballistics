import type {
  Bullet,
  CaliberClass,
  Cartridge,
  CaseMaterial,
  CaseType,
  CatalogueCase,
  CatalogueCaseCapacity,
  Discipline,
  EventType,
  Federation,
  Manufacturer,
  Powder,
  Primer,
  PrimerCompound,
  PrimerSize,
  Renames,
  TargetFace,
  TargetMapping,
} from '@open-reloading/schema'

/** The entities of the catalogue, the names `Catalogue.get` takes. */
export type CatalogueKind =
  | 'cartridge'
  | 'manufacturer'
  | 'powder'
  | 'primer'
  | 'bullet'
  | 'case'
  | 'caseCapacity'
  | 'targetFace'
  | 'federation'
  | 'discipline'
  | 'targetMapping'
  | 'caliberClass'
  | 'eventType'

/** The record type of each {@link CatalogueKind}. */
export interface RecordOfKind {
  cartridge: Cartridge
  manufacturer: Manufacturer
  powder: Powder
  primer: Primer
  bullet: Bullet
  /** The record file leaves out `origin`, which every catalogue record has. */
  case: Omit<CatalogueCase, 'origin'>
  /** The record file leaves out `origin`, which every catalogue record has. */
  caseCapacity: Omit<CatalogueCaseCapacity, 'origin'>
  targetFace: TargetFace
  federation: Federation
  discipline: Discipline
  targetMapping: TargetMapping
  caliberClass: CaliberClass
  eventType: EventType
}

/**
 * A record as `Catalogue.get` answers it: the stored record with its `kind`, `origin` (always
 * `catalogue`) and `revision` (a hash of the stored record, changes with any field). The
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
  limit?: number | undefined
  offset?: number | undefined
}

/** Query of `Catalogue.cartridges`: `q` searches names and aliases, `table` is the C.I.P. table. */
export interface CartridgeQuery extends Paging {
  q?: string | undefined
  table?: string | undefined
}

/** Query of `Catalogue.powders`: `q` searches the manufacturer's name or alias with the product name, `manufacturer` is a manufacturer id. */
export interface PowderQuery extends Paging {
  q?: string | undefined
  manufacturer?: string | undefined
}

/** Query of `Catalogue.bullets`: as {@link PowderQuery}, `cartridge` keeps the bullets that fit that cartridge (`bulletWindow` of core). */
export interface BulletQuery extends PowderQuery {
  cartridge?: string | undefined
}

/** Query of `Catalogue.primers`: as {@link PowderQuery}, `size` and `compound` keep the primers of that size and priming compound. */
export interface PrimerQuery extends PowderQuery {
  size?: PrimerSize | undefined
  compound?: PrimerCompound | undefined
}

/** Query of `Catalogue.cases`: as {@link PowderQuery}, `cartridge` keeps the cases of that cartridge (an id). */
export interface CaseQuery extends PowderQuery {
  cartridge?: string | undefined
}

/** A cartridge of the list (`GET /cartridges`). Lengths and diameters in mm, `pmax` in bar. */
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

/** The part of a powder's M3 parameters the burn-rate curve reads, with the fit's basis. */
export interface PowderInteriorItem {
  vivacity?: unknown
  pressureExponent?: number
  referencePressure?: unknown
  burnForm?: unknown
  trainingRows?: number
  trainingCartridges?: number
  /** ISO date the latest fitted source was read. */
  retrieved?: string
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

/** A primer of the list. `manufacturer` is a record id. */
export interface PrimerItem {
  id: string
  manufacturer: string
  name: string
  productNumber?: string
  size: PrimerSize
  magnum?: boolean
  compound?: PrimerCompound
}

/** A bullet of the list: values of the record (mm, g), null where it has none. */
export interface BulletItem {
  id: string
  manufacturer: string
  name: string
  diameter: number | null
  mass: number
  length: number | null
  ballisticCoefficientG1: number | null
  ballisticCoefficientG7: number | null
  country?: string
  tipType?: string
  baseType?: string
  construction?: string
  leadFree?: boolean
  nameOnly?: true
}

/** A case of the list. `manufacturer` and `cartridge` are record ids; `waterCapacity` (the stated one) and `mass` in g. */
export interface CaseItem {
  id: string
  manufacturer: string
  cartridge: string
  name: string
  productNumber: string
  material: CaseMaterial
  waterCapacity?: number
  mass?: number
}

/** A target face of the list, with its caliber classes and categories. `organization` is the abbreviation of the face's federation. */
export interface TargetFaceItem {
  id: string
  federation?: string | undefined
  organization?: string
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
  website?: string
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

/** A caliber class of the list. Diameter in mm. */
export interface CaliberClassItem {
  id: string
  name: string
  diameterMm: number
}

/** An event type of the list: its federation and scoring method. */
export interface EventTypeItem {
  id: string
  name: string
  federation: string
  method: 'hit-factor' | 'rings'
}

/**
 * A row of the index: the list item, its order key (`sortKey` of the schema package) and search
 * key (`searchKey`). Rows are stored in the default order of their list.
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
export const deriveVersion = 7

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
  primers: IndexRow<PrimerItem>[]
  bullets: IndexRow<BulletItem>[]
  cases: IndexRow<CaseItem>[]
  targetFaces: IndexRow<TargetFaceItem>[]
  federations: IndexRow<FederationItem>[]
  disciplines: IndexRow<DisciplineItem>[]
  targetMappings: IndexRow<TargetMappingItem>[]
  caliberClasses: IndexRow<CaliberClassItem>[]
  eventTypes: IndexRow<EventTypeItem>[]
  /** The capacity record ids of each cartridge that has any, ordered by id. */
  capacities: Record<string, string[]>
  /** The ids that no longer name a record, by kind, each with the id that replaces it. */
  renames: Renames
}

/** The record file: the header and every record by id, one map per kind. */
export type RecordFile = CatalogueHeader & {
  [K in CatalogueKind]: Record<string, RecordOfKind[K]>
}

/** The records a catalogue is built from; `Bundle` of `@open-reloading/data` has them. */
export interface CatalogueSource {
  cartridges: Cartridge[]
  manufacturers: Manufacturer[]
  powders: Powder[]
  primers: Primer[]
  bullets: Bullet[]
  cases: CatalogueCase[]
  capacities: CatalogueCaseCapacity[]
  targetFaces: TargetFace[]
  federations: Federation[]
  disciplines: Discipline[]
  targetMappings: TargetMapping[]
  caliberClasses: CaliberClass[]
  /** Absent: none, as in a bundle without event types. */
  eventTypes?: EventType[] | undefined
  /** `renames.json` of the records; absent: none. */
  renames?: Renames | undefined
}

/** What `openCatalogue` opens: the index and the record file, or a function that reads it on first `get`. */
export interface CatalogueData {
  index: CatalogueIndex
  /** The record file, or a function that reads it. */
  records: RecordFile | (() => RecordFile)
}

/** The read-only catalogue: lists in default order, records by id. The same in the API server, the Pages build, the browser and tests. */
export interface Catalogue {
  /** Cartridges, ranked by `q` where set. */
  cartridges(query?: CartridgeQuery): CataloguePage<CartridgeItem>
  /** Manufacturers by name. */
  manufacturers(): CataloguePage<ManufacturerItem>
  /** Powders by manufacturer name and name, ranked by `q` where set. */
  powders(query?: PowderQuery): CataloguePage<PowderItem>
  /** Primers by manufacturer name and name, ranked by `q` where set. */
  primers(query?: PrimerQuery): CataloguePage<PrimerItem>
  /** Bullets by manufacturer name and name, ranked by `q` where set; none for a `cartridge` that is unknown or lacks its C.I.P. G1, F or Z. */
  bullets(query?: BulletQuery): CataloguePage<BulletItem>
  /** Cases by manufacturer name and name, ranked by `q` where set. */
  cases(query?: CaseQuery): CataloguePage<CaseItem>
  /** Every target face. */
  targetFaces(): CataloguePage<TargetFaceItem>
  /** Every federation. */
  federations(): CataloguePage<FederationItem>
  /** Disciplines, of one federation where `federation` is set. */
  disciplines(query?: { federation?: string | undefined }): CataloguePage<DisciplineItem>
  /** Target mappings, of one discipline and one face where set. */
  targetMappings(query?: {
    discipline?: string | undefined
    face?: string | undefined
  }): CataloguePage<TargetMappingItem>
  /** Caliber classes by nominal diameter. */
  caliberClasses(): CataloguePage<CaliberClassItem>
  /** Event types by name. */
  eventTypes(): CataloguePage<EventTypeItem>
  /** The record `id` of `kind`; undefined if unknown. */
  get<K extends CatalogueKind>(kind: K, id: string): Catalogued<K> | undefined
  /** The id that replaces `id` of a route kind where it was renamed or removed; undefined otherwise. */
  renamed(kind: string, id: string): string | undefined
  /** The case capacity records of a cartridge, ordered by id. */
  capacities(cartridge: string): Catalogued<'caseCapacity'>[]
  /**
   * The SHA-256 of the whole data set (every record and the renames) as 64 hex digits: the same
   * records give the same value, any changed field changes it. Reads the record file on the first call.
   */
  dataHash(): Promise<string>
}
