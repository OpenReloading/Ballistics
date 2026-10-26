/** A face record with the abbreviation of its federation, as the lists and labels show and compare it. */
import type { Federation, TargetFace } from '@open-reloading/schema'
import { userOrganization } from './user-faces.ts'

/** A face event with the abbreviation of the federation whose rule book lists it, where that is not its face's. */
export type FaceEvent = TargetFace['events'][number] & { organization?: string | undefined }

/** A target face record and its federation's abbreviation (`User design` for a face without a federation). */
export type Face = Omit<TargetFace, 'events'> & { organization: string; events: FaceEvent[] }

/** `face` with the abbreviations of its federations; an id no federation answers is shown as is. */
export function withOrganization(
  face: TargetFace,
  federations: readonly Pick<Federation, 'id' | 'abbreviation'>[],
): Face {
  const abbreviation = (id: string) => federations.find((f) => f.id === id)?.abbreviation ?? id
  return {
    ...face,
    organization: face.federation ? abbreviation(face.federation) : userOrganization,
    events: face.events.map((e) => ({
      ...e,
      ...(e.federation && { organization: abbreviation(e.federation) }),
    })),
  }
}
