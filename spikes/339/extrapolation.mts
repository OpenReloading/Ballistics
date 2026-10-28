/**
 * Spike #339: how far outside the fitted ladder does a powder fit prediction stay within its
 * interval. Synthetic ladders from `interior` with measurement noise, fitted by `fitPowder`,
 * predicted by `predictPowder` (and `powderPressureRange` for the pressure) at points outside the
 * fitted range of each axis. The share of true values inside the interval is tabulated per axis
 * and relative distance.
 *
 * Run from the repository root (Node runs the sources directly, core has no dependencies):
 *   node spikes/339/extrapolation.mts --reps 200 --seed 1 --out spikes/339/out
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import {
  fitPowder,
  type InteriorLoad,
  interior,
  type LadderPoint,
  type PowderFit,
  type PowderPredictionBand,
  powderInputDefaults,
  powderPressureRange,
  predictPowder,
} from '../../packages/core/src/index.ts'

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i < 0 ? fallback : (process.argv[i + 1] ?? fallback)
}
const reps = Number(arg('reps', '200'))
const seed = Number(arg('seed', '1'))
const outDir = arg('out', 'spikes/339/out')
const worlds = arg('worlds', 'exact,inputs,structure,structure-mild').split(',') as World[]

type World = 'exact' | 'inputs' | 'structure' | 'structure-mild'

// ---- random numbers (mulberry32, Box-Muller) ----
function normals(s: number): () => number {
  let a = s >>> 0
  const uniform = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return () => Math.sqrt(-2 * Math.log(1 - uniform())) * Math.cos(2 * Math.PI * uniform())
}

// ---- loads ----
const baseLoad = (vivacity = 0.45): InteriorLoad => ({
  chamber: { volume: 3.4e-6, boreArea: 3.75e-5, boreDiameter: 6.9e-3 },
  barrel: { length: 0.6, twist: 0.254 },
  bullet: { mass: 0.0095 },
  charge: 0.0024,
  propellant: {
    specificEnergy: 3.9e6,
    gamma: 1.23,
    density: 1600,
    covolume: 1e-3,
    burn: {
      kind: 'vivacity',
      vivacity,
      exponent: 1,
      referencePressure: 98066.5,
      form: { kind: 'twoStage', a: 0.8, m: 0.5, q: 0.5, z1: 0.8 },
    },
  },
  propellantTemperature: 294.15,
  ignitionPressure: 5e6,
  startPressure: 30e6,
})
const fitStart = baseLoad(0.38)

const rel = (key: 'caseCapacity' | 'propellantEnergy' | 'startPressure') => {
  const d = powderInputDefaults[key]
  if (!d) throw new Error(`no default for ${key}`)
  return d.estimated
}

/** The load that generated the data: the nominal one, with the errors of the world applied. */
function truthLoad(world: World, z: () => number): InteriorLoad {
  const t = baseLoad()
  if (world === 'inputs') {
    // fixed inputs of the fit drawn from the standard uncertainties the codebase assumes
    t.chamber.volume *= 1 + rel('caseCapacity') * z()
    t.propellant.specificEnergy *= 1 + rel('propellantEnergy') * z()
    t.startPressure *= Math.max(0.2, 1 + rel('startPressure') * z())
  }
  if (world === 'structure' || world === 'structure-mild') {
    // physics the fitted model does not have: heat loss, bore friction, another form function;
    // the mild case halves each departure
    const k = world === 'structure' ? 1 : 0.5
    t.heat = { model: 'convective', flameTemperature: 2800, factor: k }
    t.resistance = { friction: 5e6 * k }
    t.propellant.burn = {
      kind: 'vivacity',
      vivacity: 0.45,
      exponent: 1,
      referencePressure: 98066.5,
      form: { kind: 'twoStage', a: 0.8 - 0.1 * k, m: 0.5 + 0.1 * k, q: 0.5, z1: 0.8 },
    }
  }
  return t
}

/** Same powder in a geometrically similar cartridge: lengths, areas, volumes, masses by scale s. */
function scaleBore(l: InteriorLoad, s: number): InteriorLoad {
  return {
    ...l,
    chamber: {
      volume: l.chamber.volume * s ** 3,
      boreArea: l.chamber.boreArea * s ** 2,
      boreDiameter: l.chamber.boreDiameter * s,
    },
    barrel: { length: l.barrel.length * s, twist: l.barrel.twist * s },
    bullet: { ...l.bullet, mass: l.bullet.mass * s ** 3 },
    charge: l.charge * s ** 3,
  }
}

// ---- ladders ----
const velocitySigma = 4 // m/s, on the string mean
const pressureRel = 0.05 // relative standard uncertainty of a measured peak pressure
const g = 1e-3 // kg per g
const lin = (a: number, b: number, n: number) =>
  Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1))
const ladders = {
  // the ladder every axis but the charge-span comparison uses
  narrow: { charges: lin(2.2 * g, 2.6 * g, 5), barrels: [0.6], pressure: false },
  'narrow+p': { charges: lin(2.2 * g, 2.6 * g, 5), barrels: [0.6], pressure: true },
  wide: { charges: lin(1.9 * g, 2.7 * g, 6), barrels: [0.6], pressure: false },
  // two barrel lengths, five charges each
  'two-barrels': { charges: lin(2.2 * g, 2.6 * g, 5), barrels: [0.5, 0.6], pressure: false },
} as const
type LadderName = keyof typeof ladders

function makeLadder(truth: InteriorLoad, name: LadderName, z: () => number): LadderPoint[] | null {
  const spec = ladders[name]
  const pts: LadderPoint[] = []
  for (const length of spec.barrels) {
    for (const charge of spec.charges) {
      const r = interior({ ...truth, charge, barrel: { ...truth.barrel, length } })
      if (!r.valid) return null
      pts.push({
        charge,
        muzzleVelocity: r.muzzleVelocity + velocitySigma * z(),
        velocitySigma,
        ...(spec.barrels.length > 1 ? { barrelLength: length } : {}),
        ...(spec.pressure
          ? {
              peakPressure: r.peakBreechPressure * (1 + pressureRel * z()),
              pressureSigma: pressureRel * r.peakBreechPressure,
            }
          : {}),
      })
    }
  }
  return pts
}

// ---- accumulation ----
interface Cell {
  n: number
  fail: number
  hitV: number
  hitP: number
  hitPR: number
  nPR: number
  halfV: number
  halfP: number
  zV: number[]
  zP: number[]
}
const cells = new Map<string, Cell>()
const cell = (key: string): Cell => {
  let c = cells.get(key)
  if (!c) {
    c = { n: 0, fail: 0, hitV: 0, hitP: 0, hitPR: 0, nPR: 0, halfV: 0, halfP: 0, zV: [], zP: [] }
    cells.set(key, c)
  }
  return c
}
const fails = new Map<string, number>()
const bump = (k: string) => fails.set(k, (fails.get(k) ?? 0) + 1)

interface Truth {
  v: number
  p: number
}
function truthAt(l: InteriorLoad, charge: number, length: number): Truth | null {
  const r = interior({ ...l, charge, barrel: { ...l.barrel, length } })
  return r.valid ? { v: r.muzzleVelocity, p: r.peakBreechPressure } : null
}

const inside = (b: PowderPredictionBand, truth: number) => truth >= b.lower && truth <= b.upper
const z90 = (b: PowderPredictionBand, truth: number) =>
  b.standardUncertainty > 0 ? Math.abs(truth - b.value) / b.standardUncertainty : 0

interface Rec {
  v: number
  p: number
  hitV: boolean
  hitP: boolean
  hitPR: boolean | null
  halfV: number
  halfP: number
  zV: number
  zP: number
}
function push(c: Cell, r: Rec) {
  c.n++
  if (r.hitV) c.hitV++
  if (r.hitP) c.hitP++
  if (r.hitPR !== null) {
    c.nPR++
    if (r.hitPR) c.hitPR++
  }
  c.halfV += r.halfV
  c.halfP += r.halfP
  c.zV.push(r.zV)
  c.zP.push(r.zP)
}

/** Predict, compare with the truth and add to a cell. `range` is the pressure range band, when computed. */
function add(
  key: string,
  fit: PowderFit,
  charge: number,
  length: number | undefined,
  truth: Truth | null,
  range?: { lower: number; upper: number },
  boreScale?: number,
): Rec | null {
  const c = cell(key)
  if (!truth) {
    c.fail++
    return null
  }
  try {
    const f = boreScale === undefined ? fit : { ...fit, load: scaleBore(fit.load, boreScale) }
    const pr = predictPowder(f, charge, length === undefined ? {} : { barrelLength: length })
    const r: Rec = {
      v: pr.velocity.value,
      p: pr.pressure.value,
      hitV: inside(pr.velocity, truth.v),
      hitP: inside(pr.pressure, truth.p),
      hitPR: range ? truth.p >= range.lower && truth.p <= range.upper : null,
      halfV: (pr.coverageFactor * pr.velocity.standardUncertainty) / pr.velocity.value,
      halfP: (pr.coverageFactor * pr.pressure.standardUncertainty) / pr.pressure.value,
      zV: z90(pr.velocity, truth.v),
      zP: z90(pr.pressure, truth.p),
    }
    push(c, r)
    return r
  } catch {
    c.fail++
    return null
  }
}

const pct = (x: number) => `${x < 0 ? 'm' : 'p'}${Math.abs(Math.round(x * 1000) / 10)}`

// grids of relative distance outside the fitted range
const chargeGrid = [0.01, 0.02, 0.03, 0.05, 0.075, 0.1, 0.125, 0.15, 0.2, 0.25]
const barrelGrid = [0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 0.75, 1]
const boreGrid = [0.025, 0.05, 0.1, 0.15, 0.2, 0.3]

// bins of the relative distance of the predicted value outside the fitted values
const valueBins = [0, 0.01, 0.025, 0.05, 0.1, 0.2, 0.4, Number.POSITIVE_INFINITY]
const binOf = (d: number) => valueBins.findIndex((hi, i) => i > 0 && d <= hi && d > (valueBins[i - 1] ?? 0))

function runReplicate(world: World, rep: number) {
  const z = normals(seed * 1_000_003 + rep * 7919 + (['exact', 'inputs', 'structure', 'structure-mild'].indexOf(world)) * 104_729)
  const truth = truthLoad(world, z)
  for (const name of Object.keys(ladders) as LadderName[]) {
    const pts = makeLadder(truth, name, z)
    if (!pts) {
      bump(`${world}|${name}|ladder`)
      continue
    }
    let fit: PowderFit
    try {
      fit = fitPowder(fitStart, pts)
    } catch {
      bump(`${world}|${name}|fit`)
      continue
    }
    const spec = ladders[name]
    const cs = spec.charges
    const cmin = Math.min(...cs)
    const cmax = Math.max(...cs)
    const bMin = Math.min(...spec.barrels)
    const bMax = Math.max(...spec.barrels)
    const L0 = 0.6
    const mid = 2.4 * g
    const tag = `${world}|${name}`

    // observed velocity range of the ladder, and pressure range (measured, else model values)
    const vObs = pts.map((p) => p.muzzleVelocity)
    const pObs = spec.pressure
      ? pts.map((p) => p.peakPressure as number)
      : pts.map((p) => {
          const r = interior(
            { ...fit.load, charge: p.charge, barrel: { ...fit.load.barrel, length: p.barrelLength ?? L0 } },
          )
          return r.valid ? r.peakBreechPressure : Number.NaN
        })
    const vLo = Math.min(...vObs)
    const vHi = Math.max(...vObs)
    const pLo = Math.min(...pObs)
    const pHi = Math.max(...pObs)

    // pressure range of the fixed inputs, single barrel only
    const rangeFor = (points: { charge: number; barrelLength?: number }[]) => {
      if (spec.barrels.length > 1 || name === 'wide') return undefined
      try {
        return powderPressureRange(fit, pts, { points }).points
      } catch {
        bump(`${tag}|range`)
        return undefined
      }
    }

    // --- charge axis, with the value axes read off the same predictions ---
    const chargePts: { c: number; side: string; d: number }[] = []
    for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) chargePts.push({ c: cmin + f * (cmax - cmin), side: 'in', d: 0 })
    for (const d of chargeGrid) {
      chargePts.push({ c: cmax * (1 + d), side: 'above', d })
      chargePts.push({ c: cmin * (1 - d), side: 'below', d })
    }
    const bp: { L: number; side: string; d: number }[] = []
    if (spec.barrels.length === 1 || name === 'two-barrels') {
      bp.push({ L: (bMin + bMax) / 2, side: 'in', d: 0 })
      for (const d of barrelGrid) {
        bp.push({ L: bMax * (1 + d), side: 'above', d })
        if (bMin * (1 - d) > 0.05) bp.push({ L: bMin * (1 - d), side: 'below', d })
      }
    }
    const all = rangeFor([
      ...chargePts.map((x) => ({ charge: x.c, barrelLength: bMax })),
      ...bp.map((x) => ({ charge: mid, barrelLength: x.L })),
    ])
    const ranges = all?.slice(0, chargePts.length)
    const br = all?.slice(chargePts.length)
    chargePts.forEach((x, i) => {
      const range = ranges?.[i]
      const tr = truthAt(truth, x.c, bMax)
      const out = add(`${tag}|charge|${x.side}|${x.side === 'in' ? 0 : pct(x.d)}`, fit, x.c, undefined, tr, range)
      if (!out) return
      // value axes: bin the predicted value by its distance outside the ladder's values
      for (const [axis, val, lo, hi] of [
        ['velocity', out.v, vLo, vHi],
        ['pressure', out.p, pLo, pHi],
      ] as const) {
        const side = val > hi ? 'above' : val < lo ? 'below' : 'in'
        const dist = side === 'above' ? (val - hi) / hi : side === 'below' ? (lo - val) / lo : 0
        push(cell(`${tag}|${axis}|${side}|${side === 'in' ? 0 : valueBins[binOf(dist)]}`), out)
      }
    })

    // --- barrel length axis, at the middle charge ---
    bp.forEach((x, i) => {
      add(`${tag}|barrel|${x.side}|${x.side === 'in' ? 0 : pct(x.d)}`, fit, mid, x.L, truthAt(truth, mid, x.L), br?.[i])
    })

    // --- bore diameter axis, single bore ---
    if (name === 'narrow') {
      add(`${tag}|bore|in|0`, fit, mid, undefined, truthAt(scaleBore(truth, 1), mid, 0.6), undefined, 1)
      for (const d of boreGrid) {
        for (const [side, s] of [['above', 1 + d], ['below', 1 - d]] as const) {
          const t = scaleBore(truth, s)
          add(`${tag}|bore|${side}|${pct(d)}`, fit, mid * s ** 3, undefined, truthAt(t, mid * s ** 3, t.barrel.length), undefined, s)
        }
      }
    }
  }
}

// ---- run ----
const started = Date.now()
for (const world of worlds) {
  for (let rep = 0; rep < reps; rep++) {
    runReplicate(world, rep)
    if (rep % 10 === 9) console.error(`${world} ${rep + 1}/${reps} ${Math.round((Date.now() - started) / 1000)} s`)
  }
}

// ---- output ----
const quantile = (xs: number[], q: number) => {
  if (xs.length === 0) return Number.NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(q * s.length))] as number
}
const rows = [...cells.entries()]
    .map(([key, c]) => ({
    key,
    n: c.n,
    fail: c.fail,
    covV: c.hitV / c.n,
    covP: c.hitP / c.n,
    covPR: c.nPR ? c.hitPR / c.nPR : null,
    halfV: c.halfV / c.n,
    halfP: c.halfP / c.n,
    kV: quantile(c.zV, 0.9),
    kP: quantile(c.zP, 0.9),
  }))
mkdirSync(outDir, { recursive: true })
writeFileSync(`${outDir}/cells.json`, JSON.stringify({ reps, seed, failures: [...fails], rows }, null, 1))
console.error(`done in ${Math.round((Date.now() - started) / 1000)} s, ${rows.length} cells`)
