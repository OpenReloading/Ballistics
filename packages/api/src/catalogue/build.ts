import {
  compareDisciplines,
  compareFederations,
  compareKeys,
  compareMappings,
  compareTargetFaces,
  type Discipline,
  type DisciplineKey,
  type Manufacturer,
} from '@openreloading/schema'
import {
  bulletRow,
  byKey,
  cartridgeRow,
  disciplineRow,
  federationRow,
  manufacturerRow,
  powderRow,
  targetFaceRow,
  targetMappingRow,
} from './derive.ts'
import {
  type CatalogueData,
  type CatalogueSource,
  catalogueFormat,
  type IndexRow,
  type RecordFile,
} from './types.ts'

/** The records of `list` by id. */
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

/** The manufacturer `id` of a component, an error naming the component when there is none. */
function maker(manufacturers: Map<string, Manufacturer>, c: { id: string; manufacturer: string }) {
  const m = manufacturers.get(c.manufacturer)
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
  const mappedFaces = new Map<string, Discipline[]>()
  const disciplines = new Map(source.disciplines.map((d) => [d.id, d]))
  for (const m of source.targetMappings) {
    const d = disciplines.get(m.discipline)
    if (d) mappedFaces.set(m.face, [...(mappedFaces.get(m.face) ?? []), d])
  }
  const capacities: Record<string, string[]> = {}
  for (const c of source.capacities.toSorted((a, b) => compareKeys(a.id, b.id)))
    capacities[c.cartridge] = [...(capacities[c.cartridge] ?? []), c.id]

  return {
    index: {
      format: catalogueFormat,
      cartridges: byKey(source.cartridges.map(cartridgeRow)),
      manufacturers: byKey(source.manufacturers.map(manufacturerRow)),
      powders: byKey(source.powders.map((p) => powderRow(p, maker(manufacturers, p)))),
      bullets: byKey(source.bullets.map((b) => bulletRow(b, maker(manufacturers, b)))),
      targetFaces: ordered(
        source.targetFaces,
        (f) => targetFaceRow(f, mappedFaces.get(f.id) ?? []),
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
            { id: a.id, face: a.face, discipline: disciplineKey(disciplineOf(disciplines, a)) },
            { id: b.id, face: b.face, discipline: disciplineKey(disciplineOf(disciplines, b)) },
          ),
        (m) => m.id,
      ),
      capacities,
    },
    records: {
      cartridge: byId(source.cartridges),
      manufacturer: byId(source.manufacturers),
      powder: byId(source.powders),
      bullet: byId(source.bullets),
      caseCapacity: byId(source.capacities),
      targetFace: byId(source.targetFaces),
      federation: byId(source.federations),
      discipline: byId(source.disciplines),
      targetMapping: byId(source.targetMappings),
    },
  }
}

/** The discipline a mapping names, an error where there is none. */
function disciplineOf(disciplines: Map<string, Discipline>, m: { id: string; discipline: string }) {
  const d = disciplines.get(m.discipline)
  if (!d) throw new Error(`${m.id}: unknown discipline ${m.discipline}`)
  return d
}
