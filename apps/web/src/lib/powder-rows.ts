/** The powder list's rows: search, the packed page props and the browser's powders. */
import { powder, type UserRecord } from '@open-reloading/schema'
import {
  classifyPowder,
  type FittedPowder,
  isFitted,
  meanRate,
  type PowderRow,
} from './burn-rate.ts'
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
  number | null,
  number | null,
  string | null,
  true | null,
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
    r.modelled ?? null,
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
      modelled,
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
        modelled,
      }),
    }),
  )

/** 3 decimals, as the catalogue rows carry them (`orderPowders`). */
const r3 = (x: number | undefined) => (x === undefined ? undefined : Number(x.toFixed(3)))

const interiorSchema = powder.shape.interior.unwrap()

/**
 * The burn-rate curves of the powder designs among `records` by record id: a design whose burn law
 * passes the powder schema's interior, with the kind "Fitted to data" the schema asks of it, and a
 * curve (`classifyPowder`). Labelled with the design's name. Checks the burn law only, not the whole
 * record: the list and the overlay load no designer code.
 */
export function designCurves(records: readonly UserRecord[]): Map<string, FittedPowder> {
  return new Map(
    records.flatMap((r): [string, FittedPowder][] => {
      if (r.kind !== 'powder' || r.data.provenanceKind !== 'fitted') return []
      const interior = interiorSchema.safeParse(r.data.draft?.interior)
      if (!interior.success) return []
      const p = classifyPowder({
        id: r.id,
        manufacturer: '',
        name: r.name,
        interior: interior.data,
      })
      // a rate the curve can draw: a positive vivacity, a finite mean (a huge form overflows it)
      if (!isFitted(p) || !(interior.data.vivacity.value > 0)) return []
      return Number.isFinite(meanRate(p).value) ? [[r.id, p]] : []
    }),
  )
}

/**
 * The powders among `records` as Mine rows: no manufacturer (a design has none), the grain form and
 * base of the draft, and the mean vivacity of a design that builds a powder with a curve (no
 * burn-rate order: that is the catalogue's).
 */
export function userPowderRows(records: readonly UserRecord[]): PowderRow[] {
  const curves = designCurves(records)
  return records.flatMap((r) => {
    if (r.kind !== 'powder') return []
    const curve = curves.get(r.id)
    const m = curve && meanRate(curve)
    const fit = curve && r.data.draft?.interior
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
        ...(fit?.trainingRows && { trainingRows: fit.trainingRows }),
        ...(fit?.trainingCartridges && { trainingCartridges: fit.trainingCartridges }),
        ...(r.data.draft?.interior && { modelled: true as const }),
      },
    ]
  })
}

/** Whether the row has a curve the burn-rate overlay can show: a placed catalogue powder or a design with one. */
export const inOverlay = (r: PowderRow) =>
  r.burnRateOrder !== undefined || (r.origin === 'user' && r.meanVivacity !== undefined)
