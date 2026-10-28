import { fromSi } from '@open-reloading/schema'
import type { Outcome } from './evaluate.ts'
import { reasons } from './evaluate.ts'
import type { Change, Evaluation, Metrics } from './result.ts'
import { byText, percentile } from './stats.ts'

type Used = Outcome & { prediction: { velocity: number; pressure: number } }

const isUsed = (o: Outcome): o is Used => 'velocity' in o.prediction

/** Absolute relative error of the model's velocity against the printed one. */
const velocityError = (o: Used) => Math.abs(o.prediction.velocity - o.row.velocity) / o.row.velocity

/** Distance of the printed velocity from the model's, as a share of the model's: inside the band model * (1 +/- h) when at most h. */
const bandDistance = (o: Used) =>
  Math.abs(o.prediction.velocity - o.row.velocity) / o.prediction.velocity

/** Absolute relative error of the model's peak pressure against the printed one, undefined without a printed one. */
const pressureError = (o: Used) =>
  o.row.pressure === undefined
    ? undefined
    : Math.abs(fromSi('pressure', o.prediction.pressure) - o.row.pressure) / o.row.pressure

const stats = (errors: number[]) =>
  errors.length === 0
    ? null
    : { median: percentile(errors, 0.5) as number, p90: percentile(errors, 0.9) as number }

/** The half width of the 90 % interval: the 90th percentile of the velocity error of the used `training` rows. */
function halfWidthOf(training: readonly Outcome[]) {
  const errors = training.filter(isUsed).map(velocityError)
  return { halfWidth: percentile(errors, 0.9) ?? null, trainingRows: errors.length }
}

/** The metrics of a group of rows; `halfWidth` is the interval of {@link halfWidthOf}. */
function metricsOf(items: readonly Outcome[], halfWidth: number | null): Metrics {
  const used = items.filter(isUsed)
  const velocity = used.map(velocityError)
  const pressure = used.flatMap((o) => pressureError(o) ?? [])
  const pressureStats = stats(pressure)
  return {
    rows: {
      inSplit: items.length,
      used: used.length,
      notUsed: Object.fromEntries(
        reasons.flatMap((reason) => {
          const n = items.filter((o) => 'reason' in o.prediction && o.prediction.reason === reason)
          return n.length > 0 ? [[reason, n.length]] : []
        }),
      ),
    },
    velocity: stats(velocity),
    pressure: pressureStats && { ...pressureStats, rows: pressure.length },
    interval:
      halfWidth === null || velocity.length === 0
        ? null
        : { coverage: used.filter((o) => bandDistance(o) <= halfWidth).length / used.length },
  }
}

/** The groups of `items` by `key`, each with its metrics. */
function grouped(items: readonly Outcome[], key: (o: Outcome) => string, halfWidth: number | null) {
  const groups = new Map<string, Outcome[]>()
  for (const o of items) {
    const list = groups.get(key(o)) ?? []
    list.push(o)
    groups.set(key(o), list)
  }
  return Object.fromEntries(
    [...groups]
      .toSorted(([a], [b]) => byText(a, b))
      .map(([name, list]) => [name, metricsOf(list, halfWidth)]),
  )
}

/** The ways `--group-by` can group the rows of a result. */
export const groupings = ['powder', 'family', 'cartridge', 'bullet', 'construction'] as const

/** One of {@link groupings}. */
export type Grouping = (typeof groupings)[number]

const keyOf: Record<Grouping, (o: Outcome) => string> = {
  powder: (o) => o.row.powder,
  family: (o) => o.family,
  cartridge: (o) => o.row.cartridge,
  bullet: (o) => o.row.bullet,
  construction: (o) => o.construction,
}

/** What one model gave on the rows of `split`, with the interval calibrated on `training`. */
export function evaluate(
  split: readonly Outcome[],
  training: readonly Outcome[],
  by?: Grouping,
): Omit<Evaluation, 'model' | 'modelVersion'> {
  const { halfWidth, trainingRows } = halfWidthOf(training)
  return {
    interval: { basis: 'training', halfWidth, trainingRows },
    overall: metricsOf(split, halfWidth),
    byFamily: grouped(split, keyOf.family, halfWidth),
    byPowder: grouped(split, keyOf.powder, halfWidth),
    ...(by && { grouped: { by, groups: grouped(split, keyOf[by], halfWidth) } }),
  }
}

const difference = (a: number | undefined, b: number | undefined) =>
  a === undefined || b === undefined ? null : b - a

/** The change of every metric from `baseline` to `candidate`. */
export function changeOf(baseline: Metrics | undefined, candidate: Metrics | undefined): Change {
  return {
    usedRows: (candidate?.rows.used ?? 0) - (baseline?.rows.used ?? 0),
    velocityMedian: difference(baseline?.velocity?.median, candidate?.velocity?.median),
    velocityP90: difference(baseline?.velocity?.p90, candidate?.velocity?.p90),
    pressureMedian: difference(baseline?.pressure?.median, candidate?.pressure?.median),
    pressureP90: difference(baseline?.pressure?.p90, candidate?.pressure?.p90),
    intervalCoverage: difference(baseline?.interval?.coverage, candidate?.interval?.coverage),
  }
}
