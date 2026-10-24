/** List sources: OpenReloading records and the user records of the browser. */
import type { UserRecord } from '@open-reloading/schema'
import type { BulletRow } from './bullet-rows.ts'
import type { CartridgeRow } from './cartridge-rows.ts'

export const origins = ['openreloading', 'user'] as const
export type Origin = (typeof origins)[number]

/** Full names, the chips' labels and the badges' hover text. */
export const originNames: Record<Origin, string> = { openreloading: 'OpenReloading', user: 'Mine' }

/** A row without `origin` is a catalogue row. */
export const originOf = (row: { origin?: 'user' }): Origin => row.origin ?? 'openreloading'

/**
 * The sources the `src` parameter turns on, of the sources a list has (`available`): all of them
 * when it is empty or names none of them.
 */
export function readOrigins(
  param: string | undefined,
  available: readonly Origin[] = origins,
): Origin[] {
  const names = (param ?? '').split(',')
  const on = available.filter((o) => names.includes(o))
  return on.length > 0 ? on : [...available]
}

/** The `src` parameter for these sources: empty while all of `available` are on. */
export const writeOrigins = (on: readonly Origin[], available: readonly Origin[] = origins) =>
  on.length === available.length ? '' : on.join(',')

/** `src` with `origin` switched; the last source on stays on. */
export function toggleOrigin(
  src: string | undefined,
  origin: Origin,
  available: readonly Origin[] = origins,
): string {
  const on = readOrigins(src, available)
  if (!on.includes(origin))
    return writeOrigins(
      available.filter((o) => o === origin || on.includes(o)),
      available,
    )
  return writeOrigins(on.length === 1 ? on : on.filter((o) => o !== origin), available)
}

export const inOrigins = (
  row: { origin?: 'user' },
  src: string | undefined,
  available: readonly Origin[] = origins,
) => readOrigins(src, available).includes(originOf(row))

export function countOrigins(rows: readonly { origin?: 'user' }[]): Record<Origin, number> {
  const counts = { openreloading: 0, user: 0 }
  for (const r of rows) counts[originOf(r)]++
  return counts
}

const prefix = 'user:'
const userRowId = (recordId: string) => `${prefix}${recordId}`
/** The browser record of a user row's id; undefined for a catalogue id. */
export const userRecordId = (rowId: string) =>
  rowId.startsWith(prefix) ? rowId.slice(prefix.length) : undefined

/** The designer that opens a user row's record (`?record=`). */
export const designerHref = (kind: 'bullets' | 'cartridges', rowId: string) =>
  `/${kind}/designer?record=${encodeURIComponent(userRecordId(rowId) ?? rowId)}`

/** Bullet designs with a diameter as list rows: lengths in mm, mass in g; absent values stay absent. */
export function userBulletRows(records: readonly UserRecord[]): BulletRow[] {
  return records.flatMap((r) => {
    if (r.kind !== 'bulletDesign') return []
    const { diameter, mass, length } = r.data.siValues
    // the diameter is the designer's one required value: a design without it has no caliber to list
    if (diameter === undefined) return []
    return [
      {
        id: userRowId(r.id),
        origin: 'user' as const,
        manufacturerName: r.data.manufacturerName,
        name: r.data.name || r.name,
        diameter: diameter * 1e3,
        mass: mass === undefined ? null : mass * 1e3,
        length: length === undefined ? null : length * 1e3,
        ballisticCoefficientG1: null,
        ballisticCoefficientG7: null,
      },
    ]
  })
}

/** Cartridge designs as list rows: the smallest cartridge-side G1, L3, L6 and the largest Pmax. */
export function userCartridgeRows(records: readonly UserRecord[]): CartridgeRow[] {
  return records.flatMap((r) => {
    if (r.kind !== 'cartridgeDesign') return []
    const of = (symbol: string, side: 'cartridge' | undefined) =>
      r.data.values
        .filter((v) => v.symbol === symbol && v.side === side && v.value !== undefined)
        .map((v) => v.value as number)
    const smallest = (symbol: string) => {
      const v = of(symbol, 'cartridge')
      return v.length > 0 ? Math.min(...v) : undefined
    }
    const [g1, l3, l6] = [smallest('G1'), smallest('L3'), smallest('L6')]
    const pmax = of('Pmax', undefined)
    return [
      {
        id: userRowId(r.id),
        origin: 'user' as const,
        name: r.name,
        aliases: [],
        ...(g1 !== undefined && { maxBulletDiameter: g1 }),
        ...(l3 !== undefined && { caseLength: l3 }),
        ...(l6 !== undefined && { cartridgeLength: l6 }),
        ...(pmax.length > 0 && { pmax: Math.max(...pmax) }),
      },
    ]
  })
}
