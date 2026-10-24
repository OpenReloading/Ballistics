/** The face a user's design builds for the tools: its id, organization and the face schema's checks. */
import {
  recordIdRegex,
  type TargetFace,
  type TargetFaceDesign,
  targetFace,
} from '@openreloading/schema'

/** The owner of a built face: it names the face as the user's own in the tools' lists. */
export const userOrganization = 'User design'

/** The prefix of the id a design's face has in the tools. */
export const faceIdPrefix = 'user-'

/** A 32-bit FNV-1a hash of `text` in base 36. */
const hash = (text: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(36)
}

/**
 * The id of the face a record builds: `user-` and the record id. An id that is no record id (a
 * record id may hold any character) is cut to lowercase letters and digits in groups joined by
 * hyphens, as the face schema requires, and gets a hash of the whole id so that `a_b` and `a-b`
 * keep two faces.
 */
export const userFaceId = (recordId: string) =>
  recordIdRegex.test(recordId)
    ? `${faceIdPrefix}${recordId}`
    : `${faceIdPrefix}${
        recordId
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'design'
      }-${hash(recordId)}`

/** The face the data builds, or why it is none, as issues of the face schema by path. */
export function buildFace(
  data: TargetFaceDesign,
  id: string,
  name: string,
): { face: TargetFace } | { issues: { path: PropertyKey[]; message: string }[] } {
  const mm = (value: number | undefined) => (value === undefined ? undefined : { value })
  const candidate = {
    id,
    name,
    organization: userOrganization,
    rings: data.rings.map((r) => ({
      value: r.value,
      diameter: mm(r.diameter),
      height: mm(r.height),
      fill: r.fill,
      line: r.line,
    })),
    innerTen: data.innerTen && {
      diameter: mm(data.innerTen.diameter),
      height: mm(data.innerTen.height),
      rule: data.innerTen.rule,
    },
    blackDiameter: mm(data.blackDiameter),
    blackHeight: mm(data.blackHeight),
    decimal: data.decimal,
    events: data.events.map((e) => ({
      name: e.name,
      distance: mm(e.distance),
      gauge: mm(e.gauge),
    })),
    // a design is not a catalogue face: the photo face search skips it, the user picks it
    photoSearch: false,
    provenance: { kind: 'measured', sources: [{ title: 'Entered in the face designer' }] },
  }
  const r = targetFace.safeParse(candidate)
  if (r.success) return { face: r.data }
  const at = (path: PropertyKey[]) =>
    path.reduce<unknown>((o, k) => (o as Record<PropertyKey, unknown> | undefined)?.[k], candidate)
  return {
    issues: r.error.issues.map((i) => ({
      path: i.path,
      message:
        at(i.path) === undefined || at(i.path) === ''
          ? 'Required.'
          : i.code === 'too_small' && Array.isArray(at(i.path))
            ? `at least ${i.minimum} needed.`
            : i.message,
    })),
  }
}
