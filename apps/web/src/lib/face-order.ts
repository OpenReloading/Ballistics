/**
 * The order of the target face picker's lists and of the list pages: names alphabetical with
 * numbers in numeric order (25 before 100), events by distance ascending, then name.
 */
import type { TargetFace } from '@openreloading/schema'
import type { DisciplineSummary, FederationSummary, MappingSummary } from './face-disciplines.ts'

const collator = new Intl.Collator('en', { numeric: true })

/** Names alphabetical, numbers numeric. */
export const compareNames = (a: string, b: string) => collator.compare(a, b)

/** Events by distance ascending (m), then name. */
export const compareEvents = (
  a: { distance: number; name: string },
  b: { distance: number; name: string },
) => a.distance - b.distance || compareNames(a.name, b.name)

/** Disciplines by number, then name. */
export const compareDisciplines = (
  a: Pick<DisciplineSummary, 'number' | 'name'>,
  b: Pick<DisciplineSummary, 'number' | 'name'>,
) => compareNames(a.number ?? '', b.number ?? '') || compareNames(a.name, b.name)

/** Federations by abbreviation. */
export const compareFederations = (
  a: Pick<FederationSummary, 'abbreviation'>,
  b: Pick<FederationSummary, 'abbreviation'>,
) => compareNames(a.abbreviation, b.abbreviation)

/**
 * The ids of the faces of one federation: the faces its disciplines map to and the faces its
 * abbreviation publishes.
 */
export function federationFaceIds(
  faces: readonly Pick<TargetFace, 'id' | 'organization'>[],
  data: {
    federations: FederationSummary[]
    disciplines: DisciplineSummary[]
    mappings: MappingSummary[]
  },
  federation: string,
): Set<string> {
  const abbreviation = data.federations.find((f) => f.id === federation)?.abbreviation
  const disciplines = new Set(
    data.disciplines.filter((d) => d.federation === federation).map((d) => d.id),
  )
  return new Set([
    ...data.mappings.filter((m) => disciplines.has(m.discipline)).map((m) => m.face),
    ...faces.filter((f) => f.organization === abbreviation).map((f) => f.id),
  ])
}
