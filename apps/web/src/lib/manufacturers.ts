/**
 * Manufacturer names for the powders and bullets that name their manufacturer by id: from
 * `GET /manufacturers` through `apiFetch`, one request per page load, or on the server
 * from `getManufacturerNames` (`api.ts`).
 */

import { apiFetch } from './api-fetch.ts'
import type { ManufacturerSummary } from './api-types.ts'

/** Manufacturer names by id. */
export type ManufacturerNames = ReadonlyMap<string, string>

export const noManufacturerNames: ManufacturerNames = new Map()

export const manufacturerNames = (items: readonly ManufacturerSummary[]): ManufacturerNames =>
  new Map(items.map((m) => [m.id, m.name]))

/**
 * The label of a powder or bullet: "<manufacturer name> <product name>". A catalogue record names
 * its manufacturer by id, looked up in `names` (left out while the name is not known); a list row
 * or a design carries `manufacturerName`.
 */
export function productLabel(
  r: { name: string; manufacturer?: string; manufacturerName?: string },
  names: ManufacturerNames = noManufacturerNames,
) {
  const manufacturer = r.manufacturerName ?? (r.manufacturer && names.get(r.manufacturer))
  return [manufacturer, r.name].filter(Boolean).join(' ')
}

/** Manufacturer aliases by id, for the list searches; only manufacturers that have aliases. */
type ManufacturerAliases = ReadonlyMap<string, string[]>

export const manufacturerAliases = (items: readonly ManufacturerSummary[]): ManufacturerAliases =>
  new Map(items.flatMap((m) => (m.aliases?.length ? [[m.id, m.aliases]] : [])))

/**
 * `rows` with the name of each row's manufacturer (empty while the name is not known) and its
 * aliases where `aliases` has them.
 */
export const withManufacturerName = <T extends { manufacturer: string }>(
  rows: readonly T[],
  names: ManufacturerNames,
  aliases: ManufacturerAliases = new Map(),
): (T & { manufacturerName: string; manufacturerAliases?: string[] })[] =>
  rows.map((r) => {
    const manufacturerAliases = aliases.get(r.manufacturer)
    return {
      ...r,
      manufacturerName: names.get(r.manufacturer) ?? '',
      ...(manufacturerAliases && { manufacturerAliases }),
    }
  })

/**
 * The manufacturer filter's options of a list: each catalogue manufacturer id of `rows` with its
 * name, by name.
 */
export const manufacturerOptions = (
  rows: readonly { manufacturer?: string; manufacturerName: string }[],
) =>
  [
    ...new Map(
      rows.flatMap((r) =>
        r.manufacturer ? [[r.manufacturer, r.manufacturerName || r.manufacturer]] : [],
      ),
    ),
  ]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label))

let listing: Promise<ManufacturerNames> | undefined

/** Every manufacturer name through `apiFetch`, once per page load; retried after a failure. */
export function fetchManufacturerNames() {
  listing ??= apiFetch('manufacturers')
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return manufacturerNames(((await res.json()) as { items: ManufacturerSummary[] }).items)
    })
    .catch((e) => {
      listing = undefined
      throw e
    })
  return listing
}
