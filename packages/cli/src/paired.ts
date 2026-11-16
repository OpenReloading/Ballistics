import { compareKeys } from '@rangefoundry/schema'
import { nth, seededUniforms, percentile as sortedPercentile } from '@rangefoundry/statistics'
import type { Outcome } from './evaluate.ts'
import { isUsed, signedPressureError, signedVelocityError } from './metrics.ts'

/** What a model gave on one row it ran: signed relative errors, (model - printed) / printed. */
export interface RowError {
  /** Position of the row among the rows read, from 0: two runs on the same rows pair by it. */
  row: number
  cartridge: string
  velocity: number
  /** Of a row that prints a pressure in bar. */
  pressure?: number | undefined
  /** The capacity of the row's cartridge is an estimate: the row is never paired. */
  capacity?: 'estimated' | undefined
}

/** Draws and seed of the bootstrap: one fixed seed, so a rerun gives the same standard error. */
const bootstrap = { draws: 2000, seed: 1 }

type Quantity = 'velocity' | 'pressure'

/** The row error of each outcome the model gave a result for. */
export const rowErrors = (outcomes: readonly Outcome[]): RowError[] =>
  outcomes.filter(isUsed).map((o) => {
    const pressure = signedPressureError(o)
    return {
      row: o.index,
      cartridge: o.row.cartridge,
      velocity: signedVelocityError(o),
      ...(pressure !== undefined && { pressure }),
    }
  })

/** The absolute errors of both sides on the rows of one cartridge that both ran. */
interface Cluster {
  baseline: number[]
  candidate: number[]
}

const sorted = (values: readonly number[]) => values.toSorted((a, b) => a - b)

/** Median and P90 of the candidate minus those of the baseline over `clusters`. */
function changeOf(clusters: readonly Cluster[]) {
  const baseline = sorted(clusters.flatMap((c) => c.baseline))
  const candidate = sorted(clusters.flatMap((c) => c.candidate))
  const side = (q: number) => ({
    baseline: sortedPercentile(baseline, q),
    candidate: sortedPercentile(candidate, q),
  })
  return { median: side(0.5), p90: side(0.9) }
}

/** Sample standard deviation; 0 for fewer than two values. */
function deviation(values: readonly number[]) {
  if (values.length < 2) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1))
}

/** The clusters of `byCartridge` in the order of their cartridge ids, the order the bootstrap draws from. */
const ordered = <C>(byCartridge: ReadonlyMap<string, C>) =>
  [...byCartridge].toSorted(([a], [b]) => compareKeys(a, b)).map(([, cluster]) => cluster)

/** The standard deviation of the median and the P90 of `statOf` over {@link bootstrap} draws of whole clusters with replacement. */
function bootstrapErrors<C>(
  clusters: readonly C[],
  statOf: (drawn: readonly C[]) => { median: number; p90: number },
) {
  const uniform = seededUniforms(bootstrap.seed)
  const draws = { median: [] as number[], p90: [] as number[] }
  for (let d = 0; d < bootstrap.draws; d++) {
    // whole cartridges are drawn: the rows of one cartridge share its error, so they are not independent draws
    const drawn = clusters.map(() => nth(clusters, Math.floor(uniform() * clusters.length)))
    const stat = statOf(drawn)
    draws.median.push(stat.median)
    draws.p90.push(stat.p90)
  }
  return { median: deviation(draws.median), p90: deviation(draws.p90) }
}

/** The paired change of one quantity, null without a row both sides ran that has it. */
function quantityChange(
  baseline: ReadonlyMap<number, RowError>,
  candidate: ReadonlyMap<number, RowError>,
  quantity: Quantity,
) {
  const byCartridge = new Map<string, Cluster>()
  let rows = 0
  for (const [row, b] of baseline) {
    const c = candidate.get(row)
    const [eb, ec] = [b[quantity], c?.[quantity]]
    if (eb === undefined || ec === undefined) continue
    const cluster = byCartridge.get(b.cartridge) ?? { baseline: [], candidate: [] }
    cluster.baseline.push(Math.abs(eb))
    cluster.candidate.push(Math.abs(ec))
    byCartridge.set(b.cartridge, cluster)
    rows++
  }
  if (rows === 0) return null
  const clusters = ordered(byCartridge)
  const errors = bootstrapErrors(clusters, (drawn) => {
    const change = changeOf(drawn)
    return {
      median: change.median.candidate - change.median.baseline,
      p90: change.p90.candidate - change.p90.baseline,
    }
  })
  const observed = changeOf(clusters)
  const stat = (key: 'median' | 'p90') => ({
    ...observed[key],
    change: observed[key].candidate - observed[key].baseline,
    standardError: errors[key],
  })
  return { rows, cartridges: clusters.length, median: stat('median'), p90: stat('p90') }
}

/** The change of the median and the P90 of the absolute error, candidate minus baseline, over the rows both sides ran without an estimated capacity, each with the standard error of a bootstrap that draws whole cartridges with replacement ({@link bootstrap}). */
export function pairedChange(baseline: readonly RowError[], candidate: readonly RowError[]) {
  const byRow = (errors: readonly RowError[]) =>
    new Map(errors.flatMap((e) => (e.capacity === 'estimated' ? [] : [[e.row, e] as const])))
  const [b, c] = [byRow(baseline), byRow(candidate)]
  return {
    ...bootstrap,
    velocity: quantityChange(b, c, 'velocity'),
    pressure: quantityChange(b, c, 'pressure'),
  }
}

/** The median and the P90 of the absolute errors of one quantity over the rows of all folds, null without a row that has it. */
function pooledQuantity(errors: readonly RowError[], quantity: Quantity) {
  const byCartridge = new Map<string, number[]>()
  for (const e of errors) {
    const error = e[quantity]
    if (error === undefined) continue
    const cluster = byCartridge.get(e.cartridge) ?? []
    cluster.push(Math.abs(error))
    byCartridge.set(e.cartridge, cluster)
  }
  if (byCartridge.size === 0) return null
  const clusters = ordered(byCartridge)
  const statOf = (drawn: readonly number[][]) => {
    const all = sorted(drawn.flat())
    return { median: sortedPercentile(all, 0.5), p90: sortedPercentile(all, 0.9) }
  }
  const observed = statOf(clusters)
  const standardError = bootstrapErrors(clusters, statOf)
  return {
    rows: clusters.flat().length,
    cartridges: clusters.length,
    median: { value: observed.median, standardError: standardError.median },
    p90: { value: observed.p90, standardError: standardError.p90 },
  }
}

/** The out-of-fold errors of a cross-validation aggregated: the median and the P90 of the absolute error over the rows of every fold, each scored by the fit without its fold, with the standard error of the bootstrap of {@link pairedChange}. */
export function foldAggregate(folds: readonly (readonly RowError[])[]) {
  const errors = folds.flat()
  return {
    ...bootstrap,
    velocity: pooledQuantity(errors, 'velocity'),
    pressure: pooledQuantity(errors, 'pressure'),
  }
}
