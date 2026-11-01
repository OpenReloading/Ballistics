import type { Discipline, EventType, Federation } from '@open-reloading/schema'
import type { Bundle } from './records.ts'
import { resolveId } from './renames.ts'

/**
 * A division listed twice among the power factors, and a magazine limit of a division without a
 * power factor, or for a major rating the division lacks. Ring scoring has no divisions, so every
 * magazine limit of a ring event type is an error.
 */
function checkDivisions(t: EventType, where: string, errors: string[]) {
  const floors =
    t.scoring.method === 'hit-factor'
      ? new Map(t.scoring.powerFactors.map((p) => [p.division, p]))
      : new Map()
  if (t.scoring.method === 'hit-factor' && floors.size !== t.scoring.powerFactors.length)
    errors.push(`${where}: a division is listed twice in scoring.powerFactors`)
  for (const m of t.magazine ?? []) {
    const floor = floors.get(m.division)
    if (!floor)
      errors.push(`${where}: magazine names division "${m.division}" without a power factor`)
    else if (m.powerFactor === 'major' && floor.major === undefined)
      errors.push(`${where}: magazine limits major in division "${m.division}", which has none`)
  }
}

/** The ids that replace an id of a kind in `renames.json`, and the records by id. */
type Lookup = {
  now: (kind: 'federations' | 'disciplines', id: string) => string
  federations: Map<string, Federation>
  disciplines: Map<string, Discipline>
}

/** The federation is a record and lists the rule book; returns the federation. */
function checkFederation(t: EventType, where: string, lookup: Lookup, errors: string[]) {
  const federation = lookup.federations.get(lookup.now('federations', t.federation))
  if (!federation) errors.push(`${where}: unknown federation "${t.federation}"`)
  else if (!federation.ruleBooks.some((b) => b.sha256 === t.ruleBook.sha256))
    errors.push(`${where}: rule book is not one of federation "${federation.id}"`)
  return federation
}

/** A ring scoring's discipline is a record of the event type's federation. */
function checkDiscipline(
  t: EventType,
  where: string,
  federation: Federation | undefined,
  lookup: Lookup,
  errors: string[],
) {
  if (t.scoring.method !== 'rings' || !t.scoring.discipline) return
  const d = lookup.disciplines.get(lookup.now('disciplines', t.scoring.discipline))
  if (!d) errors.push(`${where}: unknown discipline "${t.scoring.discipline}"`)
  else if (federation && lookup.now('federations', d.federation) !== federation.id)
    errors.push(`${where}: discipline "${d.id}" is not one of federation "${federation.id}"`)
}

/**
 * The references of event types: the federation is a record and lists the event type's rule book,
 * a ring scoring's discipline is a discipline of that federation, no division is listed twice and
 * every division of a magazine limit has a power factor.
 */
export function checkEventTypes(
  bundle: Pick<Bundle, 'eventTypes' | 'federations' | 'disciplines' | 'renames'>,
): string[] {
  const errors: string[] = []
  const lookup: Lookup = {
    now: (kind, id) => resolveId(bundle.renames, kind, id),
    federations: new Map(bundle.federations.map((f) => [f.id, f])),
    disciplines: new Map(bundle.disciplines.map((d) => [d.id, d])),
  }
  for (const t of bundle.eventTypes ?? []) {
    const where = `event-types/${t.id}.json`
    const federation = checkFederation(t, where, lookup, errors)
    checkDiscipline(t, where, federation, lookup, errors)
    checkDivisions(t, where, errors)
  }
  return errors
}
