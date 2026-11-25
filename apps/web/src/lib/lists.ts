/** Filtering and sorting of the data lists (cartridges, bullets, powders) in the browser. */
import type { I18n } from '@lingui/core'
import { compareKeys, score, searchKey, sortKey } from '@rangefoundry/schema'
import { ungrouped } from '../i18n/lingui.ts'

export type SortDirection = 'ascending' | 'descending'

/** What a list lists, as its count names it. */
export type ListNoun =
  | 'bullets'
  | 'cartridges'
  | 'cases'
  | 'disciplines'
  | 'events'
  | 'faces'
  | 'federations'
  | 'firearms'
  | 'log entries'
  | 'powders'
  | 'primers'

type CountLine = { id: string; message: string }

/** A count line with its numbers ungrouped, as the own messages show a number. */
const say = (i18n: I18n, line: CountLine, values: Record<string, number>) =>
  i18n._(line.id, values, { message: line.message, formats: ungrouped })

/** The count of each kind in both forms: whole sentences, as the form of a noun and the order of the words are a language's own. */
const countLines: Record<ListNoun, { all: CountLine; some: CountLine }> = {
  bullets: {
    all: /*i18n*/ {
      id: 'lists.count.bullets',
      message: '{count, plural, one {# bullet} other {# bullets}}',
    },
    some: /*i18n*/ {
      id: 'lists.countShown.bullets',
      message: '{count, plural, one {{shown} of # bullet} other {{shown} of # bullets}}',
    },
  },
  cartridges: {
    all: /*i18n*/ {
      id: 'lists.count.cartridges',
      message: '{count, plural, one {# cartridge} other {# cartridges}}',
    },
    some: /*i18n*/ {
      id: 'lists.countShown.cartridges',
      message: '{count, plural, one {{shown} of # cartridge} other {{shown} of # cartridges}}',
    },
  },
  cases: {
    all: /*i18n*/ {
      id: 'lists.count.cases',
      message: '{count, plural, one {# brass} other {# brass}}',
    },
    some: /*i18n*/ {
      id: 'lists.countShown.cases',
      message: '{count, plural, one {{shown} of # brass} other {{shown} of # brass}}',
    },
  },
  disciplines: {
    all: /*i18n*/ {
      id: 'lists.count.disciplines',
      message: '{count, plural, one {# discipline} other {# disciplines}}',
    },
    some: /*i18n*/ {
      id: 'lists.countShown.disciplines',
      message: '{count, plural, one {{shown} of # discipline} other {{shown} of # disciplines}}',
    },
  },
  events: {
    all: /*i18n*/ {
      id: 'lists.count.events',
      message: '{count, plural, one {# event} other {# events}}',
    },
    some: /*i18n*/ {
      id: 'lists.countShown.events',
      message: '{count, plural, one {{shown} of # event} other {{shown} of # events}}',
    },
  },
  faces: {
    all: /*i18n*/ {
      id: 'lists.count.faces',
      message: '{count, plural, one {# target} other {# targets}}',
    },
    some: /*i18n*/ {
      id: 'lists.countShown.faces',
      message: '{count, plural, one {{shown} of # target} other {{shown} of # targets}}',
    },
  },
  federations: {
    all: /*i18n*/ {
      id: 'lists.count.federations',
      message: '{count, plural, one {# federation} other {# federations}}',
    },
    some: /*i18n*/ {
      id: 'lists.countShown.federations',
      message: '{count, plural, one {{shown} of # federation} other {{shown} of # federations}}',
    },
  },
  firearms: {
    all: /*i18n*/ {
      id: 'lists.count.firearms',
      message: '{count, plural, one {# firearm} other {# firearms}}',
    },
    some: /*i18n*/ {
      id: 'lists.countShown.firearms',
      message: '{count, plural, one {{shown} of # firearm} other {{shown} of # firearms}}',
    },
  },
  'log entries': {
    all: /*i18n*/ {
      id: 'lists.count.logEntries',
      message: '{count, plural, one {# entry} other {# entries}}',
    },
    some: /*i18n*/ {
      id: 'lists.countShown.logEntries',
      message: '{count, plural, one {{shown} of # entry} other {{shown} of # entries}}',
    },
  },
  powders: {
    all: /*i18n*/ {
      id: 'lists.count.powders',
      message: '{count, plural, one {# powder} other {# powders}}',
    },
    some: /*i18n*/ {
      id: 'lists.countShown.powders',
      message: '{count, plural, one {{shown} of # powder} other {{shown} of # powders}}',
    },
  },
  primers: {
    all: /*i18n*/ {
      id: 'lists.count.primers',
      message: '{count, plural, one {# primer} other {# primers}}',
    },
    some: /*i18n*/ {
      id: 'lists.countShown.primers',
      message: '{count, plural, one {{shown} of # primer} other {{shown} of # primers}}',
    },
  },
}

/** The count of a list's page bar: "n bullets", or "n of m bullets" while a filter hides rows. */
export const countText = (i18n: I18n, shown: number, total: number, noun: ListNoun) =>
  shown === total
    ? say(i18n, countLines[noun].all, { count: total })
    : say(i18n, countLines[noun].some, { count: total, shown })

/** The longest count the list can show, which sets the width of its page bar's status line. */
export const widestCount = (i18n: I18n, total: number, noun: ListNoun) =>
  say(i18n, countLines[noun].some, { count: total, shown: total })

/** The filters set, as the no-match note names them: a sentence of the named filters, the first capitalized. */
export function filterText(named: readonly (string | false | undefined)[]) {
  const text = named.filter(Boolean).join(', ')
  return text && `${text.charAt(0).toUpperCase()}${text.slice(1)}.`
}

/** The search as a named filter; false without a search text. */
export const matchingText = (i18n: I18n, query: string) =>
  query.trim() !== '' &&
  i18n._({ id: 'lists.matching', message: 'matching "{query}"', values: { query: query.trim() } })

/** As the schema's matcher reads words ("8x57" finds "8 x 57 IS"); an empty query matches. */
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
