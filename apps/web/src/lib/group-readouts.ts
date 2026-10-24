/** Readout rows of a group's statistics: sizes in m with their angles and intervals. */
import { type GroupStatistics, subtendedAngle } from '@open-reloading/core'
import { type UnitSystem, withUnit } from './units.ts'

/**
 * A two-sided interval of a readout at `level` with `df` degrees of freedom; `circular` when it
 * assumes equal, uncorrelated axes (radial SD, CEP).
 */
export type Interval = {
  lower: number
  upper: number
  level: number
  degreesOfFreedom: number
  circular: boolean
}

/** One readout: a size in m with its angle at the group's distance, and its interval if any. */
type Readout = {
  key: string
  label: string
  help: string
  value: number
  angle: number
  interval?: Interval
  /** CEP only: the circular-normal estimate `cep` and its interval, for the hover detail. */
  circular?: { value: number; interval?: Interval }
}

/** Key, label and definition of each readout row, in display order. */
export const readoutRows = [
  ['extremeSpread', 'ES', 'Extreme spread: largest distance between two shots, centre to centre.'],
  ['width', 'Width', 'Range of the horizontal coordinates.'],
  ['height', 'Height', 'Range of the vertical coordinates.'],
  ['meanRadius', 'Mean radius', 'Mean distance of the shots from the group centre.'],
  [
    'minPairDistance',
    'Min. pair',
    'Smallest distance between two shots, centre to centre; describes the shots fired, no interval.',
  ],
  [
    'meanPairDistance',
    'Mean pair',
    'Mean distance over all pairs of shots, centre to centre; describes the shots fired, no interval.',
  ],
  ['standardDeviationX', 'SD horiz.', 'Sample standard deviation of x (divisor n - 1).'],
  ['standardDeviationY', 'SD vert.', 'Sample standard deviation of y (divisor n - 1).'],
  [
    'radialStandardDeviation',
    'Radial SD',
    'Square root of the sum of both axis variances (divisor n - 1).',
  ],
  [
    'cepElliptical',
    'CEP',
    'Circular error probable: radius about the group centre holding half of a normal spread with the sample covariance, for any ratio and direction of the axes.',
  ],
] as const

/** Readout rows of a group's statistics at `distance` m; values the statistics leave out are left out. */
export function readouts(s: GroupStatistics, distance: number): Readout[] {
  const ci = s.confidence
  const intervalOf = (
    key: 'standardDeviationX' | 'standardDeviationY' | 'radialStandardDeviation' | 'cep',
  ): Interval | undefined => {
    if (!ci) return undefined
    const axis = key === 'standardDeviationX' || key === 'standardDeviationY'
    return {
      ...ci[key],
      level: ci.confidenceLevel,
      degreesOfFreedom: axis ? ci.axisDegreesOfFreedom : ci.circularDegreesOfFreedom,
      circular: !axis,
    }
  }
  return readoutRows.flatMap(([key, label, help]) => {
    const value = s[key]
    if (value === undefined) return []
    const interval =
      key === 'standardDeviationX' ||
      key === 'standardDeviationY' ||
      key === 'radialStandardDeviation'
        ? intervalOf(key)
        : undefined
    return [
      {
        key,
        label,
        help,
        value,
        angle: subtendedAngle(value, distance),
        ...(interval && { interval }),
        ...(key === 'cepElliptical' &&
          s.cep !== undefined && { circular: { value: s.cep, interval: intervalOf('cep') } }),
      },
    ]
  })
}

/** The readouts of the statistics box, the image export and the compact workbench tab. */
export const keyReadouts: string[] = ['extremeSpread', 'meanRadius', 'cepElliptical']

/**
 * The statistics box text of a group below its name: the shot count, then each key readout of
 * `rows` (the group's `readouts`) in length and angle.
 */
export function statLines(s: GroupStatistics, rows: Readout[], system: UnitSystem): string[] {
  return [
    `${s.shotCount} shots${s.excludedCount ? ` + ${s.excludedCount} excl.` : ''}`,
    ...rows
      .filter((r) => keyReadouts.includes(r.key))
      .map(
        (r) =>
          `${r.label} ${withUnit('length', system, r.value)}, ${withUnit('correction', system, r.angle)}`,
      ),
  ]
}
