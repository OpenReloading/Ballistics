import {
  type DragModel,
  densityAltitude,
  firstLowStability,
  icao,
  type Projectile,
  type Trajectory,
  type TrajectoryInput,
  type TrajectoryPoint,
  trajectory,
} from '@openreloading/core'
import type { FieldSpec } from './field-spec.ts'
import { metersPerSecondPerMph } from './units.ts'

/** Points of the chart, evenly spaced from 0 to the largest range. */
const chartPoints = 101

/** Most rows one computation returns: the API cap of `POST /exterior/trajectory`. */
const maxTableRows = 500

export const shotFields = [
  { key: 'muzzleVelocity', label: 'Muzzle velocity', quantity: 'velocity', required: true, min: 0 },
  {
    key: 'sightHeight',
    label: 'Sight height above the bore',
    quantity: 'length',
    required: true,
    min: 0,
  },
  {
    key: 'twist',
    label: 'Twist, length per turn (optional)',
    help: 'Needed for spin drift, aerodynamic jump and stability.',
    quantity: 'twist',
    min: 0,
  },
  {
    key: 'zeroRange',
    label: 'Zero range',
    quantity: 'range',
    required: true,
    min: 0,
    initial: 100,
  },
  {
    key: 'temperature',
    label: 'Temperature',
    quantity: 'temperature',
    required: true,
    initial: icao.temperature,
  },
  {
    key: 'pressure',
    label: 'Station pressure',
    help: 'Absolute, not reduced to sea level.',
    quantity: 'airPressure',
    required: true,
    min: 0,
    initial: icao.pressure,
  },
  { key: 'altitude', label: 'Altitude', quantity: 'altitude', required: true, initial: 0 },
  {
    key: 'humidity',
    label: 'Relative humidity',
    quantity: 'percent',
    required: true,
    min: 0,
    max: 100,
    initial: 0,
  },
  {
    key: 'windSpeed',
    label: 'Wind speed',
    quantity: 'windSpeed',
    required: true,
    min: 0,
    initial: 0,
  },
  {
    key: 'windFrom',
    label: 'Wind from',
    help: 'Clockwise from the line of fire: 0 head wind, 90 from the right.',
    quantity: 'angle',
    required: true,
    min: 0,
    max: 360,
    initial: Math.PI / 2,
  },
  {
    key: 'maxRange',
    label: 'Largest range',
    quantity: 'range',
    required: true,
    min: 0,
    initial: 1000,
  },
  {
    key: 'rangeStep',
    label: 'Range step',
    quantity: 'range',
    required: true,
    min: 1,
    initial: 100,
  },
] as const satisfies readonly FieldSpec[]

export const manualBulletFields = [
  { key: 'mass', label: 'Bullet mass', quantity: 'mass', required: true, min: 0 },
  { key: 'diameter', label: 'Bullet diameter', quantity: 'length', required: true, min: 0 },
  { key: 'length', label: 'Bullet length (optional)', quantity: 'length', min: 0 },
  {
    key: 'ballisticCoefficient',
    label: 'Ballistic coefficient',
    quantity: 'ballisticCoefficient',
    required: true,
    min: 0,
  },
] as const satisfies readonly FieldSpec[]

export type ShotKey = (typeof shotFields)[number]['key']
export type ManualKey = (typeof manualBulletFields)[number]['key']

type Values = Record<string, number | undefined>

/** The SI value of a required field, or a RangeError naming it. */
function requireValue(values: Values, specs: readonly FieldSpec[], key: string): number {
  const x = values[key]
  if (x === undefined || !Number.isFinite(x)) {
    const label = specs.find((s) => s.key === key)?.label ?? key
    throw new RangeError(`Enter a number for ${label}.`)
  }
  return x
}

/** Ranges 0, step, 2 step ... up to max, plus max when it is not a multiple (SI, m). */
export function rangeSteps(max: number, step: number): number[] {
  if (!(max > 0) || !(step > 0))
    throw new RangeError('The largest range and the step must be above 0.')
  const n = Math.floor(max / step + 1e-9)
  if (n + 1 > maxTableRows)
    throw new RangeError(`More than ${maxTableRows} rows; choose a larger step.`)
  const list = Array.from({ length: n + 1 }, (_, k) => k * step)
  if (Math.abs(list[n] - max) <= 1e-9 * max) list[n] = max
  else list.push(max)
  if (list.length > maxTableRows)
    throw new RangeError(`More than ${maxTableRows} rows; choose a larger step.`)
  return list
}

/** Core `TrajectoryInput` from SI field values; zero air is the shot air and the zero has no wind (core defaults). */
export function shotFromValues(
  values: Values,
  projectile: Projectile,
  twistHand: 'right' | 'left',
): TrajectoryInput {
  const v = (key: string) => requireValue(values, shotFields, key)
  const twist = values.twist
  const windSpeed = v('windSpeed')
  return {
    projectile,
    muzzleVelocity: v('muzzleVelocity'),
    firearm: { sightHeight: v('sightHeight'), ...(twist !== undefined && { twist }), twistHand },
    air: {
      temperature: v('temperature'),
      pressure: v('pressure'),
      altitude: v('altitude'),
      humidity: v('humidity'),
    },
    ...(windSpeed > 0 && {
      wind: [{ endDistance: v('maxRange'), speed: windSpeed, fromDirection: v('windFrom') }],
    }),
    zero: { range: v('zeroRange') },
  }
}

/** Core `Projectile` from the manual bullet fields (SI). */
export function manualProjectile(values: Values, model: DragModel): Projectile {
  const v = (key: string) => requireValue(values, manualBulletFields, key)
  const length = values.length
  return {
    mass: v('mass'),
    diameter: v('diameter'),
    ...(length !== undefined && { length }),
    drag: {
      kind: 'bc',
      model,
      bands: [{ ballisticCoefficient: v('ballisticCoefficient'), minVelocity: 0 }],
    },
  }
}

/**
 * The windage hold the shot needs per 1 m/s and per 1 mph of wind from the right at each of
 * `points`, as a difference to the shot without wind, rad. Magnitudes: wind from the left holds the
 * other way.
 */
function windPerUnit(shot: TrajectoryInput, points: readonly TrajectoryPoint[]) {
  const ranges = points.map((p) => p.range)
  const { wind: _, ...calm } = shot
  const hold = (speed: number) => {
    const t = trajectory(
      speed > 0
        ? {
            ...calm,
            wind: [
              { endDistance: 2 * (ranges.at(-1) ?? 0) + 1, speed, fromDirection: Math.PI / 2 },
            ],
          }
        : calm,
      ranges,
    )
    return new Map(t.points.map((p) => [p.range, p.windageHold]))
  }
  const base = hold(0)
  const per = (speed: number) => {
    const run = hold(speed)
    return ranges.map((r) => Math.abs((run.get(r) ?? 0) - (base.get(r) ?? 0)))
  }
  return { mps: per(1), mph: per(metersPerSecondPerMph) }
}

export type TrajectoryResult = {
  trajectory: Trajectory
  /** Points at the table ranges. */
  tablePoints: TrajectoryPoint[]
  /** Points at the chart ranges. */
  chartPoints: TrajectoryPoint[]
  /** Zero range used, m. */
  zeroRange: number
  /** Windage hold per 1 m/s and per 1 mph of crosswind at each table point, rad. */
  windPerUnit: { mps: number[]; mph: number[] }
  /** Density altitude of the shot's air, m. */
  densityAltitude: number
  /** Where Miller's factor first falls below `minStability` along the flight; none without length and twist. */
  lowStability?: { range: number; stability: number }
}

/** Table and chart points of one shot from SI field values; throws the input and core errors. */
export function trajectoryResult(
  values: Values,
  projectile: Projectile,
  twistHand: 'right' | 'left',
): TrajectoryResult {
  const table = rangeSteps(values.maxRange ?? Number.NaN, values.rangeStep ?? Number.NaN)
  const max = table[table.length - 1]
  const chart = Array.from({ length: chartPoints }, (_, k) => (k * max) / (chartPoints - 1))
  const shot = shotFromValues(values, projectile, twistHand)
  const t = trajectory(shot, [...table, ...chart])
  const { length } = projectile
  const { twist } = shot.firearm
  const low =
    length !== undefined && twist !== undefined
      ? firstLowStability(
          { mass: projectile.mass, diameter: projectile.diameter, length, twist },
          shot.air,
          t.points,
        )
      : undefined
  const byRange = new Map(t.points.map((pt) => [pt.range, pt]))
  // an early stop leaves out the ranges past it
  const pick = (ranges: number[]) => ranges.flatMap((r) => byRange.get(r) ?? [])
  const tablePoints = pick(table)
  return {
    trajectory: t,
    tablePoints,
    chartPoints: pick(chart),
    zeroRange: requireValue(values, shotFields, 'zeroRange'),
    windPerUnit: windPerUnit(shot, tablePoints),
    densityAltitude: densityAltitude(shot.air),
    ...(low && { lowStability: low }),
  }
}
