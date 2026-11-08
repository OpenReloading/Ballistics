/** The face a user's design builds for the tools: its id, organization and the face schema's checks. */
import { type TargetFace, type TargetFaceDesign, targetFace } from '@open-reloading/schema'

/** The owner of a built face: it names the face as the user's own in the tools' lists. */
export const userOrganization = 'User design'

/** The prefix of the id a design's face has in the tools. */
export const faceIdPrefix = 'user-'

/** The id of the face a record builds: `user-` and the record id, a UUID, which the face schema takes as it is. */
export const userFaceId = (recordId: string) => `${faceIdPrefix}${recordId}`

/** `event` where the name gives nothing, a number after a repeat, so every id is unique. */
function eventIds(names: readonly string[]) {
  const used = new Set<string>()
  return names.map((name) => {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'event'
    let id = base
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`
    used.add(id)
    return id
  })
}

/** The face the data builds, or why it is none, as issues of the face schema by path. */
export function buildFace(
  data: TargetFaceDesign,
  id: string,
  name: string,
): { face: TargetFace } | { issues: { path: PropertyKey[]; message: string }[] } {
  const ids = eventIds(data.events.map((e) => e.name))
  const mm = (value: number | undefined) => (value === undefined ? undefined : { value })
  const candidate = {
    id,
    name,
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
    events: data.events.map((e, i) => ({
      id: ids[i],
      name: e.name,
      distance: mm(e.distance),
      gauge: mm(e.gauge),
    })),
    // a design is not a catalogue face: the photo face search skips it, the user picks it
    photoSearch: false,
    provenance: { kind: 'measured', sources: [{ title: 'Entered in the target designer' }] },
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
