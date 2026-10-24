/** The discipline and federation lists' rows and filters, and a discipline record's rule book and stages. */
import { caliberClasses, type Discipline, type Federation } from '@open-reloading/schema'
import type { Provenance, Source } from './api-types.ts'
import type { DirectoryState } from './directory.ts'
import type { DisciplineSummary, FederationSummary, MappingSummary } from './face-disciplines.ts'
import { matchesQuery } from './lists.ts'
import { type FieldGroup, type StripItem, titleFromKebab } from './record-fields.ts'

/** A discipline record as the API answers it: its sources resolved. */
export type DisciplineRecord = Omit<Discipline, 'provenance'> & { provenance: Provenance }

/** A federation record as the API answers it: its rule books and sources resolved. */
export type FederationRecord = Omit<Federation, 'ruleBooks' | 'provenance'> & {
  ruleBooks: { title: string; edition: string; url: string }[]
  provenance: Provenance
}

/** One row of the discipline list. Distance in m. */
export type DisciplineRow = {
  id: string
  name: string
  number?: string
  /** The federation's abbreviation. */
  federation: string
  distance: number
  category?: string
  /** Caliber class ids, in the record's order. */
  classes: string[]
  /** Distinct faces of the discipline's mappings. */
  faces: number
}

/** The label of a caliber class id; an unknown id is shown as is. */
export const caliberClassLabel = (id: string) =>
  caliberClasses.find((c) => c.id === id)?.label ?? id

/** The distinct faces of a discipline's mappings, in mapping order. */
export const disciplineFaceIds = (mappings: readonly MappingSummary[], discipline: string) => [
  ...new Set(mappings.filter((m) => m.discipline === discipline).map((m) => m.face)),
]

/** The list row of a discipline. */
export function disciplineRow(
  d: DisciplineRecord,
  federations: readonly FederationSummary[],
  mappings: readonly MappingSummary[],
): DisciplineRow {
  return {
    id: d.id,
    name: d.name,
    ...(d.number && { number: d.number }),
    federation: federations.find((f) => f.id === d.federation)?.abbreviation ?? d.federation,
    distance: d.distance.value / 1e3,
    ...(d.category && { category: d.category }),
    classes: d.caliberClasses?.ids ?? [],
    faces: disciplineFaceIds(mappings, d.id).length,
  }
}

/** Whether a discipline row passes the federation, category, distance and caliber class filters and the search. */
export const disciplineMatches = (r: DisciplineRow, s: DirectoryState) =>
  (!s.organization || r.federation === s.organization) &&
  (!s.category || r.category === s.category) &&
  (!s.distance || String(r.distance) === s.distance) &&
  (!s.caliberClass || r.classes.includes(s.caliberClass)) &&
  matchesQuery(
    [
      r.name,
      r.number,
      r.federation,
      r.category && titleFromKebab(r.category),
      ...r.classes.map(caliberClassLabel),
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
      row: { label: 'Distance', text: String(d.distance.value / 1e3), unit: 'm' },
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

/** The discipline's values beyond the strip: number, section, page and the caliber classes. */
export function disciplineGroups(d: DisciplineRecord): FieldGroup[] {
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
                text: d.caliberClasses.ids.map(caliberClassLabel).join(', '),
              },
              { label: 'Caliber classes from', text: classBasis[d.caliberClasses.basis] },
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

/** One row of the federation list. */
export type FederationRow = {
  id: string
  name: string
  abbreviation: string
  country: string
  ruleBooks: number
  disciplines: number
  /** Distinct faces of the mappings of its disciplines. */
  faces: number
}

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
  f: Pick<FederationRecord, 'id' | 'name' | 'abbreviation' | 'country' | 'ruleBooks'>,
  disciplines: readonly DisciplineSummary[],
  mappings: readonly MappingSummary[],
): FederationRow {
  const scope = federationScope(f.id, disciplines, mappings)
  return {
    id: f.id,
    name: f.name,
    abbreviation: f.abbreviation,
    country: countryText(f.country),
    ruleBooks: f.ruleBooks.length,
    disciplines: scope.disciplines.length,
    faces: scope.faces.length,
  }
}

/** Whether a federation row passes the search. */
export const federationMatches = (r: FederationRow, s: DirectoryState) =>
  matchesQuery([r.name, r.abbreviation, r.country], s.query)
