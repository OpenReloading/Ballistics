/**
 * Caliber candidates of the photo flow (`apps/docs/docs/models/hole-detection.md`, "Caliber
 * candidates"): the caliber classes of the group's discipline, ordered by the hole size and the
 * user's own firearms and loads, read through the API and the browser store.
 */
import {
  type CaliberClass,
  type Discipline,
  type GroupFace,
  parseRef,
  toSi,
} from '@open-reloading/schema'
import { apiFetch, fetchRecord } from './api-fetch.ts'
import { mappingOf } from './face-disciplines.ts'
import { fetchFederationData } from './face-records.ts'
import { storedRecords } from './user-store.ts'

/** A caliber class: nominal bullet diameter in m, the ids of its member cartridge records. */
export type CandidateClass = {
  id: string
  name: string
  diameter: number
  cartridges: readonly string[]
}

/** Classes whose nominal diameters differ by less than this share a hole size, m. */
const HOLE_SIZE_RESOLUTION = toSi('length', 0.5)
/** A hole fits a class within this share of its diameter: the detector's band (`SIZE_MIN`, `SIZE_MAX`). */
const HOLE_BAND = [0.7, 1.4] as const

/**
 * `classes` as candidates for the hole size `hole`. A nominal size (bullet, marker): the classes
 * sharing the nearest class's hole size first, then by distance to it; the nearest is preselected
 * when no other shares its hole size. A typed, learned or measured size (a hole in paper shows
 * smaller than its bullet): the classes it fits within `HOLE_BAND` first, then by its ratio to
 * their diameter, none preselected. The user's classes (a member in `mine`, cartridge record ids)
 * come first among equals.
 */
export function caliberCandidates(
  classes: readonly CandidateClass[],
  hole: { diameter: number; source: string } | undefined,
  mine: ReadonlySet<string>,
): { candidates: CandidateClass[]; preselected: string | undefined } {
  const own = (c: CandidateClass) => (c.cartridges.some((id) => mine.has(id)) ? 0 : 1)
  if (!hole || !classes.length)
    return { candidates: classes.toSorted((a, b) => own(a) - own(b)), preselected: undefined }
  const d = hole.diameter
  if (hole.source !== 'bullet' && hole.source !== 'marker') {
    const fits = (c: CandidateClass) =>
      d >= HOLE_BAND[0] * c.diameter && d <= HOLE_BAND[1] * c.diameter ? 0 : 1
    return {
      candidates: classes.toSorted(
        (a, b) =>
          fits(a) - fits(b) ||
          own(a) - own(b) ||
          Math.abs(d / a.diameter - 1) - Math.abs(d / b.diameter - 1),
      ),
      preselected: undefined,
    }
  }
  const off = (c: CandidateClass) => Math.abs(c.diameter - d)
  const nearest = classes.reduce((a, b) => (off(b) < off(a) ? b : a))
  const tied = (c: CandidateClass) =>
    Math.abs(c.diameter - nearest.diameter) < HOLE_SIZE_RESOLUTION ? 0 : 1
  const candidates = classes.toSorted(
    (a, b) => tied(a) - tied(b) || (tied(a) ? 0 : own(a) - own(b)) || off(a) - off(b),
  )
  const preselected = classes.filter((c) => !tied(c)).length === 1 ? nearest.id : undefined
  return { candidates, preselected }
}

/**
 * The caliber classes of the discipline that the group's face event scores, else of every
 * discipline mapped to its face (the face list's `caliberClasses`).
 */
export async function caliberClassesOf(face: Pick<GroupFace, 'id' | 'event'>) {
  const { mappings } = await fetchFederationData()
  const discipline = mappingOf(mappings, face)?.discipline
  const ids = discipline
    ? ((await fetchRecord<Discipline>('disciplines', discipline))?.caliberClasses?.ids ?? [])
    : ((await faceClasses()).find((f) => f.id === face.id)?.caliberClasses ?? [])
  const classes = await Promise.all(
    ids.map((id) => fetchRecord<CaliberClass>('caliber-classes', id)),
  )
  return classes.flatMap((c): CandidateClass[] =>
    c
      ? [
          {
            id: c.id,
            name: c.name,
            diameter: toSi('length', c.diameter.value),
            cartridges: c.cartridges,
          },
        ]
      : [],
  )
}

async function faceClasses() {
  const res = await apiFetch('target-faces')
  if (!res.ok) throw new Error(`The API answered ${res.status}.`)
  return ((await res.json()) as { items: { id: string; caliberClasses: string[] }[] }).items
}

/** The catalogue cartridge ids of the firearms and loads of this browser; none where the store cannot be read. */
export async function ownCartridges(): Promise<Set<string>> {
  const { records } = await storedRecords().catch(() => ({ records: [] }))
  return new Set(
    records.flatMap((r) => {
      const cartridge = r.kind === 'firearm' || r.kind === 'load' ? r.data.cartridge : undefined
      const ref = cartridge ? parseRef(cartridge) : undefined
      return ref?.scope === 'catalogue' ? [ref.id] : []
    }),
  )
}
