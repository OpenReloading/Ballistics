/** The outer ring's square gives perspective and scale in one; pure, no React, DOM or Next.js. */
import { type ShotGroup, type TargetFace, type TargetSheet, toSi } from '@open-reloading/schema'
import type { FaceGeometry, FacePlane } from '@rangefoundry/target-recognition'
import { english } from '../i18n/translate.ts'
import { type FederationData, mappingOf } from './face-disciplines.ts'
import { nth } from './nth.ts'
import { faceAlignment } from './ring-scoring.ts'
import { type Matrix, mul3, type Point } from './target-geometry.ts'

export type FoundFace = Pick<FacePlane, 'centre' | 'corners' | 'outer'> & {
  /** Id of the face record; absent for a plane from a typed diameter. */
  id?: string | undefined
  /** Id of the event the user chose; absent: the group's discipline, else an event at the group's distance. */
  event?: string
  /** Id of the federation that publishes the face. */
  federation?: string | undefined
  /** The events of the face with their distances, m, and the federation of an event of another one. */
  events?:
    | ReadonlyArray<{ id: string; distance: number; federation?: string | undefined }>
    | undefined
}

/** The federation the user chose for the Discipline list, and the federations' disciplines and mappings. */
export type FaceScope = { federation?: string | undefined; data?: FederationData | undefined }

/** `sheet` calibrated on `found`; the active group `groupId` takes the face for ring scoring. */
export function calibrateSheetOnFace(
  sheet: TargetSheet,
  groupId: string | undefined,
  found: FoundFace,
  scope: FaceScope = {},
): TargetSheet {
  return {
    ...sheet,
    references: [faceReference(found)],
    targetRotation: 0,
    targetOrigin: { x: found.centre.x, y: found.centre.y },
    groups: sheet.groups.map((g) => (g.id === groupId ? groupFaceChoice(g, found, scope) : g)),
  }
}

/** The square about the outer ring as the rectangle reference, its side in m. */
function faceReference(found: FoundFace): TargetSheet['references'][number] {
  const size = toSi('length', 2 * found.outer)
  const [a, b, c, d] = found.corners
  const corner = (p: Point) => ({ x: p.x, y: p.y })
  return {
    kind: 'rectangle',
    corners: [corner(a), corner(b), corner(c), corner(d)],
    width: size,
    height: size,
  }
}

/** The same face keeps its event and marks; another starts afresh with the user's event, the discipline or `eventAt`. */
function groupFaceChoice(g: ShotGroup, found: FoundFace, scope: FaceScope): ShotGroup {
  if (found.id === undefined) return g
  if (g.face?.id === found.id && !found.event) return g
  const mappings = scope.data?.mappings ?? []
  const discipline = mappingOf(mappings, g.face)?.discipline
  const kept = mappings.find((m) => m.discipline === discipline && m.face === found.id)?.event
  const event = found.event ?? kept ?? eventAt(g.distance, found, scope)
  const marks = g.face?.id === found.id ? g.face.marks : undefined
  return { ...g, face: { id: found.id, ...(event && { event }), ...(marks && { marks }) } }
}

/** `distance` in m; undefined when no federation shoots it there or several others do: no federation is guessed. */
function eventAt(distance: number, found: FoundFace, { federation }: FaceScope) {
  const near = (found.events ?? []).filter((e) => Math.abs(e.distance - distance) < 0.5)
  const of = (e: (typeof near)[number]) => e.federation ?? found.federation
  if (federation) return near.find((e) => of(e) === federation)?.id
  const own = near.find((e) => !e.federation)
  if (own) return own.id
  return new Set(near.map(of)).size === 1 ? nth(near, 0).id : undefined
}

/** Photo px to face mm, x right and y up from the face center, only where the face lies on the sheet as known; a face on a sheet calibrated otherwise is centered on an origin that may be anywhere. */
export function faceGeometry(o: {
  sheet: TargetSheet
  group: ShotGroup | undefined
  record: TargetFace | undefined
  /** Photo px to target m of the sheet's calibration. */
  toTarget: Matrix | undefined
}): FaceGeometry | undefined {
  const { sheet, group, record, toTarget } = o
  const choice = group?.face
  if (!toTarget || !group || !choice || !record || record.id !== choice.id) return undefined
  const outer = nth(record.rings, 0).diameter.value / 2
  const size = toSi('length', 2 * outer)
  const onFace = sheet.references.some(
    (r) =>
      r.kind === 'rectangle' && Math.abs(r.width - size) < 1e-9 && Math.abs(r.height - size) < 1e-9,
  )
  if (!choice.marks && !onFace && !group.aim) return undefined
  try {
    const a = faceAlignment(
      record,
      choice.marks,
      choice.marks || !onFace ? group.aim : undefined,
      english.t,
    )
    const k = 1 / toSi('length', a.scale)
    return {
      toFace: mul3([k, 0, -k * a.centre.x, 0, k, -k * a.centre.y, 0, 0, 1], toTarget),
      outer,
      black: record.blackDiameter.value / 2,
      rings: record.rings.map((r) => r.diameter.value / 2),
    }
  } catch {
    return undefined
  }
}
