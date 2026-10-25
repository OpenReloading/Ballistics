/** The powder list's rows: search and the packed page props. */
import type { PowderRow } from './burn-rate.ts'
import { present } from './directory.ts'
import { matchesQuery } from './lists.ts'

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
