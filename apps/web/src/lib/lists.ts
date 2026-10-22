/** Filtering and sorting of the data lists (cartridges, bullets, powders) in the browser. */

export type SortDirection = 'ascending' | 'descending'

/** Search key of `s`: Unicode NFD, combining marks removed, lower case. */
export const foldAccents = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

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
  return text && `${text[0].toUpperCase()}${text.slice(1)}.`
}

const compact = (s: string) => s.replace(/[\s-]+/g, '')

/**
 * True when every word of `query` occurs in one of `texts`, ignoring case and accents, or in the
 * texts with spaces and hyphens removed ("8x57" finds "8 x 57 IS"); an empty query matches.
 */
export function matchesQuery(texts: (string | undefined)[], query: string): boolean {
  const hay = foldAccents(texts.join(' '))
  const flat = compact(hay)
  return foldAccents(query)
    .split(/\s+/)
    .every((word) => {
      const bare = compact(word)
      return !bare || hay.includes(word) || flat.includes(bare)
    })
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

/** A sorted copy; rows without a value come last in either order. */
export function sortRows<T>(
  rows: readonly T[],
  value: (row: T) => string | number | undefined,
  dir: SortDirection,
): T[] {
  const sign = dir === 'ascending' ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = value(a)
    const y = value(b)
    if (x === undefined || y === undefined) return x === y ? 0 : x === undefined ? 1 : -1
    return (
      sign *
      (typeof x === 'number' && typeof y === 'number'
        ? x - y
        : collator.compare(String(x), String(y)))
    )
  })
}
