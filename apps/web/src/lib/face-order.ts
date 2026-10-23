/**
 * The order of the target face picker's lists and of the list pages. The comparators live in
 * `@openreloading/schema` (`competition-order.ts`), which the API sorts its lists with too.
 */
import type { TargetFace } from '@openreloading/schema'
import type { DisciplineSummary, FederationSummary, MappingSummary } from './face-disciplines.ts'

export {
  compareDisciplines,
  compareEvents,
  compareFederations,
  compareNames,
  compareTargetFaces,
} from '@openreloading/schema'

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
