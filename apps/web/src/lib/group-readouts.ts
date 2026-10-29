/** Readout rows of a group's statistics: sizes in m with their angles and intervals. */
import { type GroupStatistics, subtendedAngle } from '@open-reloading/core'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
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
  label: Message
  help: Message
  value: number
  angle: number
  interval?: Interval | undefined
  /** CEP only: the circular-normal estimate `cep` and its interval, for the hover detail. */
  circular?: { value: number; interval?: Interval | undefined } | undefined
}

/** Key, label and definition of each readout row, in display order. */
export const readoutRows = [
  [
    'extremeSpread',
    msg('ES'),
    msg('Extreme spread: largest distance between two shots, centre to centre.'),
  ],
  ['width', msg('Width'), msg('Range of the horizontal coordinates.')],
  ['height', msg('Height'), msg('Range of the vertical coordinates.')],
  ['meanRadius', msg('Mean radius'), msg('Mean distance of the shots from the group centre.')],
  [
    'minPairDistance',
    msg('Min. pair'),
    msg(
      'Smallest distance between two shots, centre to centre; describes the shots fired, no interval.',
    ),
  ],
  [
    'meanPairDistance',
    msg('Mean pair'),
    msg(
      'Mean distance over all pairs of shots, centre to centre; describes the shots fired, no interval.',
    ),
  ],
  ['standardDeviationX', msg('SD horiz.'), msg('Sample standard deviation of x (divisor n - 1).')],
  ['standardDeviationY', msg('SD vert.'), msg('Sample standard deviation of y (divisor n - 1).')],
  [
    'radialStandardDeviation',
    msg('Radial SD'),
    msg('Square root of the sum of both axis variances (divisor n - 1).'),
  ],
  [
    'cepElliptical',
    msg('CEP'),
    msg(
      'Circular error probable: radius about the group centre holding half of a normal spread with the sample covariance, for any ratio and direction of the axes.',
    ),
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
export function statLines(
  s: GroupStatistics,
  rows: Readout[],
  system: UnitSystem,
  { t, tn }: Pick<Translator, 't' | 'tn'>,
): string[] {
  return [
    s.excludedCount
      ? tn(s.shotCount, '{count} shot + {excluded} excl.', '{count} shots + {excluded} excl.', {
          excluded: s.excludedCount,
        })
      : tn(s.shotCount, '{count} shot', '{count} shots'),
    ...rows
      .filter((r) => keyReadouts.includes(r.key))
      .map(
        (r) =>
          `${t(r.label)} ${withUnit('length', system, r.value)}, ${withUnit('correction', system, r.angle)}`,
      ),
  ]
}
