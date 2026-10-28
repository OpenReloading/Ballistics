/** Filtering and sorting of the data lists (cartridges, bullets, powders) in the browser. */
import { compareKeys, score, searchKey, sortKey } from '@open-reloading/schema'
import type { Translator } from '../i18n/translate.ts'

export type SortDirection = 'ascending' | 'descending'

/** What a list lists, as its count names it. */
export type ListNoun =
  | 'bullets'
  | 'cartridges'
  | 'cases'
  | 'disciplines'
  | 'faces'
  | 'federations'
  | 'firearms'
  | 'powders'
  | 'primers'

type Tn = Translator['tn']

/** The count of each kind in both forms: whole sentences, as the form of a noun and the order of the words are a language's own. */
const countLines: Record<
  ListNoun,
  { all: (tn: Tn, total: number) => string; some: (tn: Tn, shown: number, total: number) => string }
> = {
  bullets: {
    all: (tn, n) => tn(n, '{count} bullet', '{count} bullets'),
    some: (tn, shown, n) =>
      tn(n, '{shown} of {count} bullet', '{shown} of {count} bullets', { shown }),
  },
  cartridges: {
    all: (tn, n) => tn(n, '{count} cartridge', '{count} cartridges'),
    some: (tn, shown, n) =>
      tn(n, '{shown} of {count} cartridge', '{shown} of {count} cartridges', { shown }),
  },
  cases: {
    all: (tn, n) => tn(n, '{count} case', '{count} cases'),
    some: (tn, shown, n) => tn(n, '{shown} of {count} case', '{shown} of {count} cases', { shown }),
  },
  disciplines: {
    all: (tn, n) => tn(n, '{count} discipline', '{count} disciplines'),
    some: (tn, shown, n) =>
      tn(n, '{shown} of {count} discipline', '{shown} of {count} disciplines', { shown }),
  },
  faces: {
    all: (tn, n) => tn(n, '{count} face', '{count} faces'),
    some: (tn, shown, n) => tn(n, '{shown} of {count} face', '{shown} of {count} faces', { shown }),
  },
  federations: {
    all: (tn, n) => tn(n, '{count} federation', '{count} federations'),
    some: (tn, shown, n) =>
      tn(n, '{shown} of {count} federation', '{shown} of {count} federations', { shown }),
  },
  firearms: {
    all: (tn, n) => tn(n, '{count} firearm', '{count} firearms'),
    some: (tn, shown, n) =>
      tn(n, '{shown} of {count} firearm', '{shown} of {count} firearms', { shown }),
  },
  powders: {
    all: (tn, n) => tn(n, '{count} powder', '{count} powders'),
    some: (tn, shown, n) =>
      tn(n, '{shown} of {count} powder', '{shown} of {count} powders', { shown }),
  },
  primers: {
    all: (tn, n) => tn(n, '{count} primer', '{count} primers'),
    some: (tn, shown, n) =>
      tn(n, '{shown} of {count} primer', '{shown} of {count} primers', { shown }),
  },
}

/** The count of a list's page bar: "n bullets", or "n of m bullets" while a filter hides rows. */
export function countText(tr: Translator, shown: number, total: number, noun: ListNoun) {
  return shown === total
    ? countLines[noun].all(tr.tn, total)
    : countLines[noun].some(tr.tn, shown, total)
}

/** The longest count the list can show, which sets the width of its page bar's status line. */
export const widestCount = (tr: Translator, total: number, noun: ListNoun) =>
  countLines[noun].some(tr.tn, total, total)

/** The filters set, as the no-match note names them: a sentence of the named filters, the first capitalised. */
export function filterText(named: readonly (string | false | undefined)[]) {
  const text = named.filter(Boolean).join(', ')
  return text && `${text.charAt(0).toUpperCase()}${text.slice(1)}.`
}

/** The search as a named filter; false without a search text. */
export const matchingText = (t: Translator['t'], query: string) =>
  query.trim() !== '' && t('matching "{query}"', { query: query.trim() })

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
