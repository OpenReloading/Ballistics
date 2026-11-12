import { type Powder, toSi } from '@open-reloading/schema'
import { powderModelValues } from '@rangefoundry/ballistics'
import type { InteriorBody } from './interior-input.ts'
import { type SortDirection, sortRows } from './lists.ts'

/** `fill` is a fraction of the case fill, `value` a peak pressure in Pa, or with `percent` in percent of the cartridge's compared CIP limit. */
export type CompareMode =
  | { kind: 'typed' }
  | { kind: 'fill'; fill: number }
  | { kind: 'target'; value: number; percent: boolean }

/** Case fill (fraction of the free volume) the field accepts, percent. */
export const caseFillPercentRange = { min: 10, max: 120, initial: 100 } as const

/** Powders in flight at once: within the API pool, which also serves the user's own Run. */
export const compareConcurrency = 3

/** kg; undefined for a fill without a bulk density. */
export function compareCharge(
  mode: CompareMode,
  typed: number,
  bulkDensity: number | undefined,
  volume: number,
): number | undefined {
  if (mode.kind !== 'fill') return typed
  return bulkDensity ? mode.fill * toSi('density', bulkDensity) * volume : undefined
}

/** Whether the model of `p` has no start pressure of its own: its fit ran at `defaultStartPressure` of each load's barrel (`interior.startPressure` of the powder schema). */
export const fittedAtDefaultStart = (p: Powder | undefined) =>
  !!p && !p.interior?.startPressure && powderModelValues(p) !== undefined

/** The model parameters a powder record fills: without a start pressure of its own the field is left to its default. */
export function recordFill(p: Powder) {
  const all = powderModelValues(p)
  if (!all || p.interior?.startPressure) return all
  return Object.fromEntries(Object.entries(all).filter(([k]) => k !== 'startPressure'))
}

/** SI, `as.charge` in kg; the current powder's fields stand as edited, and a record without its own start pressure runs at `startDefault` (SI), not the current one's. */
export function powderValues(
  fields: Record<string, number | undefined>,
  current: { id: string } | undefined,
  as?: { powder: Powder; charge?: number },
  startDefault?: number,
): Record<string, number | undefined> {
  const other = as && as.powder.id !== current?.id
  return {
    ...fields,
    ...(other && recordFill(as.powder)),
    ...(other &&
      !as.powder.interior?.startPressure &&
      startDefault !== undefined && { startPressure: startDefault }),
    ...(as?.charge !== undefined && { charge: as.charge }),
  }
}

/** A change of any part marks the rows as stale. */
export function compareKey(
  body: InteriorBody,
  mode: CompareMode,
  recordInputs: readonly unknown[],
): string {
  const { charge, ...rest } = body.load
  // the solver ignores the typed charge, which `rest` leaves out
  const chargePart =
    mode.kind === 'typed'
      ? charge
      : mode.kind === 'fill'
        ? mode.fill
        : ['target', mode.value, mode.percent]
  return JSON.stringify([rest, chargePart, body.cartridge, recordInputs])
}

/** The facets the filters offer: the distinct values of a field, sorted. */
export const distinctValues = (
  rows: readonly {
    manufacturerName: string
    base?: string | undefined
    form?: string | undefined
  }[],
  key: 'manufacturerName' | 'base' | 'form',
) =>
  [...new Set(rows.flatMap((r) => (r[key] ? [r[key]] : [])))].sort((a, b) =>
    a.localeCompare(b, 'en'),
  )

export type PowderFilters = { manufacturerName: string; base: string; form: string }

export function filterPowderRows<
  T extends { manufacturerName: string; base?: string | undefined; form?: string | undefined },
>(rows: readonly T[], f: PowderFilters): T[] {
  return rows.filter(
    (r) =>
      (!f.manufacturerName || r.manufacturerName === f.manufacturerName) &&
      (!f.base || r.base === f.base) &&
      (!f.form || r.form === f.form),
  )
}

export type ColumnSort = { column: string; dir: SortDirection }

/** `rows` sorted by the column's value, rows without a value last; unsorted without a sort. */
export function sortPowderRows<T>(
  rows: readonly T[],
  sort: ColumnSort | undefined,
  value: (column: string) => ((row: T) => string | number | undefined) | undefined,
): T[] {
  const get = sort && value(sort.column)
  return sort && get ? sortRows(rows, get, sort.dir) : [...rows]
}

/** The sort in the column of the other mode: the peak pressure and the pressure range stand in one place. */
export function sortForMode(sort: ColumnSort | undefined, target: boolean): ColumnSort | undefined {
  const column = target ? 'peak' : 'range'
  return sort?.column === column ? { ...sort, column: target ? 'range' : 'peak' } : sort
}
