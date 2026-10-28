/** The discipline and federation lists' rows and filters, and a discipline record's rule book and stages. */
import {
  type CaliberClass,
  type Discipline,
  type Federation,
  type Provenance,
  type Source,
  toSi,
} from '@open-reloading/schema'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import type { DirectoryState } from './directory.ts'
import type { DisciplineSummary, FederationSummary, MappingSummary } from './face-disciplines.ts'
import { categoryWord } from './face-words.ts'
import { matchesQuery } from './lists.ts'
import { type FieldGroup, type StripItem, titleFromKebab } from './record-fields.ts'

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

/** One row of the discipline list. Distance in m. */
export type DisciplineRow = {
  id: string
  name: string
  number?: string
  /** The federation's abbreviation. */
  federation: string
  distance: number
  category?: string
  /** The caliber classes, in the record's order. */
  classes: CaliberClassRef[]
  /** Distinct faces of the discipline's mappings. */
  faces: number
}

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
    ...(d.category && { category: d.category }),
    classes: caliberClassRefs(d, classes),
    faces: disciplineFaceIds(mappings, d.id).length,
  }
}

/** Whether a discipline row passes the federation scope and the search. */
export const disciplineMatches = (r: DisciplineRow, s: DirectoryState) =>
  (!s.organization || r.federation === s.organization) &&
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
export function disciplineStrip(
  d: Pick<DisciplineRecord, 'federation' | 'distance' | 'category'>,
  t: Translator['t'],
  federation = d.federation,
): StripItem[] {
  const federationLabel = t('Federation')
  const distanceLabel = t('Distance')
  return [
    {
      icon: 'federation',
      label: federationLabel,
      row: { label: msg('Federation'), text: federation },
    },
    {
      icon: 'distance',
      label: distanceLabel,
      row: {
        label: msg('Distance'),
        text: String(toSi('length', d.distance.value)),
        numeric: true,
        unit: 'm',
      },
    },
    ...(d.category
      ? [
          {
            icon: 'form' as const,
            label: t('Category'),
            row: { label: msg('Category'), text: categoryWord(t, d.category) },
          },
        ]
      : []),
  ]
}

const classBasis: Record<'stated' | 'derived', Message> = {
  stated: msg('Named in the rule book'),
  derived: msg('Derived from the range or gauge the rule book states'),
}

/** The discipline's values beyond the strip: number, section, page and the caliber classes. */
export function disciplineGroups(
  d: Pick<DisciplineRecord, 'number' | 'section' | 'page' | 'caliberClasses'>,
  classes: readonly CaliberClassRef[],
  t: Translator['t'],
): FieldGroup[] {
  return [
    {
      rows: [
        ...(d.number ? [{ label: msg('Number'), text: d.number }] : []),
        { label: msg('Section'), text: d.section },
        { label: msg('Page'), text: d.page },
        ...(d.caliberClasses
          ? [
              {
                label: msg('Caliber classes'),
                text: caliberClassRefs(d, classes)
                  .map((c) => c.name)
                  .join(', '),
              },
              {
                label: msg('Caliber classes from'),
                text: t(classBasis[d.caliberClasses.basis]),
              },
            ]
          : []),
      ],
    },
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

/** Whether a federation row passes the search. */
export const federationMatches = (r: FederationRow, s: DirectoryState) =>
  matchesQuery([r.name, r.abbreviation, r.country], s.query)
