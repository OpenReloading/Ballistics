/** The powder list's rows: search, the packed page props and the browser's powders. */
import type { UserRecord } from '@open-reloading/schema'
import { classifyPowder, isFitted, meanRate, type PowderRow } from './burn-rate.ts'
import { present } from './directory.ts'
import { matchesQuery } from './lists.ts'
import { powderDesigns } from './powder-designer.ts'
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
  number | null,
  number | null,
  string | null,
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
    r.trainingRows ?? null,
    r.trainingCartridges ?? null,
    r.retrieved ?? null,
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
      trainingRows,
      trainingCartridges,
      retrieved,
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
        trainingRows,
        trainingCartridges,
        retrieved,
      }),
    }),
  )

/** 3 decimals, as the catalogue rows carry them (`orderPowders`). */
const r3 = (x: number | undefined) => (x === undefined ? undefined : Number(x.toFixed(3)))

/**
 * The powders among `records` as Mine rows: no manufacturer (a design has none), the grain form and
 * base of the draft, and the mean vivacity of a design that builds a powder with a curve (no
 * burn-rate order: that is the catalogue's).
 */
export function userPowderRows(records: readonly UserRecord[]): PowderRow[] {
  const curves = new Map(
    powderDesigns(records).flatMap((d) => {
      const p = classifyPowder(d.powder)
      return isFitted(p) ? [[d.id, meanRate(p)] as const] : []
    }),
  )
  return records.flatMap((r) => {
    if (r.kind !== 'powder') return []
    const m = curves.get(r.id)
    return [
      {
        id: userRowId(r.id),
        origin: 'user' as const,
        manufacturer: '',
        manufacturerName: '',
        name: r.name,
        grainForm: r.data.draft?.grainForm ?? undefined,
        propellantBase: r.data.draft?.propellantBase ?? undefined,
        ...(m && { meanVivacity: r3(m.value), low: r3(m.low), high: r3(m.high) }),
      },
    ]
  })
}

/** Whether the row has a curve the burn-rate overlay can show: a placed catalogue powder or a design with one. */
export const inOverlay = (r: PowderRow) =>
  r.burnRateOrder !== undefined || (r.origin === 'user' && r.meanVivacity !== undefined)
