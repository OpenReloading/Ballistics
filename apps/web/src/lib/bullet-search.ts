/** One search for the picker, its dialog, the card's field and Ctrl+K; the catalogue is read once per page load. */

import { bulletFits, type CartridgeDiameters } from '@rangefoundry/ballistics'
import { compareKeys, fold, sortKey } from '@rangefoundry/schema'
import { apiFetch } from './api-fetch.ts'
import type { BulletSummary, ListOf, ManufacturerSummary } from './api-types.ts'
import {
  type BulletItem,
  type BulletRow,
  bulletKey,
  bulletScore,
  sameMass,
  typedMass,
  typedWords,
} from './bullet-rows.ts'
import { commonCaliber } from './caliber.ts'
import { convertMass, massRange } from './mass-range.ts'

/** The picker's filters; each empty one leaves every bullet in. */
export interface BulletFilters {
  manufacturer: string
  /** A common caliber (`commonCaliber`): ".308", "6.5 mm". */
  caliber: string
  /** A mass range with its unit: "150-180gr", "9.5-g". */
  mass: string
  /** The CIP values of the cartridge: only the bullets that fit it (`bulletFits` of ballistics). */
  fit?: CartridgeDiameters | undefined
  /** `catalogue` or `designs` (the browser's own); both without it. */
  origin?: 'catalogue' | 'designs' | undefined
}

export type BulletSort = 'relevance' | 'name' | 'mass' | 'ballisticCoefficient'

/** Whether a bullet passes the manufacturer, caliber and mass filters, each empty one passing all. */
function inFilters(
  b: BulletRow,
  filters: Pick<BulletFilters, 'manufacturer' | 'caliber' | 'mass'>,
) {
  if (filters.manufacturer && b.manufacturer !== filters.manufacturer) return false
  if (filters.caliber && commonCaliber(b.diameter) !== filters.caliber) return false
  const range = massRange(filters.mass)
  if (!range) return true
  if (b.mass === null) return false
  // compared at the display rounding, so 168 gr lies in 150-168gr
  const shown = convertMass(b.mass, 'g', range.unit)
  return (
    (range.min === undefined || shown >= range.min) &&
    (range.max === undefined || shown <= range.max)
  )
}

/** A row with what ordering reads of it, worked out once. */
interface Entry {
  key: string
  /** The words of the product name. */
  name: string[]
  order: string
}

const entries = new WeakMap<BulletRow, Entry>()

function entryOf(row: BulletRow): Entry {
  let e = entries.get(row)
  if (!e) {
    e = {
      key: bulletKey(row),
      name: fold(row.name)
        .split(/[^a-z0-9.]+/)
        .filter(Boolean),
      order: sortKey(row.manufacturerName ?? '', row.name),
    }
    entries.set(row, e)
  }
  return e
}

/** A caliber label without its leading point or trailing `mm`: ".308" gives "308", "6.5 mm" "6.5". */
function bareCaliber(label: string) {
  const digits = label.startsWith('.') ? label.slice(1) : label
  return digits.endsWith('mm') ? digits.slice(0, -2).trimEnd() : digits
}

/** Weight or caliber 3, an exact name word 2, a name word's start 1: the name counts more than the maker. */
function bonus(b: BulletRow, e: Entry, words: readonly string[]): number {
  let total = 0
  for (const word of words) {
    const typed = typedMass(word)
    // "308" and ".308" are the caliber ".308", "6.5" the caliber "6.5 mm"
    if (
      typed &&
      (sameMass(b, typed.number, typed.unit) ||
        (typed.unit === undefined && bareCaliber(commonCaliber(b.diameter)) === typed.number))
    )
      total += 3
    total += e.name.reduce((m, w) => Math.max(m, w === word ? 2 : w.startsWith(word) ? 1 : 0), 0)
  }
  return total
}

/** How well a bullet matches the typed words, 0 for none or no match. */
export function bulletRelevance(b: BulletRow, query: string): number {
  const e = entryOf(b)
  const base = bulletScore(b, e.key, query)
  return base === undefined ? 0 : base + bonus(b, e, typedWords(query))
}

function inOriginAndFit(b: BulletRow, filters: BulletFilters) {
  if (filters.origin !== undefined && (filters.origin === 'designs') !== (b.origin === 'user'))
    return false
  return filters.fit === undefined || (b.diameter !== null && bulletFits(b.diameter, filters.fit))
}

/** Larger values first, rows without a value last; undefined for equal values. */
function compareValues(kx: number | null | undefined, ky: number | null | undefined) {
  if (kx === ky) return
  if (kx != null && ky != null) return ky - kx
  return kx == null ? 1 : -1
}

/** Best match first, ties by maker and name; rows without the sorted value last. */
export function searchBullets<R extends BulletRow>(
  rows: readonly R[],
  query: string,
  filters: BulletFilters,
  sort: BulletSort = 'relevance',
): R[] {
  const words = typedWords(query)
  const key = (b: BulletRow) =>
    sort === 'mass' ? b.mass : sort === 'ballisticCoefficient' ? bc(b) : undefined
  return rows
    .flatMap((b) => {
      if (!inOriginAndFit(b, filters)) return []
      const e = entryOf(b)
      const base = bulletScore(b, e.key, query)
      if (base === undefined || !inFilters(b, filters)) return []
      return [{ b, e, score: sort === 'relevance' ? base + bonus(b, e, words) : 0 }]
    })
    .sort((x, y) => {
      if (x.score !== y.score) return y.score - x.score
      // the browser's own designs come first among equal matches
      if (sort === 'relevance' && (x.b.origin === 'user') !== (y.b.origin === 'user'))
        return x.b.origin === 'user' ? -1 : 1
      return (
        compareValues(key(x.b), key(y.b)) ??
        (compareKeys(x.e.order, y.e.order) || compareKeys(x.b.id, y.b.id))
      )
    })
    .map((s) => s.b)
}

/** The G7 coefficient, else the G1 one: what the picker's BC column and sort show. */
const bc = (b: Pick<BulletSummary, 'ballisticCoefficientG1' | 'ballisticCoefficientG7'>) =>
  b.ballisticCoefficientG7 ?? b.ballisticCoefficientG1

/** Under 2 characters only `designs` are searched, so a first key does not read the catalogue. */
export async function findBullets(
  designs: readonly BulletRow[],
  text: string,
  limit: number,
  fit?: CartridgeDiameters | undefined,
): Promise<ListOf<BulletRow>> {
  const filters = { manufacturer: '', caliber: '', mass: '', fit }
  const own = searchBullets(designs, text, filters)
  // the designs live in the browser: they stay listed while the catalogue cannot be read
  const catalogue =
    text.trim().length < 2
      ? []
      : await fetchBulletCatalogue().catch((e) => {
          if (own.length === 0) throw e
          return []
        })
  const found =
    catalogue.length === 0 ? own : searchBullets([...designs, ...catalogue], text, filters)
  return { total: found.length, items: found.slice(0, limit) }
}

let catalogue: Promise<BulletItem[]> | undefined

/** Pages of 200 (the route's limit), once per page load; retried after a failure. */
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
