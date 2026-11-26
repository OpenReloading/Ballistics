/** The discipline and federation lists' rows and filters, and a discipline record's rule book and stages. */
import type { I18n, MessageDescriptor } from '@lingui/core'
import {
  type CaliberClass,
  type Discipline,
  type DisciplineRules,
  type Federation,
  type Provenance,
  type QuantityValue,
  type Source,
  toSi,
} from '@rangefoundry/schema'
import { linguiOf, loadEnglish } from '../i18n/lingui.ts'
import { plainNumber } from '../i18n/number.ts'
import englishMessages from '../locales/en/lib/disciplines.json' with { type: 'json' }
import type { DirectoryState } from './directory.ts'
import type { DisciplineSummary, FederationSummary, MappingSummary } from './face-disciplines.ts'
import type { Facet } from './facets.ts'
import { kebabValue } from './list-values.ts'
import { matchesQuery } from './lists.ts'
import { type FieldGroup, type FieldRow, type StripItem, titleFromKebab } from './record-fields.ts'
import { metersPerYard, type Quantity } from './units.ts'
import { type LinguiWording, sayLingui, verbatim } from './wording.ts'

loadEnglish(englishMessages)

/** A discipline record as the API answers it: its sources resolved. */
export type DisciplineRecord = Omit<Discipline, 'provenance'> & {
  provenance?: Provenance | undefined
}

/** A federation record as the API answers it: its rule books and sources resolved. */
export type FederationRecord = Omit<Federation, 'ruleBooks' | 'provenance'> & {
  ruleBooks: { title: string; edition: string; url: string }[]
  provenance?: Provenance | undefined
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

/** One reading per unit the rule book states; for `m/yd` the printed number is the same in each. */
function distanceReadings(stored: number, unit: DisciplineRow['unit']) {
  // the SI conversion leaves float noise (12700 mm is 12.700000000000001 m)
  const metres = Number(stored.toPrecision(12))
  const yards = Number((stored / metersPerYard).toPrecision(12))
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
    .map((d) => `${plainNumber(d.number)} ${d.unit}`)
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

/** A row that states both distance units is in either. */
export function disciplineFacets(
  rows: readonly DisciplineRow[],
  faces: ReadonlyMap<string, string>,
): Facet<DisciplineRow>[] {
  const classNames = new Map(rows.flatMap((r) => r.classes.map((c) => [c.id, c.name] as const)))
  return [
    {
      key: 'org',
      label: /*i18n*/ { id: 'disciplines.facet.org', message: 'Federation' },
      values: (r) => [r.federation],
    },
    {
      key: 'category',
      label: /*i18n*/ { id: 'disciplines.facet.category', message: 'Category' },
      values: (r) => (r.category ? [r.category] : []),
      text: titleFromKebab,
    },
    {
      key: 'dist',
      label: /*i18n*/ { id: 'disciplines.facet.dist', message: 'Distance' },
      values: (r) => distanceReadings(r.distance, r.unit).map((d) => `${d.number}${d.unit}`),
      text: (v) => v.replace(/(\d)(m|yd)$/, '$1 $2'),
      order: (a, b) => Number.parseFloat(a) - Number.parseFloat(b) || a.localeCompare(b),
    },
    {
      key: 'class',
      label: /*i18n*/ { id: 'disciplines.facet.class', message: 'Caliber class' },
      values: (r) => r.classes.map((c) => c.id),
      text: (v) => classNames.get(v) ?? v,
    },
    {
      key: 'face',
      label: /*i18n*/ { id: 'disciplines.facet.face', message: 'Target' },
      values: (r) => r.faceIds,
      text: (v) => faces.get(v) ?? v,
    },
  ]
}

/** Whether a discipline row passes the search (the category also as `i18n` shows it). */
export const disciplineMatches = (
  r: DisciplineRow,
  s: Pick<DirectoryState, 'query'>,
  i18n: I18n = linguiOf('en'),
) =>
  matchesQuery(
    [
      r.name,
      r.number,
      r.federation,
      r.category && titleFromKebab(r.category),
      r.category && kebabValue(i18n, r.category),
      ...r.classes.map((c) => c.name),
    ],
    s.query,
  )

const stripLabels = {
  federation: /*i18n*/ { id: 'disciplines.strip.federation', message: 'Federation' },
  distance: /*i18n*/ { id: 'disciplines.strip.distance', message: 'Distance' },
  category: /*i18n*/ { id: 'disciplines.strip.category', message: 'Category' },
}

/** The discipline's facts under the page bar: federation, distance, category. */
export function disciplineStrip(
  d: Pick<DisciplineRecord, 'federation' | 'distance' | 'category'>,
  i18n: I18n,
  federation = d.federation,
): StripItem[] {
  return [
    {
      icon: 'federation',
      label: i18n._(stripLabels.federation),
      row: { label: stripLabels.federation, text: federation },
    },
    {
      icon: 'distance',
      label: i18n._(stripLabels.distance),
      row: {
        label: stripLabels.distance,
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
            label: i18n._(stripLabels.category),
            row: { label: stripLabels.category, text: kebabValue(i18n, d.category) },
          },
        ]
      : []),
  ]
}

const classBasis: Record<'stated' | 'derived', MessageDescriptor> = {
  stated: /*i18n*/ { id: 'disciplines.classBasis.stated', message: 'Named in the rule book' },
  derived: /*i18n*/ {
    id: 'disciplines.classBasis.derived',
    message: 'Derived from the range or gauge the rule book states',
  },
}

/** A stored quantity as a row in SI, with the figure as printed in the rule book where it differed. */
const quantityRow = (
  label: MessageDescriptor,
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

// the stored values of the rule facts, as words of a list
const ruleWords: Readonly<Record<string, MessageDescriptor>> = {
  'single-shot': /*i18n*/ { id: 'disciplines.rule.singleShot', message: 'single shot' },
  repeater: /*i18n*/ { id: 'disciplines.rule.repeater', message: 'repeater' },
  'semi-automatic': /*i18n*/ { id: 'disciplines.rule.semiAutomatic', message: 'semi automatic' },
  revolver: /*i18n*/ { id: 'disciplines.rule.revolver', message: 'revolver' },
  'lever-action': /*i18n*/ { id: 'disciplines.rule.leverAction', message: 'lever action' },
  standing: /*i18n*/ { id: 'disciplines.rule.standing', message: 'standing' },
  kneeling: /*i18n*/ { id: 'disciplines.rule.kneeling', message: 'kneeling' },
  sitting: /*i18n*/ { id: 'disciplines.rule.sitting', message: 'sitting' },
  prone: /*i18n*/ { id: 'disciplines.rule.prone', message: 'prone' },
  freehand: /*i18n*/ { id: 'disciplines.rule.freehand', message: 'freehand' },
  sling: /*i18n*/ { id: 'disciplines.rule.sling', message: 'sling' },
  rest: /*i18n*/ { id: 'disciplines.rule.rest', message: 'rest' },
  original: /*i18n*/ { id: 'disciplines.rule.original', message: 'original' },
  open: /*i18n*/ { id: 'disciplines.rule.open', message: 'open' },
  aperture: /*i18n*/ { id: 'disciplines.rule.aperture', message: 'aperture' },
  optical: /*i18n*/ { id: 'disciplines.rule.optical', message: 'optical' },
  reflex: /*i18n*/ { id: 'disciplines.rule.reflex', message: 'reflex' },
  lead: /*i18n*/ { id: 'disciplines.rule.lead', message: 'lead' },
  jacketed: /*i18n*/ { id: 'disciplines.rule.jacketed', message: 'jacketed' },
  'full-metal-jacket': /*i18n*/ {
    id: 'disciplines.rule.fullMetalJacket',
    message: 'full metal jacket',
  },
  'hollow-point': /*i18n*/ { id: 'disciplines.rule.hollowPoint', message: 'hollow point' },
  wadcutter: /*i18n*/ { id: 'disciplines.rule.wadcutter', message: 'wadcutter' },
}

const firearmWords: Readonly<Record<string, MessageDescriptor>> = {
  'short-gun': /*i18n*/ { id: 'disciplines.firearm.shortGun', message: 'Short gun' },
  'long-gun': /*i18n*/ { id: 'disciplines.firearm.longGun', message: 'Long gun' },
}

const spacedText = (v: string) => titleFromKebab(v).toLowerCase()

const list = (label: MessageDescriptor, values: readonly string[] | undefined): FieldRow[] =>
  values
    ? [
        {
          label,
          text: values.map(spacedText).join(', '),
          words: values.map((v) => ruleWords[v] ?? verbatim(spacedText(v))),
        },
      ]
    : []

/** A duration in seconds as minutes where it is whole minutes. */
const duration = (seconds: number) =>
  seconds % 60 === 0 ? { n: seconds / 60, unit: 'min' } : { n: seconds, unit: 's' }

const coverWords = {
  discipline: /*i18n*/ {
    id: 'disciplines.cover.discipline',
    message: '{n, decimal} {unit} for the discipline',
  },
  stage: /*i18n*/ { id: 'disciplines.cover.stage', message: '{n, decimal} {unit} per stage' },
  series: /*i18n*/ { id: 'disciplines.cover.series', message: '{n, decimal} {unit} per series' },
  shot: /*i18n*/ { id: 'disciplines.cover.shot', message: '{n, decimal} {unit} per shot' },
}

const sighterWords = (included: boolean | undefined): LinguiWording[] =>
  included === undefined
    ? []
    : [
        included
          ? /*i18n*/ { id: 'disciplines.sightersIncluded', message: 'sighters included' }
          : /*i18n*/ { id: 'disciplines.sightersNotIncluded', message: 'sighters not included' },
      ]

/** The sighters, series size and time limits of a discipline or a stage as rows. */
export function courseRows(
  c: Pick<NonNullable<Discipline['rules']>, 'sighters' | 'seriesShots' | 'timeLimits'>,
): FieldRow[] {
  return [
    ...(c.sighters === undefined
      ? []
      : [
          c.sighters === 'unlimited'
            ? {
                label: /*i18n*/ { id: 'disciplines.row.sighters', message: 'Sighters' },
                text: 'Any number',
                words: [/*i18n*/ { id: 'disciplines.anyNumber', message: 'Any number' }],
              }
            : {
                label: /*i18n*/ { id: 'disciplines.row.sighters', message: 'Sighters' },
                text: String(c.sighters),
                numeric: true,
              },
        ]),
    ...(c.seriesShots === undefined
      ? []
      : [
          {
            label: /*i18n*/ { id: 'disciplines.row.seriesShots', message: 'Shots per series' },
            text: String(c.seriesShots),
            numeric: true,
          },
        ]),
    ...(c.timeLimits ?? []).map((t) => {
      const words = [
        { ...coverWords[t.covers], values: duration(t.duration.value) },
        ...sighterWords(t.includesSighters),
      ]
      return {
        label: /*i18n*/ { id: 'disciplines.row.timeLimit', message: 'Time limit' },
        text: words.map((w) => sayLingui(linguiOf('en'), w)).join(', '),
        words,
        numeric: true,
        ...(t.duration.raw && { printed: t.duration.raw }),
      }
    }),
  ]
}

/** The rule facts a discipline's rule book states, as rows; none where it states none. */
export function ruleRows(r: DisciplineRules | undefined): FieldRow[] {
  if (!r) return []
  const a = r.ammunition
  return [
    ...(r.firearm
      ? [
          {
            label: /*i18n*/ { id: 'disciplines.row.firearm', message: 'Firearm' },
            text: titleFromKebab(r.firearm),
            words: [firearmWords[r.firearm] ?? verbatim(titleFromKebab(r.firearm))],
          },
        ]
      : []),
    ...list(/*i18n*/ { id: 'disciplines.row.actions', message: 'Actions' }, r.actions),
    ...list(/*i18n*/ { id: 'disciplines.row.positions', message: 'Positions' }, r.positions),
    ...list(/*i18n*/ { id: 'disciplines.row.support', message: 'Support' }, r.supports),
    ...list(/*i18n*/ { id: 'disciplines.row.sights', message: 'Sights' }, r.sights),
    ...(r.maxMagnification
      ? [
          {
            label: /*i18n*/ {
              id: 'disciplines.row.maxMagnification',
              message: 'Magnification up to',
            },
            text: `${r.maxMagnification.value}×`,
            numeric: true,
          },
        ]
      : []),
    ...quantityRow(
      /*i18n*/ { id: 'disciplines.row.minTriggerWeight', message: 'Trigger weight from' },
      'firearmMass',
      'mass',
      r.minTriggerWeight,
    ),
    ...quantityRow(
      /*i18n*/ { id: 'disciplines.row.maxBarrelLength', message: 'Barrel length up to' },
      'barrelLength',
      'length',
      r.maxBarrelLength,
    ),
    ...quantityRow(
      /*i18n*/ { id: 'disciplines.row.maxFirearmMass', message: 'Firearm mass up to' },
      'firearmMass',
      'mass',
      r.maxFirearmMass,
    ),
    ...(a?.handloads === undefined
      ? []
      : [
          {
            label: /*i18n*/ { id: 'disciplines.row.handloads', message: 'Handloads' },
            text: a.handloads ? 'Allowed' : 'Not allowed',
            words: [
              a.handloads
                ? /*i18n*/ { id: 'disciplines.allowed', message: 'Allowed' }
                : /*i18n*/ { id: 'disciplines.notAllowed', message: 'Not allowed' },
            ],
          },
        ]),
    ...quantityRow(
      /*i18n*/ { id: 'disciplines.row.minMuzzleEnergy', message: 'Muzzle energy from' },
      'energy',
      'energy',
      a?.minMuzzleEnergy,
    ),
    ...quantityRow(
      /*i18n*/ { id: 'disciplines.row.minBulletMass', message: 'Bullet mass from' },
      'mass',
      'mass',
      a?.minBulletMass,
    ),
    ...quantityRow(
      /*i18n*/ { id: 'disciplines.row.maxBulletMass', message: 'Bullet mass up to' },
      'mass',
      'mass',
      a?.maxBulletMass,
    ),
    ...list(/*i18n*/ { id: 'disciplines.row.bulletTypes', message: 'Bullets' }, a?.bulletTypes),
    ...courseRows(r),
  ]
}

/** The discipline's values beyond the strip: number, section, page and the caliber classes. */
export function disciplineGroups(
  d: Pick<DisciplineRecord, 'number' | 'section' | 'page' | 'caliberClasses' | 'rules'>,
  classes: readonly CaliberClassRef[],
  i18n: I18n,
): FieldGroup[] {
  const rules = ruleRows(d.rules)
  return [
    {
      rows: [
        ...(d.number
          ? [
              {
                label: /*i18n*/ { id: 'disciplines.row.number', message: 'Number' },
                text: d.number,
              },
            ]
          : []),
        { label: /*i18n*/ { id: 'disciplines.row.section', message: 'Section' }, text: d.section },
        { label: /*i18n*/ { id: 'disciplines.row.page', message: 'Page' }, text: d.page },
        ...(d.caliberClasses
          ? [
              {
                label: /*i18n*/ {
                  id: 'disciplines.row.caliberClasses',
                  message: 'Caliber classes',
                },
                text: caliberClassRefs(d, classes)
                  .map((c) => c.name)
                  .join(', '),
              },
              {
                label: /*i18n*/ {
                  id: 'disciplines.row.caliberClassBasis',
                  message: 'Caliber classes from',
                },
                text: i18n._(classBasis[d.caliberClasses.basis]),
              },
            ]
          : []),
      ],
    },
    ...(rules.length > 0
      ? [{ title: /*i18n*/ { id: 'disciplines.rules', message: 'Rules' }, rows: rules }]
      : []),
  ]
}

/** The source its `section` is read from, else its first source. */
export function disciplineRuleBook(
  d: Pick<DisciplineRecord, 'section' | 'page' | 'provenance'>,
): (Source & { section: string; page: string }) | undefined {
  const sources = d.provenance?.sources ?? []
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
const countryText = (country: string) => (country === 'international' ? 'International' : country)

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
  {
    key: 'country',
    label: /*i18n*/ { id: 'federations.facet.country', message: 'Country' },
    values: (r) => [r.country],
  },
]

/** Whether a federation row passes the search. */
export const federationMatches = (
  r: FederationRow,
  s: Pick<DirectoryState, 'query'>,
  countryLabel?: string,
) => matchesQuery([r.name, r.abbreviation, r.country, countryLabel], s.query)
