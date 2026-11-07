import type { Discipline, Federation, TargetFace } from '@open-reloading/schema'
import type { Bundle } from './records.ts'

/** The federations, disciplines and faces by id. */
export type Lookup = {
  federations: Map<string, Federation>
  disciplines: Map<string, Discipline>
  faces: Map<string, TargetFace>
  worldBody: (id: string) => boolean
}

/** The lookup of a bundle, shared by the federation and event type checks. */
export function lookupOf(
  bundle: Pick<Bundle, 'federations' | 'disciplines'> & Partial<Pick<Bundle, 'targetFaces'>>,
): Lookup {
  const federations = new Map(bundle.federations.map((f) => [f.id, f]))
  return {
    federations,
    disciplines: new Map(bundle.disciplines.map((d) => [d.id, d])),
    faces: new Map((bundle.targetFaces ?? []).map((f) => [f.id, f])),
    worldBody: (id) => federations.get(id)?.country === 'international',
  }
}

/** A federation's international federation is a world body. */
function checkFederationReferences(federations: Federation[], lookup: Lookup, errors: string[]) {
  for (const f of federations) {
    const where = `federations/${f.id}.json`
    if (f.internationalFederation && !lookup.worldBody(f.internationalFederation))
      errors.push(
        `${where}: internationalFederation "${f.internationalFederation}" is no international federation`,
      )
  }
}

/** A discipline's federation exists, and its international equivalent belongs to a world body. */
function checkDisciplineReferences(disciplines: Discipline[], lookup: Lookup, errors: string[]) {
  for (const d of disciplines) {
    const where = `disciplines/${d.id}.json`
    if (!lookup.federations.has(d.federation))
      errors.push(`${where}: unknown federation "${d.federation}"`)
    if (d.internationalDiscipline) {
      const other = lookup.disciplines.get(d.internationalDiscipline)
      if (!other)
        errors.push(`${where}: unknown international discipline "${d.internationalDiscipline}"`)
      else if (!lookup.worldBody(other.federation))
        errors.push(
          `${where}: internationalDiscipline "${d.internationalDiscipline}" is no international discipline`,
        )
    }
  }
}

/** A face and each of its events that names a federation name a federation record. */
function checkFaceFederations(faces: TargetFace[], lookup: Lookup, errors: string[]) {
  for (const f of faces) {
    const where = `target-faces/${f.id}.json`
    if (!f.federation) errors.push(`${where}: needs a federation`)
    else if (!lookup.federations.has(f.federation))
      errors.push(`${where}: unknown federation "${f.federation}"`)
    for (const e of f.events)
      if (e.federation && !lookup.federations.has(e.federation))
        errors.push(`${where}: event "${e.id}": unknown federation "${e.federation}"`)
  }
}

type Mapping = Bundle['targetMappings'][number]

/** The face event a mapping names, the face and the mapping's discipline record, if any. */
type MappedEvent = {
  face: TargetFace
  event: TargetFace['events'][number]
  d: Discipline | undefined
}

/**
 * A mapped face event has at most one mapping (`mapped`: face event to mapping id), is listed by the
 * discipline's federation and has the mapping's gauge.
 */
function checkMappedEvent(
  m: Mapping,
  { face, event, d }: MappedEvent,
  mapped: Map<string, string>,
): string[] {
  const where = `target-mappings/${m.id}.json`
  const errors: string[] = []
  const key = `${face.id} ${m.event}`
  if (mapped.has(key)) errors.push(`${where}: event "${m.event}" is also in ${mapped.get(key)}`)
  else mapped.set(key, m.id)
  const listedBy = event.federation ?? face.federation
  if (d && listedBy && listedBy !== d.federation)
    errors.push(`${where}: event "${m.event}" is not one of federation "${d.federation}"`)
  if (m.gauge && event.gauge && m.gauge.value !== event.gauge.value)
    errors.push(
      `${where}: gauge ${m.gauge.value} mm differs from the event's ${event.gauge.value} mm`,
    )
  return errors
}

/** A mapping names a known discipline and an event of a known face (see {@link checkMappedEvent}). */
function checkMapping(m: Mapping, lookup: Lookup, mapped: Map<string, string>): string[] {
  const where = `target-mappings/${m.id}.json`
  const d = lookup.disciplines.get(m.discipline)
  const face = lookup.faces.get(m.face)
  const errors = d ? [] : [`${where}: unknown discipline "${m.discipline}"`]
  if (!face) return [...errors, `${where}: unknown face "${m.face}"`]
  const event = face.events.find((e) => e.id === m.event)
  if (!event) return [...errors, `${where}: face "${m.face}" has no event "${m.event}"`]
  return [...errors, ...checkMappedEvent(m, { face, event, d }, mapped)]
}

/** Every mapping is checked, and every face event has at most one mapping. */
function checkMappings(mappings: Bundle['targetMappings'], lookup: Lookup, errors: string[]) {
  const mapped = new Map<string, string>()
  for (const m of mappings) errors.push(...checkMapping(m, lookup, mapped))
}

/**
 * The references of federations, disciplines, target faces and target mappings: every id names a record, a
 * discipline's international equivalent belongs to an international federation, a mapping names an
 * event of its face listed by the discipline's federation, with the event's gauge, every face
 * event has at most one mapping and every discipline at least one.
 */
export function checkFederations(
  bundle: Pick<Bundle, 'federations' | 'disciplines' | 'targetMappings' | 'targetFaces'>,
): string[] {
  const errors: string[] = []
  const lookup = lookupOf(bundle)
  checkFederationReferences(bundle.federations, lookup, errors)
  checkFaceFederations(bundle.targetFaces, lookup, errors)
  checkDisciplineReferences(bundle.disciplines, lookup, errors)
  checkMappings(bundle.targetMappings, lookup, errors)
  const used = new Set(bundle.targetMappings.map((m) => m.discipline))
  for (const d of bundle.disciplines)
    if (!used.has(d.id)) errors.push(`disciplines/${d.id}.json: no target mapping names it`)
  return errors
}
