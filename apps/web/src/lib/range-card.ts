import type { TrajectoryPoint } from '@open-reloading/core'
import { formatNumber, localizeNumber } from '../i18n/number.ts'
import type { Translator } from '../i18n/translate.ts'
import {
  formatQuantity,
  inchText,
  type Quantity,
  roundedFieldText,
  type UnitSystem,
} from './units.ts'

/** A quantity as the fields show it, with its unit; 'not given' without a value. */
function valueText(system: UnitSystem, q: Quantity, x: number | undefined, t: Translator['t']) {
  return x === undefined
    ? t('not given')
    : `${inchText(localizeNumber(roundedFieldText(q, system, x)), system[q].symbol)} ${system[q].symbol}`
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
  dragSource: string | undefined,
  t: Translator['t'],
): { zeroAir?: string; dragFactor?: string } {
  const v = (q: Quantity, x: number | undefined) => valueText(system, q, x, t)
  const zeroSet = [si.zeroTemperature, si.zeroPressure, si.zeroHumidity].some(
    (x) => x !== undefined,
  )
  return {
    ...(zeroSet && {
      zeroAir: t('{temperature}, station pressure {pressure}, humidity {humidity}', {
        temperature: v('temperature', si.zeroTemperature ?? si.temperature),
        pressure: v('airPressure', si.zeroPressure ?? si.pressure),
        humidity: v('percent', si.zeroHumidity ?? si.humidity),
      }),
    }),
    ...(si.dragFactor !== undefined && {
      dragFactor: dragSource
        ? t('{value}, {source}', { value: v('dragFactor', si.dragFactor), source: dragSource })
        : v('dragFactor', si.dragFactor),
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
  manual: boolean,
  dragSource: string | undefined,
  t: Translator['t'],
): [string, string][] {
  const v = (q: Quantity, x: number | undefined) => valueText(system, q, x, t)
  const { zeroAir, dragFactor } = zeroConditions(si, system, dragSource, t)
  return [
    ...(manual
      ? [
          [
            t('Bullet'),
            t('{mass}, BC {bc}', {
              mass: v('mass', si.mass),
              bc: v('ballisticCoefficient', si.ballisticCoefficient),
            }),
          ] as [string, string],
        ]
      : []),
    [t('Muzzle velocity'), v('velocity', si.muzzleVelocity)],
    [t('Zero'), v('range', zero)],
    ...(zeroAir ? [[t('Zero air'), zeroAir] as [string, string]] : []),
    ...(dragFactor ? [[t('Drag factor'), dragFactor] as [string, string]] : []),
    [t('Sight height'), v('length', si.sightHeight)],
    [
      t('Conditions'),
      t('{temperature}, station pressure {pressure}, altitude {altitude}, humidity {humidity}', {
        temperature: v('temperature', si.temperature),
        pressure: v('airPressure', si.pressure),
        altitude: v('altitude', si.altitude),
        humidity: v('percent', si.humidity),
      }),
    ],
    [
      t('Wind'),
      si.windSpeed
        ? t('{speed} from {angle}', {
            speed: v('windSpeed', si.windSpeed),
            angle: v('angle', si.windFrom),
          })
        : t('none'),
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
export function rangeCardColumns(
  system: UnitSystem,
  extras: RangeCardExtras,
  t: Translator['t'],
): string[] {
  const u = (q: Quantity) => system[q].symbol
  const withClicks = (name: string) =>
    extras.click
      ? t('{name} ({unit} / clicks)', { name, unit: u('correction') })
      : t('{name} ({unit})', { name, unit: u('correction') })
  return [
    t('Range ({unit})', { unit: u('range') }),
    t('Height ({unit})', { unit: u('lineOfSightOffset') }),
    withClicks(t('Elevation')),
    t('Windage ({unit})', { unit: u('correction') }),
    t('Velocity ({unit})', { unit: u('velocity') }),
    t('Energy ({unit})', { unit: u('energy') }),
    t('Time (s)'),
    ...(extras.wind ? [withClicks(t('Wind per 1 m/s')), withClicks(t('Wind per 1 mph'))] : []),
    t('Notes'),
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
