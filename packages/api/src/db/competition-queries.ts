import {
  compareDisciplines,
  compareFederations,
  compareMappings,
  compareTargetFaces,
  type Discipline,
  type DisciplineKey,
} from '@open-reloading/schema'
import { and, asc, eq } from 'drizzle-orm'
import type { Db } from './index.ts'
import { compact, type ListPage, recordById } from './queries.ts'
import { disciplines, federations, targetFaces, targetMappings } from './schema.ts'

/** A target face of {@link listTargetFaces}, with the caliber classes and categories it is used for. */
interface TargetFaceSummary {
  id: string
  organization: string
  name: string
  caliberClasses: string[]
  categories: string[]
}

/**
 * Every target face, in the default order (`compareTargetFaces`, ties by id; a few records: no
 * paging), with the
 * caliber classes of the disciplines mapped to it and the categories of its events and those
 * disciplines.
 */
export async function listTargetFaces(db: Db): Promise<ListPage<TargetFaceSummary>> {
  const rows = await db
    .select({
      id: targetFaces.id,
      organization: targetFaces.organization,
      name: targetFaces.name,
      record: targetFaces.record,
    })
    .from(targetFaces)
    .orderBy(asc(targetFaces.organization), asc(targetFaces.name), asc(targetFaces.id))
  const mapped = await db
    .select({ face: targetMappings.faceId, record: disciplines.record })
    .from(targetMappings)
    .innerJoin(disciplines, eq(targetMappings.disciplineId, disciplines.id))
  const distinct = (values: (string | undefined)[]) =>
    [...new Set(values.filter((v) => v !== undefined))].sort()
  const items = rows.toSorted(compareTargetFaces).map(({ record, ...face }) => {
    const { events } = record
    const ds = mapped.filter((m) => m.face === face.id).map((m) => m.record)
    return {
      ...face,
      caliberClasses: distinct(ds.flatMap((d) => d.caliberClasses?.ids ?? [])),
      categories: distinct([...events, ...ds].map((e) => e.category)),
    }
  })
  return { total: items.length, items }
}

/** The whole target face record; undefined if unknown. */
export const getTargetFace = (db: Db, id: string) => recordById(db, targetFaces, id)

/** Every federation, in the default order (`compareFederations`, ties by id). */
export async function listFederations(db: Db) {
  const rows = await db
    .select({ record: federations.record })
    .from(federations)
    .orderBy(asc(federations.abbreviation), asc(federations.id))
  const items = rows
    .toSorted((a, b) => compareFederations(a.record, b.record))
    .map(({ record }) => {
      const { id, name, abbreviation, country, internationalFederation } = record
      return compact({ id, name, abbreviation, country, internationalFederation })
    })
  return { total: items.length, items }
}

/** The whole federation record; undefined if unknown. */
export const getFederation = (db: Db, id: string) => recordById(db, federations, id)

/** What the discipline order reads of a record. */
const disciplineKey = (d: Discipline): DisciplineKey => ({ ...d, distanceMm: d.distance.value })

/**
 * Disciplines, of one federation where `federation` is set, in the default order
 * (`compareDisciplines`, ties by name and id).
 */
export async function listDisciplines(db: Db, { federation }: { federation?: string }) {
  const rows = await db
    .select({ record: disciplines.record })
    .from(disciplines)
    .where(federation ? eq(disciplines.federationId, federation) : undefined)
    .orderBy(asc(disciplines.federationId), asc(disciplines.name), asc(disciplines.id))
  const items = rows
    .map(({ record }) => record)
    .toSorted((a, b) => compareDisciplines(disciplineKey(a), disciplineKey(b)))
    .map((d) =>
      compact({
        id: d.id,
        federation: d.federation,
        name: d.name,
        number: d.number,
        distanceMm: d.distance.value,
        category: d.category,
      }),
    )
  return { total: items.length, items }
}

/** The whole discipline record; undefined if unknown. */
export const getDiscipline = (db: Db, id: string) => recordById(db, disciplines, id)

/**
 * Target mappings, filtered by discipline and face where set, in the order of their disciplines
 * (`compareMappings`), then by face and id.
 */
export async function listTargetMappings(db: Db, params: { discipline?: string; face?: string }) {
  const rows = await db
    .select({ record: targetMappings.record, discipline: disciplines.record })
    .from(targetMappings)
    .innerJoin(disciplines, eq(targetMappings.disciplineId, disciplines.id))
    .where(
      and(
        params.discipline ? eq(targetMappings.disciplineId, params.discipline) : undefined,
        params.face ? eq(targetMappings.faceId, params.face) : undefined,
      ),
    )
    .orderBy(asc(targetMappings.disciplineId), asc(targetMappings.faceId), asc(targetMappings.id))
  const sorted = rows.map(({ record, discipline }) => ({
    record,
    key: { id: record.id, face: record.face, discipline: disciplineKey(discipline) },
  }))
  const items = sorted
    .sort((a, b) => compareMappings(a.key, b.key))
    .map(({ record }) => {
      const { id, discipline, face, event, stage, gauge } = record
      return compact({ id, discipline, face, event, stage, gaugeMm: gauge?.value })
    })
  return { total: items.length, items }
}

/** The whole target mapping record; undefined if unknown. */
export const getTargetMapping = (db: Db, id: string) => recordById(db, targetMappings, id)
