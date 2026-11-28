import { handgunBarrelLengthLimit } from '@rangefoundry/ballistics'
import { compareKeys, fromSi } from '@rangefoundry/schema'
import { percentile } from '@rangefoundry/statistics'
import type { Outcome } from './evaluate.ts'
import { reasons } from './evaluate.ts'
import { basisOf } from './fit.ts'
import type { Change, Evaluation, Metrics } from './result.ts'

type Used = Outcome & { prediction: { velocity: number; pressure: number } }

/** Whether the model gave a result for the row. */
export const isUsed = (o: Outcome): o is Used => 'velocity' in o.prediction

/** Relative error of the model's velocity against the printed one, signed: (model - printed) / printed. */
export const signedVelocityError = (o: Used) =>
  (o.prediction.velocity - o.row.velocity) / o.row.velocity

const velocityError = (o: Used) => Math.abs(signedVelocityError(o))

/** Distance of the printed velocity from the model's, as a share of the model's: inside the band model * (1 +/- h) when at most h. */
const bandDistance = (o: Used) =>
  Math.abs(o.prediction.velocity - o.row.velocity) / o.prediction.velocity

/** Relative error of the model's peak pressure against the printed one in bar, signed as the velocity's; undefined without a printed one. */
export const signedPressureError = (o: Used) =>
  o.row.pressure === undefined
    ? undefined
    : (fromSi('pressure', o.prediction.pressure) - o.row.pressure) / o.row.pressure

const pressureError = (o: Used) => {
  const error = signedPressureError(o)
  return error === undefined ? undefined : Math.abs(error)
}

/** Percentile `q` (0 to 1) of `values`, at least one. */
const percentileOf = (values: readonly number[], q: number) =>
  percentile(
    values.toSorted((a, b) => a - b),
    q,
  )

/** The median and the P90 of `errors`, at least one. */
const summary = (errors: readonly number[]) => ({
  median: percentileOf(errors, 0.5),
  p90: percentileOf(errors, 0.9),
})

const stats = (errors: readonly number[]) => (errors.length === 0 ? null : summary(errors))

/** The classes of {@link barrelClassOf}. */
export const barrelClasses = ['handgun', 'rifle'] as const

/** One of {@link barrelClasses}. */
export type BarrelClass = (typeof barrelClasses)[number]

/** The class of a barrel length in mm: `handgun` under `handgunBarrelLengthLimit`, the limit of the start-pressure rule, else `rifle`; undefined without a length. */
export function barrelClassOf(barrel: number | undefined): BarrelClass | undefined {
  if (barrel === undefined) return undefined
  return barrel < handgunBarrelLengthLimit * 1000 ? 'handgun' : 'rifle'
}

/** `valueOf` of the rows of each barrel class in `used`; a class without a row is left out. */
const perBarrel = <T>(used: readonly Used[], valueOf: (rows: Used[]) => T) =>
  Object.fromEntries(
    barrelClasses.flatMap((barrel) => {
      const rows = used.filter((o) => barrelClassOf(o.row.barrel) === barrel)
      return rows.length > 0 ? [[barrel, valueOf(rows)] as const] : []
    }),
  )

/** The velocity and pressure errors of `used`. */
function errorsOf(used: readonly Used[]) {
  const pressure = used.flatMap((o) => pressureError(o) ?? [])
  const pressureStats = stats(pressure)
  return {
    velocity: stats(used.map(velocityError)),
    pressure: pressureStats && { ...pressureStats, rows: pressure.length },
  }
}

/** The half width of the 90 % interval per barrel class: the 90th percentile of the band distance of the used `training` rows of the class, the distance the coverage tests. */
export function halfWidthOf(training: readonly Outcome[]) {
  const used = training.filter(isUsed)
  return {
    byBarrel: perBarrel(used, (rows) => ({
      halfWidth: percentileOf(rows.map(bandDistance), 0.9),
      trainingRows: rows.length,
    })),
    trainingRows: used.length,
  }
}

/** The half widths per class of {@link halfWidthOf}. */
type HalfWidths = { readonly [barrel in BarrelClass]?: { readonly halfWidth: number } }

/** The half width of the class of a row under `byBarrel`; null for a class without one. */
export const widthByBarrel =
  (byBarrel: HalfWidths = {}) =>
  (o: Outcome) => {
    const barrel = barrelClassOf(o.row.barrel)
    return (barrel && byBarrel[barrel]?.halfWidth) ?? null
  }

/** The half width for every row, or per row: that of its class, in a cross-validation that of its class in its fold. */
export type HalfWidth = number | null | ((o: Outcome) => number | null)

/** The metrics of a group of rows; `halfWidth` is the interval of {@link halfWidthOf}, coverage null when a used row has none. */
export function metricsOf(items: readonly Outcome[], halfWidth: HalfWidth): Metrics {
  const used = items.filter(isUsed)
  const widthOf = typeof halfWidth === 'function' ? halfWidth : () => halfWidth
  const covered = used.filter((o) => {
    const width = widthOf(o)
    return width !== null && bandDistance(o) <= width
  })
  const bases = new Map<string, number[]>()
  for (const o of used) {
    const error = pressureError(o)
    if (error === undefined) continue
    const basis = basisOf(o.row)
    bases.set(basis, [...(bases.get(basis) ?? []), error])
  }
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
    ...errorsOf(used),
    byBarrel: perBarrel(used, (rows) => ({ rows: rows.length, ...errorsOf(rows) })),
    pressureByBasis: Object.fromEntries(
      [...bases]
        .toSorted(([a], [b]) => compareKeys(a, b))
        .map(([basis, errors]) => [basis, { ...summary(errors), rows: errors.length }]),
    ),
    interval:
      used.length === 0 || used.some((o) => widthOf(o) === null)
        ? null
        : { coverage: covered.length / used.length },
  }
}

/** The groups of `items` by `key`, each with its metrics. */
function grouped(items: readonly Outcome[], key: (o: Outcome) => string, halfWidth: HalfWidth) {
  const groups = new Map<string, Outcome[]>()
  for (const o of items) {
    const list = groups.get(key(o)) ?? []
    list.push(o)
    groups.set(key(o), list)
  }
  return Object.fromEntries(
    [...groups]
      .toSorted(([a], [b]) => compareKeys(a, b))
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

/** The metrics of the rows of `split`, all together and by family, powder and `by`. */
export function groupsOf(split: readonly Outcome[], halfWidth: HalfWidth, by?: Grouping) {
  return {
    overall: metricsOf(split, halfWidth),
    byFamily: grouped(split, keyOf.family, halfWidth),
    byPowder: grouped(split, keyOf.powder, halfWidth),
    ...(by && { grouped: { by, groups: grouped(split, keyOf[by], halfWidth) } }),
  }
}

/** What one model gave on the rows of `split`, with the interval calibrated on `training`. */
export function evaluate(
  split: readonly Outcome[],
  training: readonly Outcome[],
  by?: Grouping,
): Omit<Evaluation, 'model' | 'modelVersion'> {
  const { byBarrel, trainingRows } = halfWidthOf(training)
  return {
    interval: { basis: 'training', byBarrel, trainingRows },
    ...groupsOf(split, widthByBarrel(byBarrel), by),
  }
}

const difference = (a: number | undefined, b: number | undefined) =>
  a === undefined || b === undefined ? null : b - a

/** The change of every metric from `baseline` to `candidate`. */
export function changeOf(baseline: Metrics | undefined, candidate: Metrics | undefined): Change {
  const change = (pick: (m: Metrics) => number | undefined) =>
    difference(baseline && pick(baseline), candidate && pick(candidate))
  return {
    usedRows: (candidate?.rows.used ?? 0) - (baseline?.rows.used ?? 0),
    velocityMedian: change((m) => m.velocity?.median),
    velocityP90: change((m) => m.velocity?.p90),
    pressureMedian: change((m) => m.pressure?.median),
    pressureP90: change((m) => m.pressure?.p90),
    intervalCoverage: change((m) => m.interval?.coverage),
  }
}
