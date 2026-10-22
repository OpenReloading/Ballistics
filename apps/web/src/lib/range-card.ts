import type { TrajectoryPoint } from '@openreloading/core'
import {
  formatNumber,
  formatQuantity,
  inchText,
  type Quantity,
  roundedFieldText,
  type UnitSystem,
} from './units.ts'

/**
 * The heading of a printed range card: label and value pairs from the SI inputs a trajectory result
 * was computed with (`si`, keys of `shotFields`) and its zero range (m), written as the fields show
 * them (`roundedFieldText`). `manual`: the bullet came from the manual fields; its mass and BC lead.
 */
export function rangeCardFacts(
  si: Record<string, number | undefined>,
  zero: number,
  system: UnitSystem,
  manual = false,
): [string, string][] {
  const v = (q: Quantity, x: number | undefined) =>
    x === undefined
      ? 'not given'
      : `${inchText(roundedFieldText(q, system, x), system[q].symbol)} ${system[q].symbol}`
  return [
    ...(manual
      ? [
          [
            'Bullet',
            `${v('mass', si.mass)}, BC ${v('ballisticCoefficient', si.ballisticCoefficient)}`,
          ] as [string, string],
        ]
      : []),
    ['Muzzle velocity', v('velocity', si.muzzleVelocity)],
    ['Zero', v('range', zero)],
    ['Sight height', v('length', si.sightHeight)],
    [
      'Conditions',
      `${v('temperature', si.temperature)}, station pressure ${v('airPressure', si.pressure)}, altitude ${v('altitude', si.altitude)}, humidity ${v('percent', si.humidity)}`,
    ],
    [
      'Wind',
      si.windSpeed ? `${v('windSpeed', si.windSpeed)} from ${v('angle', si.windFrom)}` : 'none',
    ],
  ]
}

/** Column headings of the card's table, units included; the last column stays blank for notes. */
export function rangeCardColumns(system: UnitSystem): string[] {
  const u = (q: Quantity) => system[q].symbol
  return [
    `Range (${u('range')})`,
    `Height (${u('lineOfSightOffset')})`,
    `Elevation (${u('correction')})`,
    `Windage (${u('correction')})`,
    `Velocity (${u('velocity')})`,
    `Energy (${u('energy')})`,
    'Time (s)',
    'Clicks, notes',
  ]
}

/** One row of display texts per table point, in the order of `rangeCardColumns` without the notes. */
export function rangeCardRows(rows: TrajectoryPoint[], system: UnitSystem): string[][] {
  return rows.map((p) => [
    formatQuantity('range', system, p.range),
    formatQuantity('lineOfSightOffset', system, p.height),
    formatQuantity('correction', system, p.elevationHold),
    formatQuantity('correction', system, p.windageHold),
    formatQuantity('velocity', system, p.velocity),
    formatQuantity('energy', system, p.energy),
    formatNumber(p.time, 3),
  ])
}
