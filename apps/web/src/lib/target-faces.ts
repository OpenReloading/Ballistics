/** The target face list's rows and filter, and a face record's value groups and event rows. */
import {
  compareDisciplines,
  compareNames,
  type DisciplineKey,
  type TargetFace,
  type TargetMapping,
  toSi,
} from '@open-reloading/schema'
import type { DirectoryState } from './directory.ts'
import type { DisciplineSummary, FederationSummary, MappingSummary } from './face-disciplines.ts'
import { matchesQuery } from './lists.ts'
import type { FieldGroup, FieldRow, StripItem } from './record-fields.ts'

/** One row of the target face list. Lengths in mm, distances in m. */
export type TargetFaceRow = {
  id: string
  name: string
  organization: string
  distances: number[]
  outer: number
  rings: number
  disciplines: number
  /** The event names and their organizations, for the search. */
  events: string[]
}

/** The distances of a face's events in m, each once, ascending. */
const faceDistances = (f: TargetFace) =>
  [...new Set(f.events.map((e) => toSi('length', e.distance.value)))].sort((a, b) => a - b)

/** The distances as one text: "25, 50 m". */
export const distanceText = (metres: readonly number[]) =>
  metres.length > 0 ? `${metres.join(', ')} m` : ''

/** The list row of a face; `mappings` of every face, counted by distinct discipline. */
export function targetFaceRow(f: TargetFace, mappings: readonly MappingSummary[]): TargetFaceRow {
  return {
    id: f.id,
    name: f.name,
    organization: f.organization,
    distances: faceDistances(f),
    outer: f.rings[0].diameter.value,
    rings: f.rings.length,
    disciplines: new Set(mappings.filter((m) => m.face === f.id).map((m) => m.discipline)).size,
    events: f.events.flatMap((e) => [e.name, e.organization ?? '']),
  }
}

/** Whether a face row passes the federation filter and the search. */
export const targetFaceMatches = (r: TargetFaceRow, s: DirectoryState) =>
  (!s.organization || r.organization === s.organization) &&
  matchesQuery([r.name, r.organization, ...r.events], s.query)

const length = (label: string, mm: number | undefined, printed?: string): FieldRow[] =>
  mm === undefined
    ? []
    : [
        {
          label,
          value: { quantity: 'length', si: toSi('length', mm) },
          ...(printed && { printed }),
        },
      ]
const text = (label: string, value: string | undefined): FieldRow[] =>
  value === undefined ? [] : [{ label, text: value }]
const yesNo = (v: boolean | undefined, unset?: string) =>
  v === undefined ? unset : v ? 'Yes' : 'No'

const innerTenRule = { touch: 'Counts when touched', cover: 'Counts when covered' }

/** A ring's recorded colours after its label: " (black, line white)". */
const ringColours = (r: TargetFace['rings'][number]) => {
  const parts = [r.fill, r.line && `line ${r.line}`].filter(Boolean)
  return parts.length > 0 ? ` (${parts.join(', ')})` : ''
}

/** The face's facts under the page bar: federation, distances, outer diameter, black area, rings. */
export function targetFaceStrip(f: TargetFace): StripItem[] {
  const oval = f.rings[0].height !== undefined ? ' width' : ''
  const item = (icon: StripItem['icon'], label: string, rows: FieldRow[]): StripItem[] =>
    rows[0] ? [{ icon, label, row: rows[0] }] : []
  return [
    ...item('federation', 'Federation', text('Federation', f.organization)),
    ...item('distance', 'Distance', [
      { label: 'Distance', text: faceDistances(f).join(', '), unit: 'm' },
    ]),
    ...item(
      'diameter',
      `Outer diameter${oval}`,
      length('Outer diameter', f.rings[0].diameter.value, f.rings[0].diameter.raw),
    ),
    ...item(
      'black',
      `Black area${oval}`,
      length('Black area', f.blackDiameter.value, f.blackDiameter.raw),
    ),
    ...item('rings', 'Rings', text('Rings', String(f.rings.length))),
  ]
}

/** The face's values beyond the strip: scoring and sheet, then the ring diameters outer to inner and the inner ten. */
export function targetFaceGroups(f: TargetFace): FieldGroup[] {
  const w = f.rings[0].height !== undefined ? ' width' : ''
  return [
    {
      title: 'Face',
      rows: [
        ...length('Black area height', f.blackHeight?.value, f.blackHeight?.raw),
        ...text(
          'Inner ten rule',
          f.innerTen && (f.innerTen.rule ? innerTenRule[f.innerTen.rule] : 'Not stated'),
        ),
        ...text('Tenth-ring values', yesNo(f.decimal, 'Not stated')),
        ...text('Numerals printed', yesNo(f.numerals, 'Not stated')),
        ...text(
          'Sheet',
          f.paper &&
            `${f.paper.format && f.paper.format !== 'other' ? `${f.paper.format}, ` : ''}${f.paper.width.value} × ${f.paper.height.value} mm`,
        ),
        ...text('Scoring centres on the sheet', f.bulls && String(f.bulls.length)),
      ],
    },
    {
      title: `Ring diameters${w}`,
      rows: [
        ...f.rings.flatMap((r) => [
          ...length(`Ring ${r.value}${ringColours(r)}`, r.diameter.value, r.diameter.raw),
          ...length(`Ring ${r.value} height`, r.height?.value, r.height?.raw),
        ]),
        ...length('Inner ten', f.innerTen?.diameter.value, f.innerTen?.diameter.raw),
        ...length('Inner ten height', f.innerTen?.height?.value, f.innerTen?.height?.raw),
      ],
    },
  ]
}

/** A face event: from its target mapping and discipline where one maps it, else the event alone. */
type FaceEventRow = {
  id: string
  /** The discipline record's id; absent where no listed discipline maps the event. */
  disciplineId?: string
  federation: string
  number?: string
  /** The discipline's name, else the event's. */
  discipline: string
  stage?: string
  /** As the rule book prints it, else in m. */
  distance: string
  /** Gauge diameter, mm. */
  gauge?: number
  shotCount?: number
  category?: string
  scoring?: TargetFace['events'][number]['scoring']
  section?: string
}

/** One row per event of the face (one per mapping where several map it), in the order of `compareDisciplines`, then by stage. */
export function faceEventRows(
  f: Pick<TargetFace, 'organization' | 'events'>,
  mappings: readonly (Pick<
    TargetMapping,
    'id' | 'discipline' | 'event' | 'stage' | 'gauge' | 'shotCount'
  > &
    Partial<Pick<TargetMapping, 'provenance'>>)[],
  disciplines: readonly DisciplineSummary[],
  federations: readonly FederationSummary[],
): FaceEventRow[] {
  const byId = new Map(disciplines.map((d) => [d.id, d]))
  const abbreviation = new Map(federations.map((x) => [x.id, x.abbreviation]))
  return f.events
    .flatMap((e) => {
      const own = mappings.filter((m) => m.event === e.name)
      const event = {
        distance: e.distance.raw ?? `${toSi('length', e.distance.value)} m`,
        ...(e.category && { category: e.category }),
        ...(e.scoring && { scoring: e.scoring }),
      }
      return (own.length > 0 ? own : [undefined]).map((m) => {
        const d = m && byId.get(m.discipline)
        const gauge = m?.gauge ?? e.gauge
        // an event without its section: the page the mapping's source cites for it
        const section =
          e.section ?? m?.provenance?.sources.find((x) => x.fields?.includes('event'))?.page
        const federation = d
          ? (abbreviation.get(d.federation) ?? d.federation)
          : (e.organization ?? f.organization)
        const key: DisciplineKey = {
          federation,
          number: d?.number,
          name: d?.name ?? e.name,
          category: d?.category ?? e.category,
          distanceMm: d?.distanceMm ?? e.distance.value,
        }
        return {
          key,
          id: m?.id ?? e.name,
          ...(d && { disciplineId: d.id }),
          federation,
          ...(d?.number && { number: d.number }),
          discipline: d?.name ?? e.name,
          ...(m?.stage && { stage: m.stage }),
          ...(gauge && { gauge: gauge.value }),
          ...(m?.shotCount && { shotCount: m.shotCount }),
          ...(section && { section }),
          ...event,
        }
      })
    })
    .sort((a, b) => compareDisciplines(a.key, b.key) || compareNames(a.stage ?? '', b.stage ?? ''))
    .map(({ key: _, ...row }) => row)
}
