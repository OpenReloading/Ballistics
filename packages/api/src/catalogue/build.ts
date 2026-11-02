import {
  compareDisciplines,
  compareFederations,
  compareKeys,
  compareMappings,
  compareTargetFaces,
  type Discipline,
  type DisciplineKey,
  type Manufacturer,
  parseRef,
  type RenameKind,
} from '@open-reloading/schema'
import {
  bulletRow,
  byKey,
  caliberClassRow,
  cartridgeRow,
  caseRow,
  disciplineRow,
  eventTypeRow,
  federationRow,
  manufacturerRow,
  powderRow,
  primerRow,
  targetFaceRow,
  targetMappingRow,
} from './derive.ts'
import {
  type CatalogueData,
  type CatalogueSource,
  catalogueFormat,
  deriveVersion,
  type IndexRow,
  type RecordFile,
} from './types.ts'

const byId = <T extends { id: string }>(list: readonly T[]) =>
  Object.fromEntries(list.map((r) => [r.id, r]))

/** What the discipline order reads of a record. */
const disciplineKey = (d: Discipline): DisciplineKey => ({ ...d, distanceMm: d.distance.value })

/** Rows ordered by `compare` of their records, ties by id. */
function ordered<T extends { id: string }, R>(
  records: readonly R[],
  row: (record: R) => IndexRow<T>,
  compare: (a: R, b: R) => number,
  id: (record: R) => string,
) {
  const rows = new Map(records.map((r) => [r, row(r)]))
  return records
    .toSorted((a, b) => compareKeys(id(a), id(b)))
    .sort(compare)
    .map((r) => rows.get(r) as IndexRow<T>)
}

const refId = (reference: string) => parseRef(reference)?.id ?? reference

/** The manufacturer `id` of a component, an error naming the component when there is none. */
function maker(
  manufacturers: Map<string, Manufacturer>,
  c: { id: string; manufacturer: string },
  now: (kind: RenameKind, id: string) => string,
) {
  const m = manufacturers.get(now('manufacturers', c.manufacturer))
  if (!m) throw new Error(`${c.id}: unknown manufacturer ${c.manufacturer}`)
  return m
}

/**
 * The index and the record file of `source`, every list in its default order. Pure: the same
 * records give the same output in Node and in the browser. The record file holds the records as
 * they are, without `kind`, `origin` and `revision`.
 */
export function buildCatalogue(source: CatalogueSource): CatalogueData & { records: RecordFile } {
  const manufacturers = new Map(source.manufacturers.map((m) => [m.id, m]))
  const federations = new Map(source.federations.map((f) => [f.id, f]))
  const renames = source.renames ?? {}
  // a reference to an old id joins the record that replaced it
  const now = (kind: RenameKind, id: string) => renames[kind]?.[id] ?? id
  const mappedFaces = new Map<string, Discipline[]>()
  const disciplines = new Map(source.disciplines.map((d) => [d.id, d]))
  for (const m of source.targetMappings) {
    const d = disciplineOf(disciplines, m, now)
    const face = now('target-faces', m.face)
    mappedFaces.set(face, [...(mappedFaces.get(face) ?? []), d])
  }
  const capacities = new Map<string, string[]>()
  for (const c of source.capacities.toSorted((a, b) => compareKeys(a.id, b.id))) {
    const cartridge = now('cartridges', refId(c.cartridge))
    capacities.set(cartridge, [...(capacities.get(cartridge) ?? []), c.id])
  }

  return {
    index: {
      format: catalogueFormat,
      derive: deriveVersion,
      cartridges: byKey(source.cartridges.map(cartridgeRow)),
      manufacturers: byKey(source.manufacturers.map(manufacturerRow)),
      powders: byKey(source.powders.map((p) => powderRow(p, maker(manufacturers, p, now)))),
      primers: byKey(source.primers.map((p) => primerRow(p, maker(manufacturers, p, now)))),
      bullets: byKey(source.bullets.map((b) => bulletRow(b, maker(manufacturers, b, now)))),
      cases: byKey(
        source.cases.map((c) =>
          caseRow(
            c,
            maker(manufacturers, { id: c.id, manufacturer: refId(c.manufacturer) }, now),
            now('cartridges', refId(c.cartridge)),
          ),
        ),
      ),
      targetFaces: ordered(
        source.targetFaces,
        (f) =>
          targetFaceRow(
            f,
            mappedFaces.get(f.id) ?? [],
            f.federation ? federations.get(now('federations', f.federation)) : undefined,
          ),
        compareTargetFaces,
        (f) => f.id,
      ),
      federations: ordered(source.federations, federationRow, compareFederations, (f) => f.id),
      disciplines: ordered(
        source.disciplines,
        disciplineRow,
        (a, b) => compareDisciplines(disciplineKey(a), disciplineKey(b)),
        (d) => d.id,
      ),
      targetMappings: ordered(
        source.targetMappings,
        targetMappingRow,
        (a, b) =>
          compareMappings(
            {
              id: a.id,
              face: a.face,
              discipline: disciplineKey(disciplineOf(disciplines, a, now)),
            },
            {
              id: b.id,
              face: b.face,
              discipline: disciplineKey(disciplineOf(disciplines, b, now)),
            },
          ),
        (m) => m.id,
      ),
      caliberClasses: ordered(
        source.caliberClasses,
        caliberClassRow,
        (a, b) => a.diameter.value - b.diameter.value,
        (c) => c.id,
      ),
      eventTypes: byKey((source.eventTypes ?? []).map(eventTypeRow)),
      capacities: Object.fromEntries(capacities),
      renames,
    },
    records: {
      format: catalogueFormat,
      derive: deriveVersion,
      cartridge: byId(source.cartridges),
      manufacturer: byId(source.manufacturers),
      powder: byId(source.powders),
      primer: byId(source.primers),
      bullet: byId(source.bullets),
      case: byId(source.cases.map(({ origin, ...rest }) => rest)),
      caseCapacity: byId(source.capacities.map(({ origin, ...rest }) => rest)),
      targetFace: byId(source.targetFaces),
      federation: byId(source.federations),
      discipline: byId(source.disciplines),
      targetMapping: byId(source.targetMappings),
      caliberClass: byId(source.caliberClasses),
      eventType: byId(source.eventTypes ?? []),
    },
  }
}

/** The discipline a mapping names, an error where there is none. */
function disciplineOf(
  disciplines: Map<string, Discipline>,
  m: { id: string; discipline: string },
  now: (kind: RenameKind, id: string) => string,
) {
  const d = disciplines.get(now('disciplines', m.discipline))
  if (!d) throw new Error(`${m.id}: unknown discipline ${m.discipline}`)
  return d
}
