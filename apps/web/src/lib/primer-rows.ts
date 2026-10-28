/** The primer list's rows: the summary with the name of its manufacturer, and the search. */

import { type Translator, translator } from '../i18n/translate.ts'
import type { PrimerSummary } from './api-types.ts'
import { kebabValue } from './list-values.ts'
import { matchesQuery } from './lists.ts'
import type { ManufacturerNames } from './manufacturers.ts'
import { titleFromKebab } from './record-fields.ts'

/** A primer of the list: the summary with the name and aliases of its manufacturer. */
export type PrimerRow = PrimerSummary & {
  manufacturerName: string
  manufacturerAliases?: string[]
}

/** The rows of `items` with the manufacturer's name and aliases (empty while one is not known). */
export const primerRows = (
  items: readonly PrimerSummary[],
  names: ManufacturerNames,
  aliases: ReadonlyMap<string, string[]>,
): PrimerRow[] =>
  items.map((p) => {
    const manufacturerAliases = aliases.get(p.manufacturer)
    return {
      ...p,
      manufacturerName: names.get(p.manufacturer) ?? '',
      ...(manufacturerAliases && { manufacturerAliases }),
    }
  })

/** Whether a primer row matches the search `query`: manufacturer, name, product number, size or compound (also as `t` shows them). */
export const primerMatches = (r: PrimerRow, query: string, t: Translator['t'] = translator().t) =>
  matchesQuery(
    [
      r.manufacturerName,
      ...(r.manufacturerAliases ?? []),
      r.name,
      r.productNumber,
      titleFromKebab(r.size),
      r.compound && titleFromKebab(r.compound),
      kebabValue(t, r.size),
      r.compound && kebabValue(t, r.compound),
    ],
    query,
  )
