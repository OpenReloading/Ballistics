/** The target face list's rows and search, and a face record's value groups and event rows. */
import {
  compareDisciplines,
  compareNames,
  type DisciplineKey,
  type TargetFace,
  type TargetMapping,
  toSi,
} from '@open-reloading/schema'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import type { DisciplineSummary, FederationSummary, MappingSummary } from './face-disciplines.ts'
import type { Face } from './face-organization.ts'
import { colourWord } from './face-words.ts'
import { matchesQuery } from './lists.ts'
import { nth } from './nth.ts'
import type { FieldGroup, FieldRow, StripItem } from './record-fields.ts'
import { verbatim, type Wording } from './wording.ts'

type Translate = Translator['t']

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
const faceDistances = (f: Pick<Face, 'events'>) =>
  [...new Set(f.events.map((e) => toSi('length', e.distance.value)))].sort((a, b) => a - b)

/** The list row of a face; `mappings` of every face, counted by distinct discipline. */
export function targetFaceRow(f: Face, mappings: readonly MappingSummary[]): TargetFaceRow {
  return {
    id: f.id,
    name: f.name,
    organization: f.organization,
    distances: faceDistances(f),
    outer: nth(f.rings, 0).diameter.value,
    rings: f.rings.length,
    disciplines: new Set(mappings.filter((m) => m.face === f.id).map((m) => m.discipline)).size,
    events: f.events.flatMap((e) => [e.name, e.organization ?? '']),
  }
}

/** Whether a face row matches the search `query`. */
export const targetFaceMatches = (r: TargetFaceRow, query: string) =>
  matchesQuery([r.name, r.organization, ...r.events], query)

const length = (label: Wording, mm: number | undefined, printed?: string): FieldRow[] =>
  mm === undefined
    ? []
    : [
        {
          label,
          value: { quantity: 'length', si: toSi('length', mm) },
          ...(printed && { printed }),
        },
      ]
const text = (label: Wording, value: string | undefined): FieldRow[] =>
  value === undefined ? [] : [{ label, text: value }]
const yesNo = (t: Translate, v: boolean | undefined, unset?: string) =>
  v === undefined ? unset : v ? t('Yes') : t('No')

const innerTenRule: Record<'touch' | 'cover', Message> = {
  touch: msg('Counts when touched'),
  cover: msg('Counts when covered'),
}

/** A ring's recorded colours after its label: " (black, line white)". */
const ringColours = (t: Translate, r: TargetFace['rings'][number]) => {
  const parts = [
    r.fill && colourWord(t, r.fill),
    r.line && t('line {colour}', { colour: colourWord(t, r.line) }),
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : undefined
}

/** A ring's label: its value and, where recorded, its colours. */
const ringLabel = (t: Translate, r: TargetFace['rings'][number]) => {
  const colours = ringColours(t, r)
  return verbatim(
    colours
      ? t('Ring {value} ({colours})', { value: r.value, colours })
      : t('Ring {value}', { value: r.value }),
  )
}

/** The face's facts under the page bar: federation, distances, outer diameter, black area, rings. */
export function targetFaceStrip(f: Omit<Face, 'provenance'>, t: Translate): StripItem[] {
  const outer = nth(f.rings, 0)
  const oval = outer.height !== undefined
  const item = (icon: StripItem['icon'], label: string, rows: FieldRow[]): StripItem[] =>
    rows[0] ? [{ icon, label, row: rows[0] }] : []
  return [
    ...item('federation', t('Federation'), text(msg('Federation'), f.organization)),
    ...item('distance', t('Distance'), [
      {
        label: msg('Distance'),
        text: faceDistances(f).join(', '),
        numeric: true,
        unit: 'm',
      },
    ]),
    ...item(
      'diameter',
      oval ? t('Outer diameter width') : t('Outer diameter'),
      length(msg('Outer diameter'), outer.diameter.value, outer.diameter.raw),
    ),
    ...item(
      'black',
      oval ? t('Black area width') : t('Black area'),
      length(msg('Black area'), f.blackDiameter.value, f.blackDiameter.raw),
    ),
    ...item('rings', t('Rings'), text(msg('Rings'), String(f.rings.length))),
  ]
}

/** The face's values beyond the strip: scoring and sheet, then the ring diameters outer to inner and the inner ten. */
export function targetFaceGroups(f: Omit<TargetFace, 'provenance'>, t: Translate): FieldGroup[] {
  const oval = nth(f.rings, 0).height !== undefined
  const unset = t('Not stated')
  return [
    {
      title: msg('Face'),
      rows: [
        ...length(msg('Black area height'), f.blackHeight?.value, f.blackHeight?.raw),
        ...text(
          msg('Inner ten rule'),
          f.innerTen && (f.innerTen.rule ? t(innerTenRule[f.innerTen.rule]) : unset),
        ),
        ...text(msg('Tenth-ring values'), yesNo(t, f.decimal, unset)),
        ...text(msg('Numerals printed'), yesNo(t, f.numerals, unset)),
        ...(f.paper
          ? [
              {
                label: msg('Sheet'),
                text: `${f.paper.format && f.paper.format !== 'other' ? `${f.paper.format}, ` : ''}${f.paper.width.value} × ${f.paper.height.value} mm`,
                numeric: true as const,
              },
            ]
          : []),
        ...text(msg('Scoring centres on the sheet'), f.bulls && String(f.bulls.length)),
      ],
    },
    {
      title: oval ? msg('Ring diameters width') : msg('Ring diameters'),
      rows: [
        ...f.rings.flatMap((r) => [
          ...length(ringLabel(t, r), r.diameter.value, r.diameter.raw),
          ...length(
            verbatim(t('Ring {value} height', { value: r.value })),
            r.height?.value,
            r.height?.raw,
          ),
        ]),
        ...length(msg('Inner ten'), f.innerTen?.diameter.value, f.innerTen?.diameter.raw),
        ...length(msg('Inner ten height'), f.innerTen?.height?.value, f.innerTen?.height?.raw),
      ],
    },
  ]
}

/** A face event: from its target mapping and discipline where one maps it, else the event alone. */
export type FaceEventRow = {
  id: string
  /** The discipline record's id; absent where no listed discipline maps the event. */
  disciplineId?: string
  federation: string
  number?: string
  /** The discipline's name, else the event's. */
  discipline: string
  stage?: string
  /** As the rule book prints it, else the metres. */
  distance: { raw?: string | undefined; metres: number }
  /** Gauge diameter, mm. */
  gauge?: number
  shotCount?: number
  category?: string
  scoring?: TargetFace['events'][number]['scoring']
  section?: string
}

type EventMapping = Pick<
  TargetMapping,
  'id' | 'discipline' | 'event' | 'stage' | 'gauge' | 'shotCount'
> &
  Partial<Pick<TargetMapping, 'provenance'>>

function disciplineKeyOf(
  d: DisciplineSummary | undefined,
  e: Face['events'][number],
  federation: string,
): DisciplineKey {
  return {
    federation,
    number: d?.number,
    name: d?.name ?? e.name,
    category: d?.category ?? e.category,
    distanceMm: d?.distanceMm ?? e.distance.value,
  }
}

/** The row of event `e` for its mapping `m`, with its sort key; the event alone without a mapping. */
function eventRow(
  f: Pick<Face, 'organization' | 'events'>,
  e: Face['events'][number],
  m: EventMapping | undefined,
  byId: ReadonlyMap<string, DisciplineSummary>,
  abbreviation: ReadonlyMap<string, string>,
  event: Pick<FaceEventRow, 'distance' | 'category' | 'scoring'>,
): FaceEventRow & { key: DisciplineKey } {
  const d = m && byId.get(m.discipline)
  const gauge = m?.gauge ?? e.gauge
  // an event without its section: the page the mapping's source cites for it
  const section = e.section ?? m?.provenance?.sources.find((x) => x.fields?.includes('event'))?.page
  const federation = d
    ? (abbreviation.get(d.federation) ?? d.federation)
    : (e.organization ?? f.organization)
  return {
    key: disciplineKeyOf(d, e, federation),
    id: m?.id ?? e.id,
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
}

/** One row per event of the face (one per mapping where several map it), in the order of `compareDisciplines`, then by stage. */
export function faceEventRows(
  f: Pick<Face, 'organization' | 'events'>,
  mappings: readonly EventMapping[],
  disciplines: readonly DisciplineSummary[],
  federations: readonly FederationSummary[],
): FaceEventRow[] {
  const byId = new Map(disciplines.map((d) => [d.id, d]))
  const abbreviation = new Map(federations.map((x) => [x.id, x.abbreviation]))
  return f.events
    .flatMap((e) => {
      const own = mappings.filter((m) => m.event === e.id)
      const event = {
        distance: { raw: e.distance.raw, metres: toSi('length', e.distance.value) },
        ...(e.category && { category: e.category }),
        ...(e.scoring && { scoring: e.scoring }),
      }
      return (own.length > 0 ? own : [undefined]).map((m) =>
        eventRow(f, e, m, byId, abbreviation, event),
      )
    })
    .sort((a, b) => compareDisciplines(a.key, b.key) || compareNames(a.stage ?? '', b.stage ?? ''))
    .map(({ key: _, ...row }) => row)
}
