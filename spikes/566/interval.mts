/**
 * Coverage factor of the exponent interval of `fitPressureCurves` and the false-alarm and hit rate
 * of its leave-one-trace-out check, on synthetic breech traces from `interior` with Gaussian noise
 * (the traces, truths and starts of the study of the exponent of the curve fit). Every run records
 * the fitted exponent over the truth, its relative standard uncertainty, its status and reasons
 * and the exponents of the leave-one-out refits, so limits are applied afterwards.
 *
 * Run from the repository root (Node runs the sources of core directly):
 *   node spikes/566/interval.mts --reps 40 --part 0/4 --out spikes/566/out
 *   node spikes/566/interval.mts --summarise --out spikes/566/out
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import {
  fitPressureCurves,
  type InteriorLoad,
  type InteriorPoint,
  interior,
  PowderFitError,
} from '../../packages/core/src/index.ts'

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i < 0 ? fallback : (process.argv[i + 1] ?? fallback)
}
const reps = Number(arg('reps', '40'))
const outDir = arg('out', 'spikes/566/out')
const [part, parts] = arg('part', '0/1').split('/').map(Number) as [number, number]

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

const p0 = 98066.5
/** Pressure at which every truth has the same burn rate, so peaks stay comparable across exponents. */
const pMatch = 1.3e8
interface Burn {
  vivacity: number
  exponent: number
  a: number
  z1: number
}
const truthBurn = (n: number): Burn => ({ vivacity: 8 * (pMatch / p0) ** (0.5 - n), exponent: n, a: 0.8, z1: 0.3 })
/** Start values: 3 % off for the burn coefficient, 5 % for the form, 20 % for the exponent. */
const startOf = (t: Burn): Burn => ({
  vivacity: t.vivacity * 1.03 * (pMatch / p0) ** (-0.2 * t.exponent),
  exponent: 1.2 * t.exponent,
  a: t.a * 1.05,
  z1: t.z1 * 1.05,
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
      referencePressure: p0,
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
/** Charges of K traces evenly spaced from 2.4 to 3.0 g. */
const chargesOf = (k: number) => Array.from({ length: k }, (_, i) => 0.0024 + (0.0006 * i) / (k - 1))

/** Breech trace every 10 us on a clock that reads model time plus 0.2 to 0.4 ms, noise `noise` of the peak. */
function makeTrace(source: InteriorLoad, noise: number, seed: number) {
  const run = interior(source)
  if (!run.valid) throw new Error(`truth invalid: ${run.reason}`)
  const u = uniforms(seed)
  const z = normals(seed + 7919)
  const offset = 2e-4 + 2e-4 * u()
  const at = (p: InteriorPoint) => p.breechPressure
  const peak = run.points.reduce((m, p) => Math.max(m, at(p)), 0)
  const time: number[] = []
  const pressure: number[] = []
  let k = 1
  for (let t = offset - 1e-4; t - offset < run.muzzleTime; t += 1e-5) {
    const tm = t - offset
    let v = 0
    if (tm > 0) {
      while ((run.points[k] as InteriorPoint).time < tm) k++
      const [a, b] = [run.points[k - 1] as InteriorPoint, run.points[k] as InteriorPoint]
      v = at(a) + ((tm - a.time) / (b.time - a.time)) * (at(b) - at(a))
    }
    time.push(t)
    pressure.push(v + noise * peak * z())
  }
  return { sensor: 'breech' as const, time, pressure, sigma: noise * peak }
}

interface Cell {
  id: string
  K: number
  exponent: number
  noise: number
  world: World
}
const cells: Cell[] = []
const add = (c: Omit<Cell, 'id'>) => cells.push({ ...c, id: `${c.world}-K${c.K}-n${c.exponent}-s${c.noise}` })
for (const K of [2, 3, 5])
  for (const exponent of [0.3, 0.5, 0.8])
    for (const noise of [0.001, 0.005, 0.02]) add({ K, exponent, noise, world: 'exact' })
for (const K of [2, 3, 5]) add({ K, exponent: 0.5, noise: 0.005, world: 'mild' })

interface Run {
  failure?: string
  status?: string
  reasons?: string[]
  /** Fitted over true exponent. */
  ratio?: number
  relU?: number
  vif?: number
  leaveOneOut?: number[]
  chi2dof?: number
}

function runCell(cell: Cell, index: number) {
  const truth = truthBurn(cell.exponent)
  const runs: Run[] = []
  for (let r = 0; r < reps; r++) {
    const shots = chargesOf(cell.K).map((c, k) => ({
      charge: c,
      trace: makeTrace(load(truth, c, cell.world), cell.noise, 1000 * (r + 1) + 16 * k),
    }))
    try {
      const fit = fitPressureCurves(load(startOf(truth), 0.0028), shots)
      const n = fit.parameters.find((p) => p.name === 'exponent')
      runs.push({
        status: n?.status,
        reasons: n?.reasons,
        ratio: (n?.value ?? Number.NaN) / cell.exponent,
        relU: n?.relativeStandardUncertainty,
        vif: n?.varianceInflation,
        leaveOneOut: n?.leaveOneOut?.map((v) => v / cell.exponent),
        chi2dof: fit.chiSquare / fit.degreesOfFreedom,
      })
    } catch (e) {
      if (!(e instanceof PowderFitError)) throw e
      runs.push({ failure: e.reason })
    }
  }
  return { ...cell, index, runs }
}

const quantile = (v: number[], q: number) => {
  const s = [...v].sort((a, b) => a - b)
  return s.length === 0 ? Number.NaN : (s[Math.min(s.length - 1, Math.floor(q * s.length))] as number)
}
const fmt = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-')
const pct = (a: number, b: number) => (b === 0 ? '-' : `${Math.round((100 * a) / b)}`)
const jack = (v: number[]) => {
  const l = v.map(Math.log)
  const m = l.reduce((a, b) => a + b, 0) / l.length
  return Math.sqrt(((l.length - 1) / l.length) * l.reduce((a, b) => a + (b - m) ** 2, 0))
}
const maxDev = (v: number[], ratio: number) => Math.max(...v.map((x) => Math.abs(Math.log(x / ratio))))

type Result = Cell & { index: number; runs: Run[] }
function summarise() {
  const results: Result[] = readdirSync(outDir)
    .filter((f) => f.startsWith('cells-') && f.endsWith('.json'))
    .flatMap((f) => JSON.parse(readFileSync(`${outDir}/${f}`, 'utf8')) as Result[])
    .sort((a, b) => a.index - b.index)
  // the interval exists when the exponent is fitted; `inconsistent` is the only reason that keeps it fitted and weak
  const fitted = (x: Run) => !x.failure && x.status !== 'fixed'
  const z = (x: Run) => Math.abs(Math.log(x.ratio as number)) / (x.relU as number)
  // derive on even replicates, test on odd ones
  const derive = results
    .filter((r) => r.world === 'exact')
    .flatMap((r) => r.runs.filter((x, i) => i % 2 === 0 && fitted(x)).map(z))
  const k = quantile(derive, 0.9)
  console.log(`derive: ${derive.length} fitted runs, pooled 90th percentile of z ${fmt(k, 3)}`)
  const chosen = Number(arg('k', fmt(k, 1)))
  console.log(`k = ${chosen}`)
  console.log('')
  console.log(
    '| cell | fail | fitted | VIF med | u_rel med | n/true med | cover 1.645 test | cover k test | k90 test | LOO runs | jack/u med | jack/u p95 | maxdev/u p95 | flag jack>k u | flag jack>u | chi2/dof med |',
  )
  console.log(`|${'---|'.repeat(16)}`)
  for (const r of results) {
    const ok = r.runs.filter(fitted)
    const test = r.runs.filter((x, i) => i % 2 === 1 && fitted(x)).map(z)
    const loo = ok.filter((x) => x.leaveOneOut)
    const ju = loo.map((x) => jack(x.leaveOneOut as number[]) / (x.relU as number))
    const mu = loo.map((x) => maxDev(x.leaveOneOut as number[], x.ratio as number) / (x.relU as number))
    console.log(
      `| ${r.id} | ${r.runs.length - r.runs.filter((x) => !x.failure).length} | ${pct(ok.length, r.runs.length)} | ${fmt(quantile(ok.map((x) => x.vif as number), 0.5), 0)} | ${fmt(quantile(ok.map((x) => x.relU as number), 0.5), 3)} | ${fmt(quantile(ok.map((x) => x.ratio as number), 0.5), 3)} | ${pct(test.filter((v) => v <= 1.645).length, test.length)} | ${pct(test.filter((v) => v <= chosen).length, test.length)} | ${fmt(quantile(test, 0.9))} | ${loo.length} | ${fmt(quantile(ju, 0.5))} | ${fmt(quantile(ju, 0.95))} | ${fmt(quantile(mu, 0.95))} | ${pct(ju.filter((v) => v > chosen).length, ju.length)} | ${pct(ju.filter((v) => v > 1).length, ju.length)} | ${fmt(quantile(ok.map((x) => x.chi2dof as number), 0.5))} |`,
    )
  }
}

if (process.argv.includes('--summarise')) summarise()
else {
  mkdirSync(outDir, { recursive: true })
  const out: Result[] = []
  for (const [c, i] of cells.map((c, i) => [c, i] as const).filter(([, i]) => i % parts === part)) {
    const t0 = performance.now()
    out.push(runCell(c, i))
    console.error(`${c.id}: ${((performance.now() - t0) / 1000).toFixed(0)} s`)
    writeFileSync(`${outDir}/cells-${part}.json`, `${JSON.stringify(out)}\n`)
  }
}
