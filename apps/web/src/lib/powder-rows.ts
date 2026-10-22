/** The powder list's rows: filters and the packed page props. */
import type { PowderRow } from './burn-rate.ts'
import { type DirectoryState, inRange, numberRange, present } from './directory.ts'
import { matchesQuery } from './lists.ts'

/** Whether a powder row passes every filter of `s` (the sort aside). */
export function powderMatches(r: PowderRow, s: DirectoryState): boolean {
  if (s.manufacturer && r.manufacturer !== s.manufacturer) return false
  if (s.base && r.propellantBase !== s.base) return false
  if (s.form && r.grainForm !== s.form) return false
  if (s.curve && r.burnRateOrder === undefined) return false
  if (s.country && r.country !== s.country) return false
  if (!inRange(r.burnRateOrder, numberRange(s.burnRateOrder ?? '', ['']))) return false
  return matchesQuery([r.manufacturerName, ...(r.manufacturerAliases ?? []), r.name], s.query)
}

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
  string | null,
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
    r.country ?? null,
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
      country,
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
        country,
        manufacturerAliases,
      }),
    }),
  )
