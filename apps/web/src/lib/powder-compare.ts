import { powderModelValues } from '@openreloading/core'
import { type Powder, toSi } from '@openreloading/schema'
import type { InteriorBody } from './interior-input.ts'
import { type SortDirection, sortRows } from './lists.ts'

/**
 * The charge of the Powders tab: the typed one, a fraction of each powder's case fill, or the one at
 * which each powder reaches a peak pressure: `value` in Pa, or in percent of the cartridge's
 * compared CIP limit with `percent`.
 */
export type CompareMode =
  | { kind: 'typed' }
  | { kind: 'fill'; fill: number }
  | { kind: 'target'; value: number; percent: boolean }

/** Case fill (fraction of the free volume) the field accepts, percent. */
export const caseFillPercentRange = { min: 10, max: 120, initial: 100 } as const

/** Powders in flight at once: within the API pool, which also serves the user's own Run. */
export const compareConcurrency = 3

/**
 * The charge (kg) of a powder: `typed`, or `mode.fill` of the free volume at the record's bulk
 * density; undefined for a fill without a bulk density.
 */
export function compareCharge(
  mode: CompareMode,
  typed: number,
  bulkDensity: number | undefined,
  volume: number,
): number | undefined {
  if (mode.kind !== 'fill') return typed
  return bulkDensity ? mode.fill * toSi('density', bulkDensity) * volume : undefined
}

/**
 * The SI field values of a run: the fields, with the model parameters of the record `as.powder` laid
 * over them unless it is the powder `current` of the fields (their edited or opened values stand),
 * and `as.charge` (kg) when given.
 */
export function powderValues(
  fields: Record<string, number | undefined>,
  current: { id: string } | undefined,
  as?: { powder: Powder; charge?: number },
): Record<string, number | undefined> {
  return {
    ...fields,
    ...(as && as.powder.id !== current?.id && powderModelValues(as.powder)),
    ...(as?.charge !== undefined && { charge: as.charge }),
  }
}

/**
 * What the rows were computed for: the whole load but the charge (the current powder's row reads
 * the fields as they stand, the other rows read them under their record), the chosen powder, what
 * the bore resistance of a record reads besides the body (`recordInputs` of `loadRequest`), the
 * cartridge, and the typed charge, the fill or the target. A change of any of these marks the rows.
 */
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
  rows: readonly { manufacturerName: string; base?: string; form?: string }[],
  key: 'manufacturerName' | 'base' | 'form',
) => [...new Set(rows.flatMap((r) => (r[key] ? [r[key]] : [])))].sort()

export type PowderFilters = { manufacturerName: string; base: string; form: string }

export function filterPowderRows<
  T extends { manufacturerName: string; base?: string; form?: string },
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
