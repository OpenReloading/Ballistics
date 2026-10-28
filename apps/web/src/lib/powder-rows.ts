/** The powder list's rows: search, the packed page props and the browser's powders. */
import type { UserRecord } from '@open-reloading/schema'
import type { PowderRow } from './burn-rate.ts'
import { present } from './directory.ts'
import { matchesQuery } from './lists.ts'
import { userRowId } from './sources.ts'

/** Whether a powder row matches the search `query`. */
export const powderMatches = (r: PowderRow, query: string) =>
  matchesQuery([r.manufacturerName, ...(r.manufacturerAliases ?? []), r.name], query)

export type PackedPowder = [
  string,
  string,
  string,
  string,
  string | null,
  string | null,
  number | null,
  number | null,
  number | null,
  number | null,
  string[] | null,
]

/** Powder rows as arrays: the list page's props carry no key names. */
export const packPowders = (rows: readonly PowderRow[]): PackedPowder[] =>
  rows.map((r) => [
    r.id,
    r.manufacturer,
    r.manufacturerName,
    r.name,
    r.grainForm ?? null,
    r.propellantBase ?? null,
    r.meanVivacity ?? null,
    r.low ?? null,
    r.high ?? null,
    r.burnRateOrder ?? null,
    r.manufacturerAliases ?? null,
  ])

export const unpackPowders = (rows: readonly PackedPowder[]): PowderRow[] =>
  rows.map(
    ([
      id,
      manufacturer,
      manufacturerName,
      name,
      grainForm,
      propellantBase,
      meanVivacity,
      low,
      high,
      burnRateOrder,
      manufacturerAliases,
    ]) => ({
      id,
      manufacturer,
      manufacturerName,
      name,
      ...present({
        grainForm,
        propellantBase,
        meanVivacity,
        low,
        high,
        burnRateOrder,
        manufacturerAliases,
      }),
    }),
  )

/**
 * The powders among `records` as Mine rows: no manufacturer (a design has none), the grain form and
 * base of the draft, no burn rate.
 */
export function userPowderRows(records: readonly UserRecord[]): PowderRow[] {
  return records.flatMap((r) =>
    r.kind === 'powder'
      ? [
          {
            id: userRowId(r.id),
            origin: 'user' as const,
            manufacturer: '',
            manufacturerName: '',
            name: r.name,
            grainForm: r.data.draft?.grainForm ?? undefined,
            propellantBase: r.data.draft?.propellantBase ?? undefined,
          },
        ]
      : [],
  )
}
