/** The case list's rows: the summary with the names of its manufacturer and cartridge, and the search. */
import type { CaseSummary } from './api-types.ts'
import { matchesQuery } from './lists.ts'
import type { ManufacturerNames } from './manufacturers.ts'

/** A case of the list: the summary with the names of its manufacturer and cartridge. */
export type CaseRow = CaseSummary & {
  manufacturerName: string
  manufacturerAliases?: string[]
  cartridgeName: string
}

/** The rows of `items` with the manufacturer's name and aliases and the cartridge's name (empty while one is not known). */
export const caseRows = (
  items: readonly CaseSummary[],
  names: ManufacturerNames,
  aliases: ReadonlyMap<string, string[]>,
  cartridges: ReadonlyMap<string, string>,
): CaseRow[] =>
  items.map((c) => {
    const manufacturerAliases = aliases.get(c.manufacturer)
    return {
      ...c,
      manufacturerName: names.get(c.manufacturer) ?? '',
      ...(manufacturerAliases && { manufacturerAliases }),
      cartridgeName: cartridges.get(c.cartridge) ?? '',
    }
  })

/** Whether a case row matches the search `query`: manufacturer, name, product number or cartridge. */
export const caseMatches = (r: CaseRow, query: string) =>
  matchesQuery(
    [
      r.manufacturerName,
      ...(r.manufacturerAliases ?? []),
      r.name,
      r.productNumber,
      r.cartridgeName,
    ],
    query,
  )
