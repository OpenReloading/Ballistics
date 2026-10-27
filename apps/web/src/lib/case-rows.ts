/** The case list's rows: the summary with the names of its manufacturer and cartridge, and the search. */
import { parseRef, type UserRecord } from '@open-reloading/schema'
import type { CaseSummary } from './api-types.ts'
import { groupCapacity } from './case-group.ts'
import { matchesQuery } from './lists.ts'
import type { ManufacturerNames } from './manufacturers.ts'
import { userRowId } from './sources.ts'

/** A case of the list: the summary with the names of its manufacturer and cartridge; `origin` `user` marks a group of the browser. */
export type CaseRow = CaseSummary & {
  origin?: 'user' | undefined
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

/**
 * The groups of cases among `records` as Mine rows: no manufacturer or product number, the measured
 * capacity, and the cartridge named by the catalogue (`cartridges`, by id) or by the user's own
 * cartridge record.
 */
export function userCaseRows(
  records: readonly UserRecord[],
  cartridges: ReadonlyMap<string, string>,
): CaseRow[] {
  return records.flatMap((r) => {
    if (r.kind !== 'case') return []
    const ref = parseRef(r.data.cartridge)
    const named =
      ref?.scope === 'catalogue'
        ? cartridges.get(ref.id)
        : records.find((x) => x.kind === 'cartridge' && x.id === ref?.id)?.name
    return [
      {
        id: userRowId(r.id),
        origin: 'user' as const,
        manufacturer: '',
        manufacturerName: '',
        cartridge: r.data.cartridge,
        cartridgeName: named ?? '',
        name: r.name,
        productNumber: '',
        material: r.data.material,
        waterCapacity: groupCapacity(r.data, records),
        mass: r.data.mass?.value,
      },
    ]
  })
}

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
