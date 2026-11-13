import type {
  BulletItem,
  CaliberClassItem,
  CartridgeItem,
  CaseItem,
  CatalogueKind,
  DisciplineItem,
  EventTypeItem,
  FederationItem,
  ManufacturerItem,
  PowderItem,
  PrimerItem,
  RecordOfKind,
  TargetFaceItem,
  TargetMappingItem,
} from '@open-reloading/catalog'
import type {
  Bullet,
  CaliberClass,
  Cartridge,
  CatalogueCase,
  CatalogueCaseCapacity,
  Discipline,
  EventType,
  Federation,
  Manufacturer,
  Powder,
  Primer,
  TargetFace,
  TargetMapping,
} from '@rangefoundry/schema'

// the Catalogue interface and its types belong to the catalog package; this entry passes them on with openCatalogue
export type {
  BulletItem,
  BulletQuery,
  CaliberClassItem,
  CartridgeItem,
  CartridgeQuery,
  CaseItem,
  CaseQuery,
  Catalogue,
  Catalogued,
  CatalogueKind,
  CataloguePage,
  DisciplineItem,
  EventTypeItem,
  FederationItem,
  ManufacturerItem,
  Paging,
  PowderInteriorItem,
  PowderItem,
  PowderQuery,
  PrimerItem,
  PrimerQuery,
  RecordOfKind,
  TargetFaceItem,
  TargetMappingItem,
} from '@open-reloading/catalog'

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
}

/** The record file: the header and every record by id, one map per kind. */
export type RecordFile = CatalogueHeader & {
  [K in CatalogueKind]: Record<string, RecordOfKind[K]>
}

/** The records a catalogue is built from; `Bundle` of `@open-reloading/catalog` has them. */
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
}

/** What `openCatalogue` opens: the index and the record file, or a function that reads it on first `get`. */
export interface CatalogueData {
  index: CatalogueIndex
  /** The record file, or a function that reads it. */
  records: RecordFile | (() => RecordFile)
}
