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
const bases: readonly string[] = ['transducer', 'piezo', 'case-contact', 'energy']

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
  const ladders = new Map<string, Entry[]>()
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
    ladders.set(key, [...(ladders.get(key) ?? []), entryOf(load, row, records)])
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

/** The pressure basis all rows share, or undefined when one lacks a pressure or the bases differ; crusher values are never compared with the model. */
function sharedBasis(rows: readonly Row[]): PressureBasis | undefined {
  const b = rows[0]?.pressureBasis
  if (!b || !bases.includes(b)) return undefined
  return rows.every((r) => r.pressure !== undefined && r.pressureBasis === b)
    ? (b as PressureBasis)
    : undefined
}

type Entry = { row: Row; load: InteriorLoad; fitTemperature: number }

/**
 * `load` with a temperature sensitivity: the record's, else the assumed one about the temperature of
 * the powder's fit, the temperature its specific energy belongs to (`fitTemperature`, K).
 */
function entryOf(load: InteriorLoad, row: Row, records: Records): Entry {
  const fit = records.powders.get(row.powder)?.interior?.propellantTemperature.value
  const fitTemperature = fit === undefined ? load.propellantTemperature : kelvin(fit)
  if (load.propellant.temperatureSensitivity) return { row, load, fitTemperature }
  const sensitivity = {
    reference: fitTemperature,
    cold: assumedSensitivity,
    hot: assumedSensitivity,
  }
  return {
    row,
    load: { ...load, propellant: { ...load.propellant, temperatureSensitivity: sensitivity } },
    fitTemperature,
  }
}

/**
 * The load a fit starts from: the energy coefficient set, the specific energy moved so it holds at
 * the powder's fit temperature, since core scales it about the sensitivity's reference.
 */
function startOf({ load, fitTemperature }: Entry, energy: number): InteriorLoad {
  const reference = load.propellant.temperatureSensitivity?.reference ?? fitTemperature
  return {
    ...load,
    propellant: {
      ...load.propellant,
      specificEnergy:
        load.propellant.specificEnergy * Math.exp(-energy * (fitTemperature - reference)),
      energyTemperature: energy,
    },
  }
}

/** The load fitted to the span's fit rows, or undefined when the fit fails. */
function fitted(fitRows: readonly Entry[], energy: number): InteriorLoad | undefined {
  const basis = sharedBasis(fitRows.map((x) => x.row))
  const ladder: LadderPoint[] = fitRows.map(({ row }) => ({
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
  const first = fitRows[0]
  if (!first) return undefined
  try {
    return fitPowder(startOf(first, energy), ladder, {
      parameters: ['burnRate', 'temperatureFactor'],
      maxIterations: 60,
    }).load
  } catch {
    return undefined
  }
}

/** The prediction of `model` at a held-out row's charge and temperature; undefined when invalid. */
function predictAt(model: InteriorLoad, load: InteriorLoad) {
  const r = interior({
    ...model,
    charge: load.charge,
    propellantTemperature: load.propellantTemperature,
  })
  return r.valid ? r : undefined
}

/**
 * Adds the residuals of a held-out row to `sums` for both models, only where both are valid. The
 * pressure counts where its basis is one the model is compared on and, when the fit used pressures,
 * the fit's own basis.
 */
function addRow(
  sums: Record<Model, Sums>,
  models: Record<Model, InteriorLoad>,
  { row, load }: Entry,
  fitBasis: PressureBasis | undefined,
  skipped: Record<string, number>,
) {
  const a = predictAt(models.A, load)
  const b = predictAt(models.B, load)
  if (!a || !b) {
    count(skipped, 'modelRefused')
    return
  }
  const basis = row.pressureBasis
  const pressure =
    row.pressure !== undefined &&
    basis !== undefined &&
    bases.includes(basis) &&
    (!fitBasis || basis === fitBasis)
      ? toSi('pressure', row.pressure)
      : undefined
  if (row.pressure !== undefined && pressure === undefined) count(skipped, 'pressureBasis')
  for (const [m, r] of [
    ['A', a],
    ['B', b],
  ] as const) {
    sums[m].velocity += (r.muzzleVelocity - row.velocity) ** 2
    sums[m].velocityRows++
    if (pressure === undefined) continue
    sums[m].pressure += ((100 * (r.peakBreechPressure - pressure)) / pressure) ** 2
    sums[m].pressureRows++
  }
}

const rms = (sum: number, n: number) => (n > 0 ? Math.sqrt(sum / n) : null)
const changeOf = (b: number | null, a: number | null) =>
  a === null || b === null || a === 0 ? null : (100 * (b - a)) / a

const zero = (): Sums => ({ velocity: 0, velocityRows: 0, pressure: 0, pressureRows: 0 })

/** One span over every ladder: pooled RMS of both models on the same held-out rows. */
function spanOver(
  ladders: Entry[][],
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
    const [A, B] = [fitted(span.fit, 0), fitted(span.fit, energyCoefficient)]
    if (!A || !B) {
      failedFits++
      continue
    }
    used++
    const fitBasis = sharedBasis(span.fit.map((x) => x.row))
    for (const entry of span.held) addRow(sums, { A, B }, entry, fitBasis, skipped)
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
