import type { Bullet, Cartridge, PublishedLoads } from '@open-reloading/schema'
import { parseRef } from '@open-reloading/schema'
import type { Records } from './records.ts'
import type { Row } from './rows.ts'
import { percentile } from './stats.ts'

/** Why a printed charge of a published load file gives no row. */
export const skipReasons = ['noVelocity', 'customerTable', 'noPowderRecord', 'noCartridge'] as const

/** One of {@link skipReasons}. */
type SkipReason = (typeof skipReasons)[number]

/** The rows of published load files and the charges left out, by reason. */
export interface PublishedRows {
  rows: Row[]
  /** Charges that give no row, by reason; a reason without charges is left out. */
  skipped: Partial<Record<SkipReason, number>>
}

const id = (ref: string) => parseRef(ref)?.id ?? ref

/** The id of the stand-in bullet of a cartridge and a printed bullet mass (g). */
export const standInId = (cartridge: string, mass: number) =>
  `stand-in-${cartridge}-${Math.round(mass * 1000)}mg`

/**
 * One row per printed charge with a velocity value, of the maker tables only: a table customers
 * sent (`producedBy: customer`) is never read. A load without a powder record and a file whose
 * cartridge is not in `cartridges` (where given) give no row. The row takes:
 * - `charge`, `velocity` (as printed, at the printed point) and `coal` from their `value`;
 * - `pressure` only with a value in bar, so a crusher figure gives a row with its velocity only,
 *   and `pressureBasis` from the pressure's `method`, `unstated` without one;
 * - `muzzleDistance` (m) from `velocity.point.distance`; a velocity without a distance is a muzzle value;
 * - `barrel` from `barrel.length`, `bullet` from `bullet.record`, else the stand-in of
 *   {@link standInId} with the printed mass as `bulletMass`, and `table`, the file id; `line` is the position of the charge in its file.
 */
export function rowsFromPublished(
  files: readonly PublishedLoads[],
  cartridges?: ReadonlySet<string>,
): PublishedRows {
  const rows: Row[] = []
  const skipped: Partial<Record<SkipReason, number>> = {}
  const skip = (reason: SkipReason, n = 1) => {
    skipped[reason] = (skipped[reason] ?? 0) + n
  }
  for (const file of files) {
    const charges = file.loads.reduce((n, l) => n + l.charges.length, 0)
    const cartridge = id(file.cartridge)
    if (file.producedBy === 'customer') skip('customerTable', charges)
    else if (cartridges && !cartridges.has(cartridge)) skip('noCartridge', charges)
    else rows.push(...fileRows(file, cartridge, skip))
  }
  return { rows, skipped }
}

type Load = PublishedLoads['loads'][number]
type Charge = Load['charges'][number]

/** The row of one printed charge with a velocity and a powder record. */
function rowOf(
  file: PublishedLoads,
  cartridge: string,
  load: Load,
  c: Charge & { velocity: NonNullable<Charge['velocity']> },
  powder: string,
  line: number,
): Row {
  const bullet = load.bullet.record
  const distance = c.velocity.point?.distance
  return {
    line,
    cartridge,
    bullet: bullet ? id(bullet) : standInId(cartridge, load.bullet.mass.value),
    ...(bullet === undefined && { bulletMass: load.bullet.mass.value }),
    powder: id(powder),
    charge: c.charge.value,
    velocity: c.velocity.value,
    pressure: c.pressure?.peak.value,
    pressureBasis: c.pressure && (c.pressure.method ?? 'unstated'),
    muzzleDistance: distance && distance.value / 1000,
    barrel: load.barrel?.length?.value,
    coal: load.coal?.value,
    table: file.id,
  }
}

/** The rows of one maker table. */
function fileRows(
  file: PublishedLoads,
  cartridge: string,
  skip: (reason: SkipReason) => void,
): Row[] {
  const rows: Row[] = []
  let line = 0
  for (const load of file.loads)
    for (const c of load.charges) {
      line++
      const { velocity } = c
      const powder = load.powder.record
      if (velocity === undefined) skip('noVelocity')
      else if (powder === undefined) skip('noPowderRecord')
      else rows.push(rowOf(file, cartridge, load, { ...c, velocity }, powder, line))
    }
  return rows
}

/** A cartridge value of the cartridge column (`side: cartridge`). */
const cartridgeValue = (c: Cartridge | undefined, symbol: string) =>
  c?.values.find((v) => v.symbol === symbol && v.side === 'cartridge')?.value

type Vector = [number, number, number]

/** The determinant of the 3 x 3 matrix of columns `a`, `b`, `c`. */
const det = ([a0, a1, a2]: Vector, [b0, b1, b2]: Vector, [c0, c1, c2]: Vector) =>
  a0 * (b1 * c2 - b2 * c1) - b0 * (a1 * c2 - a2 * c1) + c0 * (a1 * b2 - a2 * b1)

/**
 * The bullet length (mm) the bullet records give for a mass (g) and diameter (mm): the log-linear
 * least-squares fit ln L = a + b ln m + c ln d over every bullet record with a length, solved from
 * the normal equations; undefined with fewer than 3 such records or a singular system.
 */
export function lengthModel(bullets: Iterable<Bullet>) {
  const points = [...bullets].flatMap((b) =>
    b.length && b.diameter
      ? [
          {
            x: [1, Math.log(b.mass.value), Math.log(b.diameter.value)] as Vector,
            y: Math.log(b.length.value),
          },
        ]
      : [],
  )
  if (points.length < 3) return
  // the columns of X'X and X'y
  const column = (j: 0 | 1 | 2): Vector => {
    const out: Vector = [0, 0, 0]
    for (const { x } of points) for (const i of [0, 1, 2] as const) out[i] += x[i] * x[j]
    return out
  }
  const [c0, c1, c2] = [column(0), column(1), column(2)]
  const rhs: Vector = [0, 0, 0]
  for (const { x, y } of points) for (const i of [0, 1, 2] as const) rhs[i] += x[i] * y
  const d = det(c0, c1, c2)
  if (Math.abs(d) < 1e-9) return
  const a = det(rhs, c1, c2) / d
  const b = det(c0, rhs, c2) / d
  const c = det(c0, c1, rhs) / d
  return (mass: number, diameter: number) =>
    Math.exp(a + b * Math.log(mass) + c * Math.log(diameter))
}

/**
 * The inputs published rows do not carry, as `apps/docs/docs/models/validation.md` takes them:
 * - a stand-in bullet record per cartridge and printed mass (the id of {@link standInId}): the
 *   cartridge's G1 as diameter, the printed mass, and the length of {@link lengthModel}; no
 *   construction, no drag, so a stand-in row printed at a distance is not corrected;
 * - a row without a barrel length takes the median printed barrel of its cartridge, else 610 mm for
 *   a case (L3) longer than 33 mm and 120 mm for a shorter one.
 * Returns the rows and adds the stand-ins to `records.bullets`.
 */
export function fillInputs(rows: readonly Row[], records: Records): Row[] {
  const length = lengthModel(records.bullets.values())
  for (const row of rows) {
    if (records.bullets.has(row.bullet) || !row.bullet.startsWith('stand-in-')) continue
    const cartridge = records.cartridges.get(row.cartridge)
    const diameter = cartridgeValue(cartridge, 'G1')
    const mass = row.bulletMass
    if (diameter === undefined || mass === undefined || !length) continue
    records.bullets.set(row.bullet, standIn(row.bullet, mass, diameter, length(mass, diameter)))
  }
  const barrels = new Map<string, number[]>()
  for (const r of rows)
    if (r.barrel !== undefined)
      barrels.set(r.cartridge, [...(barrels.get(r.cartridge) ?? []), r.barrel])
  return rows.map((r) => {
    if (r.barrel !== undefined) return r
    const median = percentile(barrels.get(r.cartridge) ?? [], 0.5)
    const caseLength = cartridgeValue(records.cartridges.get(r.cartridge), 'L3')
    const barrel = median ?? (caseLength === undefined ? undefined : caseLength > 33 ? 610 : 120)
    return { ...r, barrel }
  })
}

/** A bullet record that stands in for a printed bullet without a record. */
function standIn(id: string, mass: number, diameter: number, length: number): Bullet {
  return {
    id,
    manufacturer: 'stand-in',
    name: `Stand-in ${mass} g`,
    nameOnly: true,
    mass: { value: mass },
    diameter: { value: diameter },
    length: { value: length },
    provenance: {
      kind: 'derived',
      sources: [
        { title: 'Stand-in of the command line: cartridge G1, printed mass, modelled length' },
      ],
    },
  } as Bullet
}
