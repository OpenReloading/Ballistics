/**
 * The default order of federations, disciplines, target faces, face events and target mappings in
 * every list (API answers, directories, pickers). Federations number their disciplines in their
 * own way, so the key of a discipline reads the code the way its federation prints it.
 */
import {
  type Discipline,
  disciplineCategory,
  type Federation,
  type TargetMapping,
} from './federation.ts'
import type { TargetFace } from './target-face.ts'

const collator = new Intl.Collator('en', { numeric: true })

/** Names alphabetical, numbers in numeric order (25 before 100). */
export const compareNames = (a: string, b: string) => collator.compare(a, b)

/** Federations by abbreviation. */
export const compareFederations = (
  a: Pick<Federation, 'abbreviation'>,
  b: Pick<Federation, 'abbreviation'>,
) => compareNames(a.abbreviation, b.abbreviation)

/** Face events by distance ascending (m), then name. */
export const compareEvents = (
  a: { distance: number; name: string },
  b: { distance: number; name: string },
) => a.distance - b.distance || compareNames(a.name, b.name)

/** What the discipline order reads: the federation (id or abbreviation), the code and the name. */
export type DisciplineKey = Pick<Discipline, 'federation' | 'name' | 'number' | 'category'> & {
  /** mm */
  distanceMm: number
}

/**
 * The first code of a number, split into the text before the digits, the numeric segments and the
 * text after them. `x` in BDS group codes (`73xx`) stands for a digit, so it is read as 0: `73xx`
 * is 7300, after `4110`.
 */
function codeParts(number: string) {
  const first = number.split('/')[0] ?? ''
  const [, prefix = '', digits = '', rest = ''] = /^(\D*)(\d+(?:\.\d+)*)?(.*)$/.exec(first) ?? []
  const pad = digits && /^x+$/i.test(rest.trim()) ? rest.trim().length : 0
  return {
    prefix: prefix.trim(),
    segments: digits ? `${digits}${'0'.repeat(pad)}`.split('.').map(Number) : [],
    rest: pad ? '' : rest.trim(),
  }
}

/** Numeric segments in order, a shorter list first where the rest is equal. */
const compareSegments = (a: number[], b: number[]) => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0)
    if (d) return d
  }
  return a.length - b.length
}

/** The place of a category in `disciplineCategory`; a discipline without one comes last. */
const categoryRank = (category: string | undefined) => {
  const rank = disciplineCategory.options.indexOf(category as never)
  return rank < 0 ? Number.MAX_SAFE_INTEGER : rank
}

/**
 * Disciplines by federation, then the federation's own code: the first of several codes, numeric
 * segments in numeric order (`1.9` before `1.10`), a text prefix before its number (DSU, BDMP,
 * VdRBw: `LDG 2`, `G-H 6`), the BDS group codes padded (`73xx` after `4110`). A discipline without
 * a number follows the numbered ones, by category, distance, then name (ISSF). Ties by distance,
 * then name.
 */
export function compareDisciplines(a: DisciplineKey, b: DisciplineKey): number {
  const byFederation = compareNames(a.federation, b.federation)
  if (byFederation) return byFederation
  if (!a.number !== !b.number) return a.number ? -1 : 1
  if (a.number && b.number) {
    const x = codeParts(a.number)
    const y = codeParts(b.number)
    const byCode =
      compareNames(x.prefix, y.prefix) ||
      compareSegments(x.segments, y.segments) ||
      compareNames(x.rest, y.rest)
    if (byCode) return byCode
  } else {
    const byCategory = categoryRank(a.category) - categoryRank(b.category)
    if (byCategory) return byCategory
  }
  return a.distanceMm - b.distanceMm || compareNames(a.name, b.name)
}

/** The code a BDS face name ends with (`(Z18)`). */
const faceCode = (name: string) => /\(Z(\d+)\)$/.exec(name)?.[1]

/**
 * Target faces by organization, then the code the organization prints in the name (BDS: `(Z4)`
 * before `(Z18)`; faces with a code come first), then name.
 */
export function compareTargetFaces(
  a: Pick<TargetFace, 'organization' | 'name'>,
  b: Pick<TargetFace, 'organization' | 'name'>,
): number {
  const x = faceCode(a.name)
  const y = faceCode(b.name)
  return (
    compareNames(a.organization, b.organization) ||
    (x === undefined ? (y === undefined ? 0 : 1) : y === undefined ? -1 : Number(x) - Number(y)) ||
    compareNames(a.name, b.name)
  )
}

/** A target mapping with the key of its discipline. */
export type MappingKey = Pick<TargetMapping, 'id' | 'face'> & { discipline: DisciplineKey }

/** Target mappings by their discipline's order, then face id, then id. */
export const compareMappings = (a: MappingKey, b: MappingKey) =>
  compareDisciplines(a.discipline, b.discipline) ||
  compareNames(a.face, b.face) ||
  compareNames(a.id, b.id)
