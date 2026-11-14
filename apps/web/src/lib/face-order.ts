/** The comparators live in `@rangefoundry/schema`, which the API sorts with too. */
import type { TargetFace } from '@rangefoundry/schema'
import type { DisciplineSummary, FederationSummary, MappingSummary } from './face-disciplines.ts'

export {
  compareDisciplines,
  compareEvents,
  compareFederations,
  compareNames,
  compareTargetFaces,
} from '@rangefoundry/schema'

/** The faces its disciplines map to and the faces it publishes. */
export function federationFaceIds(
  faces: readonly Pick<TargetFace, 'id' | 'federation'>[],
  data: {
    federations: FederationSummary[]
    disciplines: DisciplineSummary[]
    mappings: MappingSummary[]
  },
  federation: string,
): Set<string> {
  const disciplines = new Set(
    data.disciplines.filter((d) => d.federation === federation).map((d) => d.id),
  )
  return new Set([
    ...data.mappings.filter((m) => disciplines.has(m.discipline)).map((m) => m.face),
    ...faces.filter((f) => f.federation === federation).map((f) => f.id),
  ])
}

/** The federations with at least one discipline: one without leaves the Discipline list empty. */
export function federationsWithDisciplines(data: {
  federations: FederationSummary[]
  disciplines: DisciplineSummary[]
}): FederationSummary[] {
  return data.federations.filter((f) => data.disciplines.some((d) => d.federation === f.id))
}
