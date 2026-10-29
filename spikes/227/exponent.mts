/**
 * Spike #227: can the pressure exponent of the curve fit be resolved by fitting several traces of
 * the same powder together, or by fixing the time shift from a second signal. Synthetic breech
 * pressure traces from `interior` with Gaussian noise, fitted by a joint version of the fit of
 * `fitPressureCurve`: shared burn coefficient, form slope, transition point and exponent, one time
 * shift per trace. Every cell records how often the exponent would be fitted under each limit,
 * its error and the coverage of its stated uncertainty.
 *
 * Run from the repository root (Node runs the sources of core directly):
 *   node spikes/227/exponent.mts --reps 30 --part 0/4 --out spikes/227/out
 *   node spikes/227/exponent.mts --summarise --out spikes/227/out > spikes/227/tables.md
 *   node spikes/227/exponent.mts --check     (single-trace fit against fitPressureCurve)
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import {
  fitPressureCurve,
  type InteriorLoad,
  type InteriorPoint,
  identifiability,
  interior,
  logLeastSquares,
} from '../../packages/core/src/index.ts'

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i < 0 ? fallback : (process.argv[i + 1] ?? fallback)
}
const flag = (name: string) => process.argv.includes(`--${name}`)
const reps = Number(arg('reps', '30'))
const outDir = arg('out', 'spikes/227/out')
const [part, parts] = arg('part', '0/1').split('/').map(Number) as [number, number]

// ---- random numbers (mulberry32, Box-Muller) ----
function uniforms(s: number): () => number {
  let a = s >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function normals(s: number): () => number {
  const u = uniforms(s)
  return () => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u())
}

// ---- loads ----
const p0 = 98066.5
/** Pressure at which every truth has the same burn rate, so peaks stay comparable across exponents. */
const pMatch = 1.3e8
interface Burn {
  vivacity: number
  exponent: number
  referencePressure: number
  a: number
  z1: number
}
const truthBurn = (n: number): Burn => ({
  vivacity: 8 * (pMatch / p0) ** (0.5 - n),
  exponent: n,
  referencePressure: p0,
  a: 0.8,
  z1: 0.3,
})
type World = 'exact' | 'mild'
const load = (burn: Burn, charge: number, world: World = 'exact'): InteriorLoad => ({
  chamber: { volume: 3.4e-6, boreArea: 3.75e-5, boreDiameter: 6.9e-3 },
  barrel: { length: 0.6, twist: 0.254 },
  bullet: { mass: 0.0095 },
  charge,
  propellant: {
    specificEnergy: 3.9e6,
    gamma: 1.23,
    density: 1600,
    covolume: 1e-3,
    burn: {
      kind: 'vivacity',
      vivacity: burn.vivacity,
      exponent: burn.exponent,
      referencePressure: burn.referencePressure,
      form: { kind: 'twoStage', a: burn.a, m: 0.5, q: 0.5, z1: burn.z1 },
    },
  },
  propellantTemperature: 294.15,
  ignitionPressure: 5e6,
  startPressure: 30e6,
  // physics the fitted model lacks: convective heat loss and bore friction
  ...(world === 'mild'
    ? {
        heat: { model: 'convective' as const, flameTemperature: 2800, factor: 0.5 },
        resistance: { friction: 2.5e6 },
      }
    : {}),
})

/** Charges of a set of K traces, kg: `low` to 3.0 g (default 2.4 g, highest peak 1.3 to 1.5 times the lowest). */
const chargesOf = (k: number, low = 0.0024) =>
  k === 1 ? [0.0028] : Array.from({ length: k }, (_, i) => low + ((0.003 - low) * i) / (k - 1))

// ---- traces ----
const step = 1e-5
const sigmaVelocity = 3 // m/s, one chronograph shot
const sigmaExit = 5e-6 // s, a muzzle-exit time on the trace clock
interface Trace {
  charge: number
  time: number[]
  pressure: number[]
  sigma: number
  peak: number
  offset: number
  velocity: number
  exit: number
}
const breech = (p: InteriorPoint) => p.breechPressure

/** Breech trace every 10 us on a clock that reads model time plus `offset`, noise `noise` of the peak. */
function makeTrace(source: InteriorLoad, noise: number, seed: number): Trace {
  const run = interior(source)
  if (!run.valid) throw new Error(`truth invalid: ${run.reason}`)
  const u = uniforms(seed)
  const z = normals(seed + 7919)
  // a clock offset of 0.2 to 0.4 ms with an arbitrary sub-sample phase
  const offset = 2e-4 + 2e-4 * u()
  const peakTrue = run.points.reduce((m, p) => Math.max(m, breech(p)), 0)
  const time: number[] = []
  const pressure: number[] = []
  let k = 1
  for (let t = offset - 1e-4; t - offset < run.muzzleTime; t += step) {
    const tm = t - offset
    let v = 0
    if (tm > 0) {
      while ((run.points[k] as InteriorPoint).time < tm) k++
      const [a, b] = [run.points[k - 1] as InteriorPoint, run.points[k] as InteriorPoint]
      v = breech(a) + ((tm - a.time) / (b.time - a.time)) * (breech(b) - breech(a))
    }
    time.push(t)
    pressure.push(v + noise * peakTrue * z())
  }
  return {
    charge: source.charge,
    time,
    pressure,
    sigma: noise * peakTrue,
    peak: Math.max(...pressure),
    offset,
    velocity: run.muzzleVelocity + sigmaVelocity * z(),
    exit: run.muzzleTime + offset + sigmaExit * z(),
  }
}

/** Linear crossing of `level` from below. */
function riseTime(time: readonly number[], value: readonly number[], level: number): number {
  const i = value.findIndex((v) => v >= level)
  if (i <= 0) return time[0] as number
  const [t0, t1, v0, v1] = [time[i - 1], time[i], value[i - 1], value[i]] as number[]
  return (
    (t0 as number) +
    ((level - (v0 as number)) / ((v1 as number) - (v0 as number))) *
      ((t1 as number) - (t0 as number))
  )
}

/** Window of `fitPressureCurve`: 25 % rise to the fall to half the peak. */
function windowRows(tr: Trace) {
  const start = riseTime(tr.time, tr.pressure, 0.25 * tr.peak)
  const top = tr.pressure.indexOf(tr.peak)
  const down = tr.pressure.findIndex((v, i) => i > top && v <= 0.5 * tr.peak)
  if (down < 0) throw new Error('trace never falls to half its peak')
  const end = tr.time[down] as number
  return { start, rows: tr.time.flatMap((t, i) => (t >= start && t < end ? [i] : [])) }
}

// ---- joint fit ----
type Mode = 'free' | 'known' | 'velocity' | 'exit'
interface FitSpec {
  mode: Mode
  /** Error of a known shift, s, the same for every trace (a sensor delay). */
  delayError: number
}
class FitFailure extends Error {
  readonly reason: string
  readonly unresolved: number[] | undefined
  constructor(reason: string, unresolved?: number[]) {
    super(reason)
    this.reason = reason
    this.unresolved = unresolved
  }
}

interface FitRecord {
  failure?: string
  /** Shared parameters held at their start values (0 burn coefficient, 1 form slope, 2 transition, 3 exponent). */
  held?: number[]
  iterations?: number
  condition?: number
  /** Per shared parameter: fitted over true, relative standard uncertainty, variance inflation. */
  ratio?: number[]
  relU?: number[]
  vif?: number[]
  /** Largest variance inflation of the time shifts. */
  shiftVif?: number
  chi2dof?: number
}

function jointFit(traces: Trace[], truth: Burn, start: Burn, spec: FitSpec): FitRecord {
  const K = traces.length
  const pref = Math.exp(traces.reduce((s, t) => s + Math.log(t.peak), 0) / K)
  // shared parameters stated at the geometric mean of the peaks
  const restate = (b: Burn) => b.vivacity * (pref / b.referencePressure) ** b.exponent
  const base = [restate(start), start.a, start.z1, start.exponent]
  const trueValues = [restate(truth), truth.a, truth.z1, truth.exponent]
  const freeShift = spec.mode !== 'known'
  const nShared = 4
  const nParam = nShared + (freeShift ? K : 0)
  const shiftScale = 1e-4
  const windows = traces.map(windowRows)

  const shared = (theta: readonly number[]) =>
    base.map((b, j) => (b as number) * Math.exp(theta[j] as number))
  const loadOf = (theta: readonly number[], k: number) => {
    const [vivacity, a, z1, exponent] = shared(theta) as [number, number, number, number]
    return load({ vivacity, exponent, referencePressure: pref, a, z1 }, (traces[k] as Trace).charge)
  }
  const cache = new Map<string, ReturnType<typeof interior>>()
  const runOf = (theta: readonly number[], k: number) => {
    const key = `${k}|${theta.slice(0, nShared).join(',')}`
    let run = cache.get(key)
    if (!run) {
      if (cache.size > 400) cache.clear()
      run = interior(loadOf(theta, k))
      cache.set(key, run)
    }
    return run
  }
  // start shifts: the model's 25 % rise on the trace's
  const shift0 = traces.map((_, k) => {
    const run = runOf(
      base.map(() => 0),
      k,
    )
    if (!run.valid) throw new FitFailure('invalid-start')
    const p = run.points.map(breech)
    const model = riseTime(
      run.points.map((x) => x.time),
      p,
      0.25 * Math.max(...p),
    )
    return (windows[k] as { start: number }).start - model
  })
  const shiftOf = (theta: readonly number[], k: number) =>
    freeShift
      ? (shift0[k] as number) + shiftScale * (theta[nShared + k] as number)
      : (traces[k] as Trace).offset + spec.delayError

  const observedOf = (k: number) => {
    const tr = traces[k] as Trace
    const rows = (windows[k] as { rows: number[] }).rows
    const obs = rows.map((i) => tr.pressure[i] as number)
    const sig = rows.map(() => tr.sigma)
    if (spec.mode === 'velocity') {
      obs.push(tr.velocity)
      sig.push(sigmaVelocity)
    }
    if (spec.mode === 'exit') {
      obs.push(tr.exit)
      sig.push(sigmaExit)
    }
    return { obs, sig }
  }
  const perRun = traces.map((_, k) => observedOf(k))
  const observed = perRun.flatMap((r) => r.obs)
  const sigma = perRun.flatMap((r) => r.sig)

  const predictRun = (theta: readonly number[], k: number): number[] | null => {
    const run = runOf(theta, k)
    if (!run.valid) return null
    const tr = traces[k] as Trace
    const rows = (windows[k] as { rows: number[] }).rows
    const shift = shiftOf(theta, k)
    const t = run.points.map((x) => x.time)
    const times = rows.map((i) => (tr.time[i] as number) - shift)
    if ((times[0] as number) < 0 || (times.at(-1) as number) > (t.at(-1) as number)) return null
    let j = 1
    const out = times.map((x) => {
      while ((t[j] as number) < x) j++
      const [a, b] = [run.points[j - 1] as InteriorPoint, run.points[j] as InteriorPoint]
      return breech(a) + ((x - a.time) / (b.time - a.time)) * (breech(b) - breech(a))
    })
    if (spec.mode === 'velocity') out.push(run.muzzleVelocity)
    if (spec.mode === 'exit') out.push(run.muzzleTime + shift)
    return out
  }
  const predictAll = (theta: readonly number[]) => {
    const all: number[] = []
    for (let k = 0; k < K; k++) {
      const p = predictRun(theta, k)
      if (!p) return null
      all.push(...p)
    }
    return all
  }
  if (!predictAll(Array.from({ length: nParam }, () => 0))) return { failure: 'invalid-start' }
  const runs = perRun.map((r) => r.obs.length)
  const solved = solveHolding({ nShared, nParam, observed, sigma, runs, predictAll, predictRun })
  if ('failure' in solved) return solved
  const { fit, free, full, info } = solved
  const perShared = (v: readonly number[]) =>
    [0, 1, 2, 3].map((j) => (free.includes(j) ? (v[free.indexOf(j)] as number) : Number.NaN))
  return {
    held: solved.held,
    iterations: fit.iterations,
    condition: fit.conditionNumber,
    ratio: shared(full(fit.theta)).map((v, j) => v / (trueValues[j] as number)),
    relU: perShared(fit.standardUncertainty ?? []),
    vif: perShared(info.varianceInflation),
    ...(freeShift ? { shiftVif: Math.max(...info.varianceInflation.slice(free.length)) } : {}),
    chi2dof: fit.chiSquare / (observed.length - fit.theta.length),
  }
}

type Predict = (theta: readonly number[]) => number[] | null
interface Problem {
  nShared: number
  nParam: number
  observed: number[]
  sigma: number[]
  runs: number[]
  predictAll: Predict
  predictRun: (theta: readonly number[], k: number) => number[] | null
}

/**
 * As `fitPressureCurve`: a form parameter or the exponent the loop reports unresolved is held at
 * its start value and the fit repeats; the burn coefficient is never held.
 */
function solveHolding(pr: Problem) {
  const { nShared, nParam, observed, sigma, predictAll, predictRun } = pr
  const held: number[] = []
  for (;;) {
    const free = [0, 1, 2, 3].filter((j) => !held.includes(j))
    const full = (th: readonly number[]) => [
      ...[0, 1, 2, 3].map((j) => (free.includes(j) ? (th[free.indexOf(j)] as number) : 0)),
      ...th.slice(free.length),
    ]
    const count = free.length + nParam - nShared
    const zero = Array.from({ length: count }, () => 0)
    let fit: ReturnType<typeof logLeastSquares>
    try {
      fit = logLeastSquares({
        parameterCount: count,
        observed,
        standardUncertainty: sigma,
        weighted: true,
        floor: observed.map((o, i) => (1e-6 * Math.abs(o)) / (sigma[i] as number)),
        first: predictAll(full(zero)) as number[],
        predict: (trial, _current, run) =>
          run === undefined ? predictAll(full(trial)) : predictRun(full(trial), run),
        runs: pr.runs,
        moves: (j, run) => j < free.length || j - free.length === run,
        maxIterations: 100,
        // relaxed: the condition number is recorded and the limits are applied afterwards
        maxCondition: 1e9,
        tolerance: 1e-9,
        fail: (reason, _theta, extra) => {
          throw new FitFailure(reason, extra?.unresolved)
        },
      })
    } catch (e) {
      if (!(e instanceof FitFailure)) throw e
      const names = (e.unresolved ?? [])
        .filter((i) => i < free.length)
        .map((i) => free[i] as number)
      const hold = e.reason === 'unresolved' ? names.filter((j) => j !== 0) : []
      if (hold.length === 0) return { failure: e.reason, held }
      held.push(...hold)
      continue
    }
    // variance inflation from the weighted Jacobian at the solution, as `fitPressureCurve` does
    const h = 1e-3
    const at = fit.theta
    const columns = zero.map((_, j) => {
      const up = predictAll(full(at.map((x, k) => (k === j ? x + h : x))))
      const down = predictAll(full(at.map((x, k) => (k === j ? x - h : x))))
      if (!up || !down) throw new FitFailure('unreachable')
      return up.map((v, i) => (v - (down[i] as number)) / (2 * h * (sigma[i] as number)))
    })
    const info = identifiability(observed.map((_, i) => columns.map((c) => c[i] as number)))
    return { fit, free, full, info, held }
  }
}

// ---- grid ----
interface Cell {
  id: string
  K: number
  exponent: number
  noise: number
  mode: Mode
  delayError: number
  world: World
  /** Lowest charge of the set, kg. */
  low?: number
}
const cells: Cell[] = []
const add = (c: Omit<Cell, 'id'>) =>
  cells.push({
    ...c,
    id: `${c.world}-K${c.K}-n${c.exponent}-s${c.noise}-${c.mode}${c.mode === 'known' ? c.delayError * 1e6 : ''}${c.low ? `-low${c.low * 1e3}` : ''}`,
  })
// Q1: several traces, shift fitted
for (const K of [1, 2, 3, 5])
  for (const exponent of [0.3, 0.5, 0.8])
    for (const noise of [0.001, 0.005, 0.02])
      add({ K, exponent, noise, mode: 'free', delayError: 0, world: 'exact' })
// Q2: the shift from a second signal
for (const K of [1, 3])
  for (const exponent of [0.3, 0.5, 0.8]) {
    for (const e of [0, 2e-6, 5e-6, 10e-6])
      add({ K, exponent, noise: 0.005, mode: 'known', delayError: e, world: 'exact' })
    for (const mode of ['velocity', 'exit'] as const)
      add({ K, exponent, noise: 0.005, mode, delayError: 0, world: 'exact' })
  }
// model error the fit does not have
for (const K of [1, 3, 5])
  for (const mode of ['free', 'known'] as const)
    add({ K, exponent: 0.5, noise: 0.005, mode, delayError: 0, world: 'mild' })

// narrower charge spreads of two traces; appended so the cells above keep their indices
for (const low of [0.0026, 0.0028])
  for (const exponent of [0.3, 0.5, 0.8])
    add({ K: 2, exponent, noise: 0.005, mode: 'free', delayError: 0, world: 'exact', low })

/** Start values: 3 % off for the burn coefficient, 5 % for the form, 20 % for the exponent. */
const startOf = (t: Burn): Burn => ({
  ...t,
  vivacity: t.vivacity * 1.03 * (pMatch / p0) ** (t.exponent - 1.2 * t.exponent),
  exponent: 1.2 * t.exponent,
  a: t.a * 1.05,
  z1: t.z1 * 1.05,
})

function runCell(cell: Cell, index: number) {
  const truth = truthBurn(cell.exponent)
  const records: FitRecord[] = []
  for (let r = 0; r < reps; r++) {
    // seeds: 1000 per replicate, 16 per trace; the same traces in every mode of a cell family
    const traces = chargesOf(cell.K, cell.low).map((c, k) =>
      makeTrace(load(truth, c, cell.world), cell.noise, 1000 * (r + 1) + 16 * k),
    )
    try {
      records.push(jointFit(traces, truth, startOf(truth), cell))
    } catch (e) {
      if (!(e instanceof FitFailure)) throw e
      records.push({ failure: e.reason })
    }
  }
  return { ...cell, index, records }
}

// ---- check against fitPressureCurve ----
function check() {
  for (const exponent of [0.3, 0.5]) {
    const truth = truthBurn(exponent)
    for (const r of [0, 1, 2]) {
      const tr = makeTrace(load(truth, 0.0028), 0.005, 1000 * (r + 1))
      const start = startOf(truth)
      const mine = jointFit([tr], truth, start, { mode: 'free', delayError: 0 })
      if (mine.failure) console.log(mine.failure)
      const theirs = fitPressureCurve(
        load(start, 0.0028),
        { sensor: 'breech', time: tr.time, pressure: tr.pressure, sigma: tr.sigma },
        { maxInflation: 1e9, maxRelativeStandardUncertainty: 1e9, maxCondition: 1e9 },
      )
      const n = theirs.parameters.find((p) => p.name === 'exponent')
      console.log(
        `n=${exponent} seed ${r}: joint n/true ${mine.ratio?.[3]?.toFixed(4)} vif ${mine.vif?.[3]?.toFixed(0)} u ${mine.relU?.[3]?.toFixed(3)} | fitPressureCurve n/true ${((n?.value ?? 0) / exponent).toFixed(4)} vif ${n?.varianceInflation?.toFixed(0)} u ${n?.relativeStandardUncertainty?.toFixed(3)} ${n?.status}`,
      )
    }
  }
}

// ---- summary ----
const quantile = (v: number[], q: number) => {
  const s = [...v].sort((a, b) => a - b)
  return s.length === 0
    ? Number.NaN
    : (s[Math.min(s.length - 1, Math.floor(q * s.length))] as number)
}
const pct = (a: number, b: number) => (b === 0 ? '-' : `${Math.round((100 * a) / b)}`)
const fmt = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-')

type Result = Cell & { index: number; records: FitRecord[] }
function summarise() {
  const results: Result[] = readdirSync(outDir)
    .filter((f) => f.startsWith('cells-') && f.endsWith('.json'))
    .flatMap((f) => JSON.parse(readFileSync(`${outDir}/${f}`, 'utf8')) as Result[])
    .sort((a, b) => a.index - b.index)
  /** Fitted under the limits: converged, variance inflation, condition number, relative uncertainty. */
  const fitted = (x: FitRecord, vif: number, cond: number) =>
    !x.failure &&
    (x.vif?.[3] ?? Infinity) <= vif &&
    (x.condition ?? Infinity) <= cond &&
    (x.relU?.[3] ?? Infinity) <= 0.25
  const z = (x: FitRecord) =>
    Math.abs(Math.log(x.ratio?.[3] ?? Number.NaN)) / (x.relU?.[3] ?? Number.NaN)
  const lines: string[] = []
  const table = (title: string, rows: Result[]) => {
    lines.push(`## ${title}`, '')
    lines.push(
      '| cell | fail | VIF n median | cond median | fitted 10/1e3 | fitted 100/1e3 | fitted 500/1e3 | fitted 500/any | u_rel n median | n/true median | n/true p5-p95 | cover 90 % (all converged) | k for 90 % | cover 90 % (fitted 500/any) | B/true median | a/true median | z1/true median | chi2/dof median |',
    )
    lines.push(`|${'---|'.repeat(19)}`)
    for (const r of rows) {
      const ok = r.records.filter((x) => !x.failure)
      const fails = r.records.filter((x) => x.failure)
      const failText =
        fails.length === 0
          ? '0'
          : Object.entries(
              fails.reduce<Record<string, number>>((m, x) => {
                m[x.failure as string] = (m[x.failure as string] ?? 0) + 1
                return m
              }, {}),
            )
              .map(([k, v]) => `${v} ${k}`)
              .join(', ')
      const zs = ok.map(z)
      const f500 = ok.filter((x) => fitted(x, 500, Infinity))
      const med = (j: number) =>
        quantile(
          ok.map((x) => x.ratio?.[j] ?? Number.NaN),
          0.5,
        )
      const ratios = ok.map((x) => x.ratio?.[3] ?? Number.NaN)
      lines.push(
        `| ${r.id} | ${failText} | ${fmt(
          quantile(
            ok.map((x) => x.vif?.[3] ?? Infinity),
            0.5,
          ),
          0,
        )} | ${fmt(
          quantile(
            ok.map((x) => x.condition ?? Infinity),
            0.5,
          ),
          0,
        )} | ${pct(r.records.filter((x) => fitted(x, 10, 1e3)).length, r.records.length)} | ${pct(r.records.filter((x) => fitted(x, 100, 1e3)).length, r.records.length)} | ${pct(r.records.filter((x) => fitted(x, 500, 1e3)).length, r.records.length)} | ${pct(f500.length, r.records.length)} | ${fmt(
          quantile(
            ok.map((x) => x.relU?.[3] ?? Infinity),
            0.5,
          ),
          3,
        )} | ${fmt(med(3), 3)} | ${fmt(quantile(ratios, 0.05), 2)} to ${fmt(quantile(ratios, 0.95), 2)} | ${pct(zs.filter((v) => v <= 1.645).length, zs.length)} | ${fmt(quantile(zs, 0.9))} | ${pct(f500.map(z).filter((v) => v <= 1.645).length, f500.length)} | ${fmt(med(0), 3)} | ${fmt(med(1), 3)} | ${fmt(med(2), 3)} | ${fmt(
          quantile(
            ok.map((x) => x.chi2dof ?? Number.NaN),
            0.5,
          ),
        )} |`,
      )
    }
    lines.push('')
  }
  table(
    'Q1: K traces, time shift fitted per trace',
    results.filter((r) => r.world === 'exact' && r.mode === 'free' && r.low === undefined),
  )
  table(
    'Q2: time shift known (with a common delay error, us) or a second signal',
    results.filter((r) => r.world === 'exact' && r.mode !== 'free'),
  )
  table(
    'Charge spread: two traces from the lowest charge (g) to 3.0 g',
    results.filter((r) => r.low !== undefined),
  )
  table(
    'Model error: heat loss and bore friction in the truth, exponent 0.5',
    results.filter((r) => r.world === 'mild'),
  )
  console.log(lines.join('\n'))
}

if (flag('check')) check()
else if (flag('summarise')) summarise()
else {
  mkdirSync(outDir, { recursive: true })
  const mine = cells.map((c, i) => [c, i] as const).filter(([, i]) => i % parts === part)
  const out: Result[] = []
  for (const [c, i] of mine) {
    const t0 = performance.now()
    out.push(runCell(c, i))
    console.error(`${c.id}: ${((performance.now() - t0) / 1000).toFixed(0)} s`)
    writeFileSync(`${outDir}/cells-${part}.json`, `${JSON.stringify(out)}\n`)
  }
}
