/**
 * The powder and cartridge choosers' catalogues and ranking: every summary read once per page
 * load, ranked as the API's `q` ranks them (`score` of the schema over a key built like the
 * catalogue's), so the dialog finds what the card's field finds.
 */
import { compareKeys, score, searchKey, sortKey } from '@open-reloading/schema'
import { apiFetch } from './api-fetch.ts'
import type { CartridgeSummary, ListOf, PowderSummary } from './api-types.ts'
import { orderPowders, type PowderRow } from './burn-rate.ts'
import type { CartridgeRow } from './cartridge-rows.ts'
import { fetchManufacturers } from './manufacturers.ts'

/** Every summary of the list `kind`, in pages of 200 (the route's limit; the pages after the first together). */
async function listAll<T>(kind: string): Promise<T[]> {
  const get = async (offset: number) => {
    const res = await apiFetch(`${kind}?limit=200&offset=${offset}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as ListOf<T>
  }
  const first = await get(0)
  const rest = await Promise.all(
    Array.from({ length: Math.ceil((first.total - 200) / 200) }, (_, i) => get((i + 1) * 200)),
  )
  return [first, ...rest].flatMap((page) => page.items)
}

/** A read once per page load, retried after a failure. */
function once<T>(read: () => Promise<T>): () => Promise<T> {
  let kept: Promise<T> | undefined
  return () => {
    kept ??= read().catch((e) => {
      kept = undefined
      throw e
    })
    return kept
  }
}

/** Every catalogue powder with its manufacturer's name and aliases and its burn-rate order. */
export const fetchPowderCatalogue = once(async () => {
  const [makers, powders] = await Promise.all([
    fetchManufacturers(),
    listAll<PowderSummary>('powders'),
  ])
  const byId = new Map(makers.map((m) => [m.id, m]))
  return orderPowders(
    powders.map((p) => {
      const m = byId.get(p.manufacturer)
      return {
        ...p,
        manufacturerName: m?.name ?? '',
        ...(m?.aliases?.length ? { manufacturerAliases: m.aliases } : {}),
      }
    }),
  )
})

/** Every catalogue cartridge. */
export const fetchCartridgeCatalogue = once(() => listAll<CartridgeSummary>('cartridges'))

/** What ranking reads of a row, worked out once. */
interface Entry {
  key: string
  order: string
}

const entries = new WeakMap<object, Entry>()

function entryOf<R extends object>(row: R, keys: (row: R) => Entry): Entry {
  let e = entries.get(row)
  if (!e) {
    e = keys(row)
    entries.set(row, e)
  }
  return e
}

/** A powder's keys: each name of its manufacturer with the product name, as the catalogue's. */
export const powderKeys = (p: PowderRow): Entry => ({
  key: searchKey(
    [p.manufacturerName, ...(p.manufacturerAliases ?? [])].map((n) => `${n} ${p.name}`.trim()),
    p.name,
  ),
  order: sortKey(p.manufacturerName, p.name),
})

/** A cartridge's keys: its name and aliases, as the catalogue's. */
export const cartridgeKeys = (c: CartridgeRow): Entry => ({
  key: searchKey([c.name, ...c.aliases]),
  order: sortKey(c.name),
})

/** Larger values first, rows without a value last; undefined for equal values. */
function compareValues(kx: number | undefined, ky: number | undefined) {
  if (kx === ky) return
  if (kx !== undefined && ky !== undefined) return ky - kx
  return kx === undefined ? 1 : -1
}

/**
 * The rows that match every typed word: best match first (`relevance`), the browser's designs
 * first among equal matches, ties and `name` by the catalogue's order; with `value` the largest
 * first, rows without one last.
 */
export function rankRecords<R extends { id: string; origin?: 'user' | undefined }>(
  rows: readonly R[],
  query: string,
  keys: (row: R) => Entry,
  sort: string,
  value?: (row: R) => number | undefined,
): R[] {
  return rows
    .flatMap((r) => {
      const e = entryOf(r, keys)
      const rank = score(e.key, query)
      return rank === undefined ? [] : [{ r, e, rank: sort === 'relevance' ? rank : 0 }]
    })
    .sort((x, y) => {
      if (x.rank !== y.rank) return y.rank - x.rank
      if (sort === 'relevance' && (x.r.origin === 'user') !== (y.r.origin === 'user'))
        return x.r.origin === 'user' ? -1 : 1
      return (
        (value && compareValues(value(x.r), value(y.r))) ??
        (compareKeys(x.e.order, y.e.order) || compareKeys(x.r.id, y.r.id))
      )
    })
    .map((s) => s.r)
}
