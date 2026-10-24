/**
 * Disciplines for the group panel. A discipline record of a federation maps to the faces and face
 * events that score it (target mappings); its entry's value is the discipline id. A face event that
 * no mapping names is an entry of its own, labelled with the organization that publishes the face
 * (an event of another organization carries that organization in its name); its value is the face
 * id and the event name. A group stores the face and the event either way. A flat list: Mantine's
 * group headings are no listbox children, which axe reports (aria-required-children).
 */
import {
  type Discipline,
  type Federation,
  type GroupFace,
  type TargetFace,
  type TargetMapping,
  toSi,
} from '@open-reloading/schema'
import { compareDisciplines, compareFederations, compareNames } from './face-order.ts'

export type FederationSummary = Pick<Federation, 'id' | 'name' | 'abbreviation'>
export type DisciplineSummary = Pick<
  Discipline,
  'id' | 'federation' | 'name' | 'number' | 'category'
> & {
  distanceMm: number
}
export type MappingSummary = Pick<
  TargetMapping,
  'id' | 'discipline' | 'face' | 'event' | 'stage'
> & {
  gaugeMm?: number
}

/** The federations, their disciplines and the mappings to faces, as the API lists them. */
export type FederationData = {
  federations: FederationSummary[]
  disciplines: DisciplineSummary[]
  mappings: MappingSummary[]
}

/** The mapping that scores a group's face and event. */
export const mappingOf = (
  mappings: MappingSummary[],
  face: Pick<GroupFace, 'id' | 'event'> | undefined,
) => (face?.event ? mappings.find((m) => m.face === face.id && m.event === face.event) : undefined)

/** The discipline id of a mapped face event, else the face id and the event; null without one. */
export function disciplineValue(
  face: Pick<GroupFace, 'id' | 'event'> | undefined,
  mappings: MappingSummary[] = [],
) {
  if (!face?.event) return null
  return mappingOf(mappings, face)?.discipline ?? `${face.id}|${face.event}`
}

/** The face and event of an entry value: a discipline's first mapping, or the face and event. */
export function disciplineChoice(value: string, mappings: MappingSummary[] = []) {
  const at = value.indexOf('|')
  if (at >= 0) return { id: value.slice(0, at), event: value.slice(at + 1) }
  const m = mappings.find((x) => x.discipline === value)
  return m && { id: m.face, event: m.event }
}

/** True when a target mapping uses the face `id`, so the face is not offered as its own event entry. */
export const mappedFace = (mappings: MappingSummary[], id: string) =>
  mappings.some((m) => m.face === id)

/**
 * The entries of the Discipline list: the disciplines of `federation`, else of every federation
 * (by federation) followed by the face events no mapping names (by organization).
 */
export function disciplineOptions(faces: TargetFace[], data?: FederationData, federation?: string) {
  const { federations = [], disciplines: all = [], mappings = [] } = data ?? {}
  const listed = federations
    .filter((f) => !federation || f.id === federation)
    .toSorted(compareFederations)
    .flatMap((f) =>
      all
        .filter((d) => d.federation === f.id)
        .toSorted(compareDisciplines)
        .map((d) => ({ value: d.id, label: disciplineLabel(f, d) })),
    )
  if (federation) return listed
  return [...listed, ...unmappedFaceEntries(faces, mappings)]
}

/** Federation abbreviation, number (unless the name starts with it), name and distance (unless the name holds it). */
function disciplineLabel(f: FederationSummary, d: DisciplineSummary): string {
  return `${f.abbreviation} ${d.number && !d.name.startsWith(d.number) ? `${d.number} ` : ''}${d.name}${d.name.includes(`${toSi('length', d.distanceMm)}`) ? '' : `, ${toSi('length', d.distanceMm)} m`}`
}

/** The face events no mapping names, by organization (an event of another organization than its face names that organization itself, an event on two faces its face). */
function unmappedFaceEntries(faces: TargetFace[], mappings: MappingSummary[]) {
  const entries = faces.flatMap((f) =>
    f.events
      .filter((e) => !mappings.some((m) => m.face === f.id && m.event === e.name))
      .map((e) => ({
        organization: e.organization ?? f.organization,
        value: `${f.id}|${e.name}`,
        label: e.organization ? e.name : `${f.organization} ${e.name}`,
        face: f.name,
      })),
  )
  // an event a rule book allows on two faces names the face
  const twice = new Set(
    entries
      .filter((e, i) => entries.findIndex((x) => x.label === e.label) !== i)
      .map((e) => e.label),
  )
  for (const e of entries) if (twice.has(e.label)) e.label = `${e.label} (${e.face})`
  return [...new Set(entries.map((e) => e.organization))]
    .toSorted(compareNames)
    .flatMap((organization) =>
      entries
        .filter((e) => e.organization === organization)
        .toSorted((a, b) => compareNames(a.label, b.label))
        .map(({ value, label }) => ({ value, label })),
    )
}

/** The faces of a discipline's mappings, each with its stage, in mapping order. */
export function disciplineFaces(mappings: MappingSummary[], discipline: string) {
  const seen = new Set<string>()
  return mappings.filter(
    (m) => m.discipline === discipline && !seen.has(m.face) && seen.add(m.face),
  )
}
