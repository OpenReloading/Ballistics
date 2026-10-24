/**
 * The bullet picker's search: the directory list's filters and word matching
 * (`bulletMatches`), results ordered by how well each bullet matches the typed words, and the
 * whole catalogue read once per page load.
 */
import { bulletFits, type CartridgeDiameters } from '@openreloading/core'
import { fold } from '@openreloading/schema'
import { apiFetch } from './api-fetch.ts'
import type { BulletSummary, ListOf, ManufacturerSummary } from './api-types.ts'
import {
  atWordStart,
  type BulletItem,
  type BulletRow,
  bulletMatches,
  bulletSearchText,
} from './bullet-rows.ts'
import { commonCaliber } from './caliber.ts'
import { emptyDirectory } from './directory.ts'
import { kilogramsPerGrain } from './units.ts'

/** The picker's filters; each empty one leaves every bullet in. */
export interface BulletFilters {
  manufacturer: string
  /** A common caliber (`commonCaliber`): ".308", "6.5 mm". */
  caliber: string
  /** A mass range with its unit as the directory writes it: "150-180gr", "9.5-g". */
  mass: string
  /** The CIP values of the cartridge: only the bullets that fit it (`bulletFits` of core). */
  fit?: CartridgeDiameters
  /** `catalogue` or `designs` (the browser's own); both without it. */
  origin?: 'catalogue' | 'designs'
}

export type BulletSort = 'relevance' | 'name' | 'mass' | 'ballisticCoefficient'

const words = (s: string) =>
  fold(s)
    .split(/[^a-z0-9.]+/)
    .filter(Boolean)

/** A number with an optional unit as typed: "168", "168gr", "10.9g". */
const massWord = /^(\d+(?:\.\d+)?)(gr|g)?$/

/** Whether a bullet weighs what a typed number says: "168" and "168gr" grains, "10.9g" grams, within half a unit of the last typed digit. */
function sameMass(b: BulletRow, number: string, unit: string | undefined) {
  if (b.mass === null) return false
  const half = 0.5 * 10 ** -(number.split('.')[1]?.length ?? 0)
  const typed = unit === 'g' ? b.mass : (b.mass * 1e-3) / kilogramsPerGrain
  return Math.abs(typed - Number(number)) <= half + 1e-9
}

/** What a typed word is worth for one bullet: its best field, 0 where it is in none. */
function wordScore(
  b: BulletRow,
  word: string,
  name: readonly string[],
  maker: readonly string[],
): number {
  // an exact word counts twice a word start; the product name outweighs the manufacturer
  const best = (of: readonly string[], weight: number) =>
    of.reduce((m, w) => Math.max(m, w === word ? 2 * weight : w.startsWith(word) ? weight : 0), 0)
  let score = Math.max(best(name, 3), best(maker, 2))
  const typed = massWord.exec(word)
  if (typed) {
    if (sameMass(b, typed[1], typed[2])) score = Math.max(score, 8)
    // "308" and ".308" are the caliber ".308", "6.5" the caliber "6.5 mm"
    if (typed[2] === undefined && commonCaliber(b.diameter).replace(/^\.|\s*mm$/g, '') === typed[1])
      score = Math.max(score, 6)
  }
  return score
}

/** A row with what matching and ordering read of it, worked out once. */
interface Entry {
  row: BulletRow
  /** The text the words are looked for in, as the directory list builds it. */
  hay: string
  name: string[]
  maker: string[]
}

/** The entries of a list of rows, kept while the list is. */
const entries = new WeakMap<readonly BulletRow[], Entry[]>()

function entriesOf(rows: readonly BulletRow[]): Entry[] {
  let list = entries.get(rows)
  if (!list) {
    list = rows.map((row) => ({
      row,
      hay: fold(bulletSearchText(row)),
      name: words(row.name),
      maker: words(
        [row.manufacturerName, ...((row as BulletItem).manufacturerAliases ?? [])].join(' '),
      ),
    }))
    entries.set(rows, list)
  }
  return list
}

const relevanceOf = (e: Entry, typed: readonly string[]) =>
  typed.reduce((sum, word) => sum + wordScore(e.row, word, e.name, e.maker), 0)

/** How well a bullet matches the typed words: the sum of each word's best field, 0 for no words. */
export function bulletRelevance(b: BulletRow, query: string): number {
  return relevanceOf(entriesOf([b])[0], words(query))
}

const byName = (a: BulletRow, b: BulletRow) =>
  (a.manufacturerName ?? '').localeCompare(b.manufacturerName ?? '') ||
  a.name.localeCompare(b.name) ||
  a.id.localeCompare(b.id)

/**
 * The bullets that pass `filters` and match every typed word, best match first, ties and the other
 * sorts by manufacturer and name; the heaviest or the highest BC first for `mass` and
 * `ballisticCoefficient`, rows without a value last. The first search of a list of `rows` indexes
 * it: search the same array again.
 */
export function searchBullets(
  rows: readonly BulletRow[],
  query: string,
  filters: BulletFilters,
  sort: BulletSort = 'relevance',
): BulletRow[] {
  const typed = words(query)
  // a number with its unit is a weight the text of a row does not hold ("175gr", "10.9g")
  const weights = typed.map((w) => massWord.exec(w)).filter((m) => m?.[2])
  const text = typed.filter((w) => !massWord.exec(w)?.[2])
  // the filters of the directory without its text match, which the index does
  const state = {
    ...emptyDirectory,
    manufacturer: filters.manufacturer,
    caliber: filters.caliber,
    mass: filters.mass,
  }
  const key = (b: BulletRow) =>
    sort === 'mass' ? b.mass : sort === 'ballisticCoefficient' ? bc(b) : undefined
  return entriesOf(rows)
    .filter(
      ({ row, hay }) =>
        (filters.origin === undefined ||
          (filters.origin === 'designs') === (row.origin === 'user')) &&
        (filters.fit === undefined || bulletFits(row.diameter, filters.fit)) &&
        weights.every((w) => w && sameMass(row, w[1], w[2])) &&
        bulletMatches(row, state, '') &&
        text.every((word) => atWordStart(hay, word)),
    )
    .map((e) => ({ b: e.row, score: sort === 'relevance' ? relevanceOf(e, typed) : 0 }))
    .sort((x, y) => {
      if (x.score !== y.score) return y.score - x.score
      // the browser's own designs come first among equal matches
      if (sort === 'relevance' && (x.b.origin === 'user') !== (y.b.origin === 'user'))
        return x.b.origin === 'user' ? -1 : 1
      const [kx, ky] = [key(x.b), key(y.b)]
      if (kx !== ky && kx != null && ky != null) return ky - kx
      if (kx !== ky && (kx == null || ky == null)) return kx == null ? 1 : -1
      return byName(x.b, y.b)
    })
    .map((s) => s.b)
}

/** The G7 coefficient, else the G1 one: what the picker's BC column and sort show. */
export const bc = (b: Pick<BulletSummary, 'ballisticCoefficientG1' | 'ballisticCoefficientG7'>) =>
  b.ballisticCoefficientG7 ?? b.ballisticCoefficientG1

let catalogue: Promise<BulletItem[]> | undefined

/**
 * Every catalogue bullet with its manufacturer's name and aliases, through `apiFetch` in pages of
 * 200 (the route's limit; the pages after the first together), once per page load; retried after a failure.
 */
export function fetchBulletCatalogue(): Promise<BulletItem[]> {
  catalogue ??= (async () => {
    const get = async <T>(path: string) => {
      const res = await apiFetch(path)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as ListOf<T>
    }
    const makers = new Map(
      (await get<ManufacturerSummary>('manufacturers')).items.map((m) => [m.id, m]),
    )
    // the first page tells the total, the others are read together
    const first = await get<BulletSummary>('bullets?limit=200&offset=0')
    const rest = await Promise.all(
      Array.from({ length: Math.ceil((first.total - 200) / 200) }, (_, i) =>
        get<BulletSummary>(`bullets?limit=200&offset=${(i + 1) * 200}`),
      ),
    )
    const items = [first, ...rest].flatMap((page) => page.items)
    return items.map((b) => {
      const m = makers.get(b.manufacturer)
      return {
        ...b,
        manufacturerName: m?.name ?? '',
        ...(m?.aliases?.length ? { manufacturerAliases: m.aliases } : {}),
      }
    })
  })().catch((e) => {
    catalogue = undefined
    throw e
  })
  return catalogue
}
