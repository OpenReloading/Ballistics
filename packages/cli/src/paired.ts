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
  const clusters = [...byCartridge]
    .toSorted(([a], [b]) => compareKeys(a, b))
    .map(([, cluster]) => cluster)
  const uniform = seededUniforms(bootstrap.seed)
  const draws = { median: [] as number[], p90: [] as number[] }
  for (let d = 0; d < bootstrap.draws; d++) {
    // whole cartridges are drawn: the rows of one cartridge share its error, so they are not independent draws
    const drawn = clusters.map(() => nth(clusters, Math.floor(uniform() * clusters.length)))
    const change = changeOf(drawn)
    draws.median.push(change.median.candidate - change.median.baseline)
    draws.p90.push(change.p90.candidate - change.p90.baseline)
  }
  const observed = changeOf(clusters)
  const stat = (key: 'median' | 'p90') => ({
    ...observed[key],
    change: observed[key].candidate - observed[key].baseline,
    standardError: deviation(draws[key]),
  })
  return { rows, cartridges: clusters.length, median: stat('median'), p90: stat('p90') }
}

/** The change of the median and the P90 of the absolute error, candidate minus baseline, over the rows both sides ran, each with the standard error of a bootstrap that draws whole cartridges with replacement ({@link bootstrap}). */
export function pairedChange(baseline: readonly RowError[], candidate: readonly RowError[]) {
  const b = new Map(baseline.map((e) => [e.row, e]))
  const c = new Map(candidate.map((e) => [e.row, e]))
  return {
    ...bootstrap,
    velocity: quantityChange(b, c, 'velocity'),
    pressure: quantityChange(b, c, 'pressure'),
  }
}
