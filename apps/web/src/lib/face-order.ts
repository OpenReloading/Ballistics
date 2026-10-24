/**
 * The order of the target face picker's lists and of the list pages. The comparators live in
 * `@open-reloading/schema` (`competition-order.ts`), which the API sorts its lists with too.
 */
import type { TargetFace } from '@open-reloading/schema'
import type { DisciplineSummary, FederationSummary, MappingSummary } from './face-disciplines.ts'

export {
  compareDisciplines,
  compareEvents,
  compareFederations,
  compareNames,
  compareTargetFaces,
} from '@open-reloading/schema'

/**
 * The ids of the faces of one federation: the faces its disciplines map to and the faces it
 * publishes.
 */
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
