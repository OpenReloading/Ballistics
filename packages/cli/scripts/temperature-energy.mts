/**
 * The measured check of the propellant-temperature energy term
 * (`apps/docs/docs/research/propellant-temperature-energy.md`), run by the owner on rows that are
 * not in the repository. It prints aggregates only: no record id, row, charge or temperature.
 *
 *   npm run build
 *   node packages/cli/scripts/temperature-energy.mts --rows <rows.csv|folder> [--records <dir>]
 *
 * Rows are the CLI's (`apps/docs/docs/cli.md`, Rows) with `temperature_c` on every row. A ladder is
 * the rows of one powder, cartridge, bullet, barrel, COAL and rifle. Per ladder and span, fit (A)
 * the current model with the burn rate and the shared temperature factor free, and (B) the same
 * with the energy coefficient fixed at 0.0003 1/K, then predict the held-out rows:
 * - interpolating: fit on the coldest and the hottest temperature (at least 20 K apart), hold out
 *   the temperatures between;
 * - extrapolating: hold out the hottest temperature, fit on the temperatures at least 20 K colder
 *   (two or more).
 * Rule of the issue (#367): the term is supported when (B) has a pooled RMS at least 15 % lower
 * than (A) for velocity (m/s) and for pressure (%) at both spans.
 */
import { parseArgs } from 'node:util'
import {
  fitPowder,
  type InteriorLoad,
  interior,
  type LadderPoint,
  type PressureBasis,
} from '@open-reloading/core'
import { toSi } from '@open-reloading/schema'
import { atMuzzle, loadOf } from '../src/evaluate.ts'
import { loadRecords, type Records } from '../src/records.ts'
import { type Row, readRows } from '../src/rows.ts'

/** The coefficient of the synthetic study, unverified. */
const energyCoefficient = 3e-4
/** Burn sensitivity a powder record without one starts from, 1/K: the study's assumption, unverified. */
const assumedSensitivity = 0.004
/** Weights of the fit: the study's noise, 3 m/s per string mean and 3 % of a pressure. */
const velocitySigma = 3
const pressureShare = 0.03
const minSpan = 20
const bases: readonly string[] = ['transducer', 'piezo', 'case-contact', 'crusher', 'energy']

type Model = 'A' | 'B'
type SpanName = 'interpolating' | 'extrapolating'

interface Sums {
  velocity: number
  velocityRows: number
  pressure: number
  pressureRows: number
}

export interface Aggregate {
  notice: 'simulation, not load data'
  ladders: number
  rows: number
  /** Ladders or rows left out, by reason. */
  skipped: Record<string, number>
  spans: Record<
    SpanName,
    {
      ladders: number
      failedFits: number
      rms: Record<Model, { velocity: number | null; pressure: number | null }>
      heldOut: { velocity: number; pressure: number }
      /** RMS of B against A, percent; negative is lower. */
      change: { velocity: number | null; pressure: number | null }
    }
  >
  supported: boolean
}

const kelvin = (c: number) => toSi('temperature', c)
const count = (m: Record<string, number>, k: string) => {
  m[k] = (m[k] ?? 0) + 1
}

/** The ladders of `rows`: each row at the muzzle with its load, grouped by setup. */
function laddersOf(rows: readonly Row[], records: Records, skipped: Record<string, number>) {
  const ladders = new Map<string, { row: Row; load: InteriorLoad }[]>()
  for (const raw of rows) {
    if (raw.temperature === undefined) {
      count(skipped, 'noTemperature')
      continue
    }
    const row = atMuzzle(raw, records)
    if ('reason' in row) {
      count(skipped, row.reason)
      continue
    }
    const load = loadOf(row, records)
    if (typeof load === 'string') {
      count(skipped, load)
      continue
    }
    const key = [row.powder, row.cartridge, row.bullet, row.barrel, row.coal, row.rifle].join('|')
    ladders.set(key, [
      ...(ladders.get(key) ?? []),
      { row, load: withReference(load, row, records) },
    ])
  }
  return [...ladders.values()]
}

/** The fit and held-out rows of each span of a ladder; a span the temperatures do not give is absent. */
export function spansOf<T extends { row: Row }>(ladder: readonly T[]) {
  const temperatureOf = (x: T) => x.row.temperature ?? Number.NaN
  const ts = [...new Set(ladder.map(temperatureOf))].sort((a, b) => a - b)
  const [cold, hot] = [ts[0] ?? 0, ts.at(-1) ?? 0]
  const out: Partial<Record<SpanName, { fit: T[]; held: T[] }>> = {}
  if (ts.length >= 3 && hot - cold >= minSpan)
    out.interpolating = {
      fit: ladder.filter((x) => temperatureOf(x) === cold || temperatureOf(x) === hot),
      held: ladder.filter((x) => temperatureOf(x) > cold && temperatureOf(x) < hot),
    }
  const fitTs = ts.filter((t) => t <= hot - minSpan)
  if (fitTs.length >= 2)
    out.extrapolating = {
      fit: ladder.filter((x) => temperatureOf(x) <= hot - minSpan),
      held: ladder.filter((x) => temperatureOf(x) === hot),
    }
  return out
}

/** The pressure basis all rows share, or undefined when one lacks a pressure or the bases differ. */
function sharedBasis(rows: readonly Row[]): PressureBasis | undefined {
  const b = rows[0]?.pressureBasis
  if (!b || !bases.includes(b)) return undefined
  return rows.every((r) => r.pressure !== undefined && r.pressureBasis === b)
    ? (b as PressureBasis)
    : undefined
}

/**
 * `load` with a temperature sensitivity: the record's, else the assumed one about the temperature of
 * the powder's fit, the temperature its specific energy belongs to.
 */
function withReference(load: InteriorLoad, row: Row, records: Records): InteriorLoad {
  if (load.propellant.temperatureSensitivity) return load
  const fit = records.powders.get(row.powder)?.interior?.propellantTemperature.value
  const reference = fit === undefined ? load.propellantTemperature : kelvin(fit)
  return {
    ...load,
    propellant: {
      ...load.propellant,
      temperatureSensitivity: { reference, cold: assumedSensitivity, hot: assumedSensitivity },
    },
  }
}

/** The load a fit starts from: the energy coefficient set. */
const startOf = (load: InteriorLoad, energy: number): InteriorLoad => ({
  ...load,
  propellant: { ...load.propellant, energyTemperature: energy },
})

/** Adds the held-out residuals of one fit to `sums`; false when the fit failed. */
function fitAndPredict(
  span: { fit: { row: Row; load: InteriorLoad }[]; held: { row: Row; load: InteriorLoad }[] },
  energy: number,
  sums: Sums,
): boolean {
  const basis = sharedBasis(span.fit.map((x) => x.row))
  const ladder: LadderPoint[] = span.fit.map(({ row }) => ({
    charge: toSi('mass', row.charge),
    muzzleVelocity: row.velocity,
    velocitySigma,
    propellantTemperature: kelvin(row.temperature ?? 0),
    ...(basis &&
      row.pressure !== undefined && {
        peakPressure: toSi('pressure', row.pressure),
        pressureSigma: pressureShare * toSi('pressure', row.pressure),
        pressureBasis: basis,
      }),
  }))
  const first = span.fit[0]
  if (!first) return false
  let fitted: InteriorLoad
  try {
    fitted = fitPowder(startOf(first.load, energy), ladder, {
      parameters: ['burnRate', 'temperatureFactor'],
      maxIterations: 60,
    }).load
  } catch {
    return false
  }
  for (const { row, load } of span.held) {
    const r = interior({
      ...fitted,
      charge: load.charge,
      propellantTemperature: load.propellantTemperature,
    })
    if (!r.valid) continue
    sums.velocity += (r.muzzleVelocity - row.velocity) ** 2
    sums.velocityRows++
    if (row.pressure !== undefined) {
      const printed = toSi('pressure', row.pressure)
      sums.pressure += ((100 * (r.peakBreechPressure - printed)) / printed) ** 2
      sums.pressureRows++
    }
  }
  return true
}

const rms = (sum: number, n: number) => (n > 0 ? Math.sqrt(sum / n) : null)
const changeOf = (b: number | null, a: number | null) =>
  a === null || b === null || a === 0 ? null : (100 * (b - a)) / a

const zero = (): Sums => ({ velocity: 0, velocityRows: 0, pressure: 0, pressureRows: 0 })
const sumKeys = ['velocity', 'velocityRows', 'pressure', 'pressureRows'] as const

/** One span over every ladder: pooled RMS of both models on the same held-out rows. */
function spanOver(
  ladders: { row: Row; load: InteriorLoad }[][],
  name: SpanName,
  skipped: Record<string, number>,
): Aggregate['spans'][SpanName] {
  const sums: Record<Model, Sums> = { A: zero(), B: zero() }
  let used = 0
  let failedFits = 0
  for (const ladder of ladders) {
    const span = spansOf(ladder)[name]
    if (!span) {
      count(skipped, `noSpan:${name}`)
      continue
    }
    // a ladder whose fit fails for one model counts for neither, so both see the same rows
    const trial: Record<Model, Sums> = { A: zero(), B: zero() }
    if (!fitAndPredict(span, 0, trial.A) || !fitAndPredict(span, energyCoefficient, trial.B)) {
      failedFits++
      continue
    }
    used++
    for (const m of ['A', 'B'] as const) for (const k of sumKeys) sums[m][k] += trial[m][k]
  }
  const result = (m: Model) => ({
    velocity: rms(sums[m].velocity, sums[m].velocityRows),
    pressure: rms(sums[m].pressure, sums[m].pressureRows),
  })
  const [a, b] = [result('A'), result('B')]
  return {
    ladders: used,
    failedFits,
    rms: { A: a, B: b },
    heldOut: { velocity: sums.A.velocityRows, pressure: sums.A.pressureRows },
    change: {
      velocity: changeOf(b.velocity, a.velocity),
      pressure: changeOf(b.pressure, a.pressure),
    },
  }
}

/** The aggregates of the check over `rows`; nothing of a single row is in them. */
export function temperatureEnergyCheck(rows: readonly Row[], records: Records): Aggregate {
  const skipped: Record<string, number> = {}
  const ladders = laddersOf(rows, records, skipped)
  const spans = {
    interpolating: spanOver(ladders, 'interpolating', skipped),
    extrapolating: spanOver(ladders, 'extrapolating', skipped),
  }
  const supported = Object.values(spans).every(
    ({ change: c }) =>
      c.velocity !== null && c.pressure !== null && c.velocity <= -15 && c.pressure <= -15,
  )
  return {
    notice: 'simulation, not load data',
    ladders: ladders.length,
    rows: ladders.reduce((n, l) => n + l.length, 0),
    skipped,
    spans,
    supported,
  }
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: { rows: { type: 'string' }, records: { type: 'string', multiple: true } },
  })
  if (!values.rows) {
    console.error('usage: temperature-energy.mts --rows <rows.csv|folder> [--records <dir>]...')
    process.exit(2)
  }
  const result = temperatureEnergyCheck(
    readRows(values.rows).rows,
    loadRecords(values.records ?? []),
  )
  console.log(JSON.stringify(result, null, 2))
}
