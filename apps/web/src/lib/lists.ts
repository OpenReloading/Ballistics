/** Filtering and sorting of the data lists (cartridges, bullets, powders) in the browser. */
import { compareKeys, score, searchKey, sortKey } from '@open-reloading/schema'

export type SortDirection = 'ascending' | 'descending'

/**
 * The count of a list's page bar: "n bullets", or "n of m bullets" while a filter hides rows;
 * `noun` is the plural, its final s dropped for a total of 1 ("1 powder").
 */
export function countText(shown: number, total: number, noun: string) {
  const name = total === 1 ? noun.replace(/s$/, '') : noun
  return shown === total ? `${total} ${name}` : `${shown} of ${total} ${name}`
}

/** The filters set, as the no-match note names them: 'Caliber .308, matching "zz".' */
export function filterText(named: readonly (string | false | undefined)[]) {
  const text = named.filter(Boolean).join(', ')
  return text && `${text.charAt(0).toUpperCase()}${text.slice(1)}.`
}

/**
 * True when every word of `query` occurs in one of `texts`, in any order, ignoring case and
 * accents, with spaces, hyphens and decimal separators as the schema's matcher reads them
 * ("8x57" finds "8 x 57 IS"); an empty query matches.
 */
export const matchesQuery = (texts: (string | undefined)[], query: string) =>
  score(searchKey(texts), query) !== undefined

/** A sorted copy, texts in the order of the schema's `sortKey`; rows without a value come last in either order. */
export function sortRows<T>(
  rows: readonly T[],
  value: (row: T) => string | number | undefined,
  dir: SortDirection,
): T[] {
  const sign = dir === 'ascending' ? 1 : -1
  const keyed = rows.map((row) => {
    const v = value(row)
    return { row, v, key: typeof v === 'string' ? sortKey(v) : '' }
  })
  return keyed
    .sort((a, b) => {
      if (a.v === undefined || b.v === undefined)
        return a.v === b.v ? 0 : a.v === undefined ? 1 : -1
      return (
        sign *
        (typeof a.v === 'number' && typeof b.v === 'number' ? a.v - b.v : compareKeys(a.key, b.key))
      )
    })
    .map((r) => r.row)
}
