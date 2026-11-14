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
  type TargetMapping,
} from '@rangefoundry/schema'
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
  type CatalogueIndex,
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
  return records
    .toSorted((a, b) => compareKeys(id(a), id(b)))
    .toSorted(compare)
    .map((r) => row(r))
}

const refId = (reference: string) => parseRef(reference)?.id ?? reference

/** The manufacturer `id` of a component, an error naming the component when there is none. */
function maker(manufacturers: Map<string, Manufacturer>, c: { id: string; manufacturer: string }) {
  const m = manufacturers.get(c.manufacturer)
  if (!m) throw new Error(`${c.id}: unknown manufacturer ${c.manufacturer}`)
  return m
}

/** What the mapping order reads of a mapping. */
const mappingKey = (disciplines: Map<string, Discipline>, m: TargetMapping) => ({
  id: m.id,
  face: m.face,
  discipline: disciplineKey(disciplineOf(disciplines, m)),
})

/** The index lists of the competition records, each in its default order. */
function competitionRows(
  source: CatalogueSource,
): Pick<
  CatalogueIndex,
  'targetFaces' | 'federations' | 'disciplines' | 'targetMappings' | 'caliberClasses'
> {
  const federations = new Map(source.federations.map((f) => [f.id, f]))
  const mappedFaces = new Map<string, Discipline[]>()
  const disciplines = new Map(source.disciplines.map((d) => [d.id, d]))
  for (const m of source.targetMappings) {
    const d = disciplineOf(disciplines, m)
    const face = m.face
    mappedFaces.set(face, [...(mappedFaces.get(face) ?? []), d])
  }
  return {
    targetFaces: ordered(
      source.targetFaces,
      (f) =>
        targetFaceRow(
          f,
          mappedFaces.get(f.id) ?? [],
          f.federation ? federations.get(f.federation) : undefined,
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
      (a, b) => compareMappings(mappingKey(disciplines, a), mappingKey(disciplines, b)),
      (m) => m.id,
    ),
    caliberClasses: ordered(
      source.caliberClasses,
      caliberClassRow,
      (a, b) => a.diameter.value - b.diameter.value,
      (c) => c.id,
    ),
  }
}

/** The record file: every record by id, a case and a capacity without `origin`. */
function recordFile(source: CatalogueSource): RecordFile {
  return {
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
  }
}

/**
 * The index and the record file of `source`, every list in its default order. Pure: the same
 * records give the same output in Node and in the browser. The record file holds the records
 * without `kind`, `origin` and `revision`.
 */
export function buildCatalogue(source: CatalogueSource): CatalogueData & { records: RecordFile } {
  const manufacturers = new Map(source.manufacturers.map((m) => [m.id, m]))
  const competition = competitionRows(source)
  const capacities = new Map<string, string[]>()
  for (const c of source.capacities.toSorted((a, b) => compareKeys(a.id, b.id))) {
    const cartridge = refId(c.cartridge)
    capacities.set(cartridge, [...(capacities.get(cartridge) ?? []), c.id])
  }

  return {
    index: {
      format: catalogueFormat,
      derive: deriveVersion,
      cartridges: byKey(source.cartridges.map(cartridgeRow)),
      manufacturers: byKey(source.manufacturers.map(manufacturerRow)),
      powders: byKey(source.powders.map((p) => powderRow(p, maker(manufacturers, p)))),
      primers: byKey(source.primers.map((p) => primerRow(p, maker(manufacturers, p)))),
      bullets: byKey(source.bullets.map((b) => bulletRow(b, maker(manufacturers, b)))),
      cases: byKey(
        source.cases.map((c) =>
          caseRow(
            c,
            maker(manufacturers, { id: c.id, manufacturer: refId(c.manufacturer) }),
            refId(c.cartridge),
          ),
        ),
      ),
      ...competition,
      eventTypes: byKey((source.eventTypes ?? []).map(eventTypeRow)),
      capacities: Object.fromEntries(capacities),
    },
    records: recordFile(source),
  }
}

/** The discipline a mapping names, an error where there is none. */
function disciplineOf(disciplines: Map<string, Discipline>, m: { id: string; discipline: string }) {
  const d = disciplines.get(m.discipline)
  if (!d) throw new Error(`${m.id}: unknown discipline ${m.discipline}`)
  return d
}
