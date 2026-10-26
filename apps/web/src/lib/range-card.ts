import type { TrajectoryPoint } from '@open-reloading/core'
import {
  formatNumber,
  formatQuantity,
  inchText,
  type Quantity,
  roundedFieldText,
  type UnitSystem,
} from './units.ts'

/** A quantity as the fields show it, with its unit; 'not given' without a value. */
function valueText(system: UnitSystem, q: Quantity, x: number | undefined) {
  return x === undefined
    ? 'not given'
    : `${inchText(roundedFieldText(q, system, x), system[q].symbol)} ${system[q].symbol}`
}

/**
 * The zero air and the drag factor a result was computed with, as texts; a key is missing when
 * its fields were empty. A zero air field left empty shows the shot's value it took.
 */
export function zeroConditions(
  si: {
    zeroTemperature?: number
    zeroPressure?: number
    zeroHumidity?: number
    dragFactor?: number
    temperature?: number
    pressure?: number
    humidity?: number
  },
  system: UnitSystem,
  dragSource?: string,
): { zeroAir?: string; dragFactor?: string } {
  const v = (q: Quantity, x: number | undefined) => valueText(system, q, x)
  const zeroSet = [si.zeroTemperature, si.zeroPressure, si.zeroHumidity].some(
    (x) => x !== undefined,
  )
  return {
    ...(zeroSet && {
      zeroAir: `${v('temperature', si.zeroTemperature ?? si.temperature)}, station pressure ${v('airPressure', si.zeroPressure ?? si.pressure)}, humidity ${v('percent', si.zeroHumidity ?? si.humidity)}`,
    }),
    ...(si.dragFactor !== undefined && {
      dragFactor: `${v('dragFactor', si.dragFactor)}${dragSource ? `, ${dragSource}` : ''}`,
    }),
  }
}

/**
 * The heading of a printed range card: label and value pairs from the SI inputs a trajectory result
 * was computed with (`si`, keys of `shotFields`) and its zero range (m), written as the fields show
 * them (`roundedFieldText`). `manual`: the bullet came from the manual fields; its mass and BC lead.
 * `dragSource` names where the drag factor comes from.
 */
export function rangeCardFacts(
  si: Record<string, number | undefined>,
  zero: number,
  system: UnitSystem,
  manual = false,
  dragSource?: string,
): [string, string][] {
  const v = (q: Quantity, x: number | undefined) => valueText(system, q, x)
  const { zeroAir, dragFactor } = zeroConditions(si, system, dragSource)
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
    ...(zeroAir ? [['Zero air', zeroAir] as [string, string]] : []),
    ...(dragFactor ? [['Drag factor', dragFactor] as [string, string]] : []),
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

/** What the card adds to a trajectory table: the optic's turret click and the wind brackets. */
export interface RangeCardExtras {
  /** Angle of one turret click, rad: the elevation and wind holds are also given in clicks. */
  click?: number | undefined
  /** Windage hold per 1 m/s and per 1 mph of crosswind at each point, rad. */
  wind?: { mps: number[]; mph: number[] }
}

/** Column headings of the card's table, units included; the last column stays blank for notes. */
export function rangeCardColumns(system: UnitSystem, extras: RangeCardExtras = {}): string[] {
  const u = (q: Quantity) => system[q].symbol
  const withClicks = (name: string) =>
    extras.click ? `${name} (${u('correction')} / clicks)` : `${name} (${u('correction')})`
  return [
    `Range (${u('range')})`,
    `Height (${u('lineOfSightOffset')})`,
    withClicks('Elevation'),
    `Windage (${u('correction')})`,
    `Velocity (${u('velocity')})`,
    `Energy (${u('energy')})`,
    'Time (s)',
    ...(extras.wind ? [withClicks('Wind per 1 m/s'), withClicks('Wind per 1 mph')] : []),
    'Notes',
  ]
}

/** One row of display texts per table point, in the order of `rangeCardColumns` without the notes. */
export function rangeCardRows(
  rows: TrajectoryPoint[],
  system: UnitSystem,
  extras: RangeCardExtras = {},
): string[][] {
  const { click, wind } = extras
  /** A hold in the correction unit, with its clicks when the optic is known. */
  const hold = (rad: number) =>
    click
      ? `${formatQuantity('correction', system, rad)} / ${formatNumber(rad / click, 1)}`
      : formatQuantity('correction', system, rad)
  return rows.map((p, i) => [
    formatQuantity('range', system, p.range),
    formatQuantity('lineOfSightOffset', system, p.height),
    hold(p.elevationHold),
    formatQuantity('correction', system, p.windageHold),
    formatQuantity('velocity', system, p.velocity),
    formatQuantity('energy', system, p.energy),
    formatNumber(p.time, 3),
    ...(wind ? [hold(wind.mps[i] ?? 0), hold(wind.mph[i] ?? 0)] : []),
  ])
}
