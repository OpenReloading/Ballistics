import type { Discipline, Federation, TargetFace } from '@openreloading/schema'
import type { Bundle } from './records.ts'

/** The federations, disciplines and faces by id. */
type Lookup = {
  federations: Map<string, Federation>
  disciplines: Map<string, Discipline>
  faces: Map<string, TargetFace>
  worldBody: (id: string) => boolean
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

/**
 * A mapping names a known discipline and an event of a known face, listed by the discipline's
 * federation, with the event's gauge; every face event has at most one mapping.
 */
function checkMappings(mappings: Bundle['targetMappings'], lookup: Lookup, errors: string[]) {
  const mapped = new Map<string, string>()
  for (const m of mappings) {
    const where = `target-mappings/${m.id}.json`
    const d = lookup.disciplines.get(m.discipline)
    const face = lookup.faces.get(m.face)
    if (!d) errors.push(`${where}: unknown discipline "${m.discipline}"`)
    if (!face) {
      errors.push(`${where}: unknown face "${m.face}"`)
      continue
    }
    const event = face.events.find((e) => e.name === m.event)
    if (!event) {
      errors.push(`${where}: face "${m.face}" has no event "${m.event}"`)
      continue
    }
    const key = `${m.face} ${m.event}`
    if (mapped.has(key)) errors.push(`${where}: event "${m.event}" is also in ${mapped.get(key)}`)
    else mapped.set(key, m.id)
    const abbreviation = d && lookup.federations.get(d.federation)?.abbreviation
    if (abbreviation && (event.organization ?? face.organization) !== abbreviation)
      errors.push(`${where}: event "${m.event}" is not one of ${abbreviation}`)
    if (m.gauge && event.gauge && m.gauge.value !== event.gauge.value)
      errors.push(
        `${where}: gauge ${m.gauge.value} mm differs from the event's ${event.gauge.value} mm`,
      )
  }
}

/**
 * The references of federations, disciplines and target mappings: every id names a record, a
 * discipline's international equivalent belongs to an international federation, a mapping names an
 * event of its face listed by the discipline's federation, with the event's gauge, every face
 * event has at most one mapping and every discipline at least one.
 */
export function checkFederations(
  bundle: Pick<Bundle, 'federations' | 'disciplines' | 'targetMappings' | 'targetFaces'>,
): string[] {
  const errors: string[] = []
  const federations = new Map(bundle.federations.map((f) => [f.id, f]))
  const lookup: Lookup = {
    federations,
    disciplines: new Map(bundle.disciplines.map((d) => [d.id, d])),
    faces: new Map(bundle.targetFaces.map((f) => [f.id, f])),
    worldBody: (id) => federations.get(id)?.country === 'international',
  }
  checkFederationReferences(bundle.federations, lookup, errors)
  checkDisciplineReferences(bundle.disciplines, lookup, errors)
  checkMappings(bundle.targetMappings, lookup, errors)
  const used = new Set(bundle.targetMappings.map((m) => m.discipline))
  for (const d of bundle.disciplines)
    if (!used.has(d.id)) errors.push(`disciplines/${d.id}.json: no target mapping names it`)
  return errors
}
