/** The discipline and federation lists' rows and filters, and a discipline record's rule book and stages. */
import {
  type CaliberClass,
  type Discipline,
  type DisciplineRules,
  type Federation,
  type Provenance,
  type QuantityValue,
  type Source,
  toSi,
} from '@open-reloading/schema'
import type { DirectoryState } from './directory.ts'
import type { DisciplineSummary, FederationSummary, MappingSummary } from './face-disciplines.ts'
import type { Facet } from './facets.ts'
import { matchesQuery } from './lists.ts'
import { type FieldGroup, type FieldRow, type StripItem, titleFromKebab } from './record-fields.ts'
import type { Quantity } from './units.ts'

/** A discipline record as the API answers it: its sources resolved. */
export type DisciplineRecord = Omit<Discipline, 'provenance'> & { provenance: Provenance }

/** A federation record as the API answers it: its rule books and sources resolved. */
export type FederationRecord = Omit<Federation, 'ruleBooks' | 'provenance'> & {
  ruleBooks: { title: string; edition: string; url: string }[]
  provenance: Provenance
}

/** A caliber class as `GET /caliber-classes` lists it. */
export type CaliberClassSummary = Pick<CaliberClass, 'id' | 'name'> & { diameterMm: number }

/** A caliber class of a discipline: its id and name. */
export type CaliberClassRef = Pick<CaliberClassSummary, 'id' | 'name'>

/** One row of the discipline list. Distance in m, as the rule book's unit converts it. */
export type DisciplineRow = {
  id: string
  name: string
  number?: string
  /** The federation's abbreviation. */
  federation: string
  distance: number
  /** The unit the rule book states the distance in. */
  unit: Discipline['distance']['unit']
  category?: string
  /** The caliber classes, in the record's order. */
  classes: CaliberClassRef[]
  /** Distinct faces of the discipline's mappings. */
  faceIds: string[]
}

const metresPerYard = 0.9144

/**
 * The distance as the rule book prints it, one reading per unit it states: the metres of the
 * record, or for `yd` its yards; for `m/yd` the printed number is the same in each unit.
 */
function distanceReadings(stored: number, unit: DisciplineRow['unit']) {
  // the SI conversion leaves float noise (12700 mm is 12.700000000000001 m)
  const metres = Number(stored.toPrecision(12))
  const yards = Number((stored / metresPerYard).toPrecision(12))
  return unit === 'yd'
    ? [{ number: yards, unit: 'yd' }]
    : unit === 'm'
      ? [{ number: metres, unit: 'm' }]
      : [
          { number: metres, unit: 'm' },
          { number: metres, unit: 'yd' },
        ]
}

/** The distance text of a discipline: "25 m", "50 yd", "50 m / 50 yd". */
export const disciplineDistance = (r: Pick<DisciplineRow, 'distance' | 'unit'>) =>
  distanceReadings(r.distance, r.unit)
    .map((d) => `${d.number} ${d.unit}`)
    .join(' / ')

/** The caliber classes of a discipline with their names; an id no class answers is shown as is. */
const caliberClassRefs = (
  d: Pick<DisciplineRecord, 'caliberClasses'>,
  classes: readonly CaliberClassRef[],
): CaliberClassRef[] =>
  (d.caliberClasses?.ids ?? []).map((id) => ({
    id,
    name: classes.find((c) => c.id === id)?.name ?? id,
  }))

/** The distinct faces of a discipline's mappings, in mapping order. */
export const disciplineFaceIds = (mappings: readonly MappingSummary[], discipline: string) => [
  ...new Set(mappings.filter((m) => m.discipline === discipline).map((m) => m.face)),
]

/** The list row of a discipline. */
export function disciplineRow(
  d: DisciplineRecord,
  federations: readonly FederationSummary[],
  mappings: readonly MappingSummary[],
  classes: readonly CaliberClassRef[],
): DisciplineRow {
  return {
    id: d.id,
    name: d.name,
    ...(d.number && { number: d.number }),
    federation: federations.find((f) => f.id === d.federation)?.abbreviation ?? d.federation,
    distance: toSi('length', d.distance.value),
    unit: d.distance.unit,
    ...(d.category && { category: d.category }),
    classes: caliberClassRefs(d, classes),
    faceIds: disciplineFaceIds(mappings, d.id),
  }
}

/** The URL keys of the discipline list's choice filters. */
export const disciplineFacetKeys = ['org', 'category', 'dist', 'class', 'face']

/**
 * The discipline list's choice filters: federation (by abbreviation), category, distance in the
 * rule book's unit (a row that states both is in either), caliber class and face. `faces` names
 * the faces by id; the classes are named by `rows`.
 */
export function disciplineFacets(
  rows: readonly DisciplineRow[],
  faces: ReadonlyMap<string, string>,
): Facet<DisciplineRow>[] {
  const classNames = new Map(rows.flatMap((r) => r.classes.map((c) => [c.id, c.name] as const)))
  return [
    { key: 'org', label: 'Federation', values: (r) => [r.federation] },
    {
      key: 'category',
      label: 'Category',
      values: (r) => (r.category ? [r.category] : []),
      text: titleFromKebab,
    },
    {
      key: 'dist',
      label: 'Distance',
      values: (r) => distanceReadings(r.distance, r.unit).map((d) => `${d.number}${d.unit}`),
      text: (v) => v.replace(/(\d)(m|yd)$/, '$1 $2'),
      order: (a, b) => Number.parseFloat(a) - Number.parseFloat(b) || a.localeCompare(b),
    },
    {
      key: 'class',
      label: 'Caliber class',
      values: (r) => r.classes.map((c) => c.id),
      text: (v) => classNames.get(v) ?? v,
    },
    { key: 'face', label: 'Face', values: (r) => r.faceIds, text: (v) => faces.get(v) ?? v },
  ]
}

/** Whether a discipline row passes the search. */
export const disciplineMatches = (r: DisciplineRow, s: Pick<DirectoryState, 'query'>) =>
  matchesQuery(
    [
      r.name,
      r.number,
      r.federation,
      r.category && titleFromKebab(r.category),
      ...r.classes.map((c) => c.name),
    ],
    s.query,
  )

/** The discipline's facts under the page bar: federation, distance, category. */
export function disciplineStrip(d: DisciplineRecord, federation = d.federation): StripItem[] {
  return [
    { icon: 'federation', label: 'Federation', row: { label: 'Federation', text: federation } },
    {
      icon: 'distance',
      label: 'Distance',
      row: {
        label: 'Distance',
        text: disciplineDistance({
          distance: toSi('length', d.distance.value),
          unit: d.distance.unit,
        }),
      },
    },
    ...(d.category
      ? [
          {
            icon: 'form' as const,
            label: 'Category',
            row: { label: 'Category', text: titleFromKebab(d.category) },
          },
        ]
      : []),
  ]
}

const classBasis = {
  stated: 'Named in the rule book',
  derived: 'Derived from the range or gauge the rule book states',
}

/** A stored quantity as a row in SI, with the figure as printed in the rule book where it differed. */
const quantityRow = (
  label: string,
  quantity: Quantity,
  kind: 'length' | 'mass' | 'energy',
  v: QuantityValue | undefined,
): FieldRow[] =>
  v
    ? [
        {
          label,
          value: { quantity, si: toSi(kind, v.value) },
          ...(v.raw && { printed: v.raw }),
        },
      ]
    : []

const list = (label: string, values: readonly string[] | undefined): FieldRow[] =>
  values ? [{ label, text: values.map((v) => titleFromKebab(v).toLowerCase()).join(', ') }] : []

/** A duration in seconds as minutes where it is whole minutes. */
const durationText = (seconds: number) =>
  seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} s`

const sightersText = (included: boolean | undefined) =>
  included === undefined ? '' : included ? ', sighters included' : ', sighters not included'

const coverText = {
  discipline: 'for the discipline',
  stage: 'per stage',
  series: 'per series',
  shot: 'per shot',
}

/** The sighters, series size and time limits of a discipline or a stage as rows. */
export function courseRows(
  c: Pick<NonNullable<Discipline['rules']>, 'sighters' | 'seriesShots' | 'timeLimits'>,
): FieldRow[] {
  return [
    ...(c.sighters === undefined
      ? []
      : [
          {
            label: 'Sighters',
            text: c.sighters === 'unlimited' ? 'Any number' : String(c.sighters),
            numeric: true,
          },
        ]),
    ...(c.seriesShots === undefined
      ? []
      : [{ label: 'Shots per series', text: String(c.seriesShots), numeric: true }]),
    ...(c.timeLimits ?? []).map((t) => ({
      label: 'Time limit',
      text: `${durationText(t.duration.value)} ${coverText[t.covers]}${sightersText(t.includesSighters)}`,
      numeric: true,
      ...(t.duration.raw && { printed: t.duration.raw }),
    })),
  ]
}

/** The rule facts a discipline's rule book states, as rows; none where it states none. */
export function ruleRows(r: DisciplineRules | undefined): FieldRow[] {
  if (!r) return []
  const a = r.ammunition
  return [
    ...(r.firearm ? [{ label: 'Firearm', text: titleFromKebab(r.firearm) }] : []),
    ...list('Actions', r.actions),
    ...list('Positions', r.positions),
    ...list('Support', r.supports),
    ...list('Sights', r.sights),
    ...(r.maxMagnification
      ? [{ label: 'Magnification up to', text: `${r.maxMagnification.value}×`, numeric: true }]
      : []),
    ...quantityRow('Trigger weight from', 'mass', 'mass', r.minTriggerWeight),
    ...quantityRow('Barrel length up to', 'barrelLength', 'length', r.maxBarrelLength),
    ...quantityRow('Firearm mass up to', 'firearmMass', 'mass', r.maxFirearmMass),
    ...(a?.handloads === undefined
      ? []
      : [{ label: 'Handloads', text: a.handloads ? 'Allowed' : 'Not allowed' }]),
    ...quantityRow('Muzzle energy from', 'energy', 'energy', a?.minMuzzleEnergy),
    ...quantityRow('Bullet mass from', 'mass', 'mass', a?.minBulletMass),
    ...quantityRow('Bullet mass up to', 'mass', 'mass', a?.maxBulletMass),
    ...list('Bullets', a?.bulletTypes),
    ...courseRows(r),
  ]
}

/** The discipline's values beyond the strip: number, section, page and the caliber classes. */
export function disciplineGroups(
  d: DisciplineRecord,
  classes: readonly CaliberClassRef[],
): FieldGroup[] {
  const rules = ruleRows(d.rules)
  return [
    {
      rows: [
        ...(d.number ? [{ label: 'Number', text: d.number }] : []),
        { label: 'Section', text: d.section },
        { label: 'Page', text: d.page },
        ...(d.caliberClasses
          ? [
              {
                label: 'Caliber classes',
                text: caliberClassRefs(d, classes)
                  .map((c) => c.name)
                  .join(', '),
              },
              { label: 'Caliber classes from', text: classBasis[d.caliberClasses.basis] },
            ]
          : []),
      ],
    },
    ...(rules.length > 0 ? [{ title: 'Rules', rows: rules }] : []),
  ]
}

/**
 * The rule book that defines a discipline: the source its `section` is read from, else its first
 * source, with the section and page of the record.
 */
export function disciplineRuleBook(
  d: Pick<DisciplineRecord, 'section' | 'page' | 'provenance'>,
): (Source & { section: string; page: string }) | undefined {
  const sources = d.provenance.sources
  const s = sources.find((x) => x.fields?.includes('section')) ?? sources[0]
  return s && { ...s, section: d.section, page: d.page }
}

/** A federation as `GET /federations` lists it. */
export type FederationListItem = FederationSummary & Pick<Federation, 'country' | 'website'>

/** One row of the federation list. */
export type FederationRow = {
  id: string
  name: string
  abbreviation: string
  country: string
  disciplines: number
  website?: string
}

/** The host of a link without a leading `www.`: the readable name of a homepage link. */
export const hostText = (url: string) => new URL(url).host.replace(/^www\./, '')

/** "International" for a world body, else the ISO country code. */
export const countryText = (country: string) =>
  country === 'international' ? 'International' : country

/** The federation's disciplines and the distinct faces their mappings use, face ids in mapping order. */
export function federationScope(
  id: string,
  disciplines: readonly DisciplineSummary[],
  mappings: readonly MappingSummary[],
) {
  const own = disciplines.filter((d) => d.federation === id)
  const ids = new Set(own.map((d) => d.id))
  const faces = [...new Set(mappings.filter((m) => ids.has(m.discipline)).map((m) => m.face))]
  return { disciplines: own, faces }
}

/** The list row of a federation. */
export function federationRow(
  f: FederationListItem,
  disciplines: readonly DisciplineSummary[],
): FederationRow {
  return {
    id: f.id,
    name: f.name,
    abbreviation: f.abbreviation,
    country: countryText(f.country),
    disciplines: disciplines.filter((d) => d.federation === f.id).length,
    ...(f.website && { website: f.website }),
  }
}

/** The URL keys of the federation list's choice filters. */
export const federationFacetKeys = ['country']

/** The federation list's choice filter: the country, where "International" is a world body. */
export const federationFacets: Facet<FederationRow>[] = [
  { key: 'country', label: 'Country', values: (r) => [r.country] },
]

/** Whether a federation row passes the search. */
export const federationMatches = (r: FederationRow, s: Pick<DirectoryState, 'query'>) =>
  matchesQuery([r.name, r.abbreviation, r.country], s.query)
