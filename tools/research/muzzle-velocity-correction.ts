/**
 * Research script: how much a speed read downrange differs from the muzzle velocity, and whether
 * `muzzleVelocityFromDownrange` gives the flown muzzle velocity back. Synthetic bullets (a mass
 * from a sectional density, a ballistic coefficient from an assumed form factor) on the bullet
 * diameters the cartridge records state. Every seed is fixed. Run from the repository root:
 * `node tools/research/muzzle-velocity-correction.ts`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import {
  airDensity,
  dragCoefficient,
  dragTables,
  lbPerSqInToKgPerSqM,
  muzzleVelocityFromDownrange,
  type Projectile,
  speedOfSound,
  standardAtmosphere,
  trajectory,
} from '../../packages/core/src/index.ts'
import { uniforms } from '../../packages/core/test/random.ts'

const air = standardAtmosphere(0)
const rho = airDensity(air)
const a0 = speedOfSound(air)
const grain = 0.00006479891

/** Share of the velocity below which a correction counts as not worth making (placeholder, unverified). */
const LIMIT_PERCENT = 0.1
/** Shots of the bias test. */
const SHOTS = 1000
/** Muzzle velocities of the table at 5 m, m/s. */
const SPEEDS = [350, 650, 950]

interface Combo {
  /** Label for the table. */
  name: string
  diameter: number
  sd: number
  model: 'G1' | 'G7'
  /** Ballistic coefficient, kg/m2. */
  bc: number
  projectile: Projectile
}

/** The 12 most frequent bullet diameters (mm, 4 to 13) of the cartridge records. */
function calibres(): number[] {
  const dir = 'packages/data/records/cartridges/'
  const count = new Map<number, number>()
  for (const f of readdirSync(dir)) {
    const rec = JSON.parse(readFileSync(dir + f, 'utf8')) as {
      values: { side: string; symbol: string; value: number }[]
    }
    const v = rec.values.find((x) => x.side === 'cartridge' && x.symbol === 'G1')?.value
    if (v !== undefined && v >= 4 && v <= 13) count.set(v, (count.get(v) ?? 0) + 1)
  }
  return [...count]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 12)
    .map(([d]) => d)
    .sort((a, b) => a - b)
}

/** Sectional density (lb/in2), standard function and form factor of the four synthetic bullets per calibre. */
const BULLETS: [number, 'G1' | 'G7', number][] = [
  [0.16, 'G1', 0.55],
  [0.22, 'G1', 0.55],
  [0.22, 'G7', 1],
  [0.28, 'G7', 1],
]

const combos: Combo[] = calibres().flatMap((mm) =>
  BULLETS.map(([sd, model, form]) => {
    const d = mm * 1e-3
    const bc = (sd / form) * lbPerSqInToKgPerSqM
    return {
      name: `${mm} mm, SD ${sd}, ${model}`,
      diameter: d,
      sd,
      model,
      bc,
      projectile: {
        mass: sd * lbPerSqInToKgPerSqM * d * d,
        diameter: d,
        drag: { kind: 'bc', model, bands: [{ ballisticCoefficient: bc, minVelocity: 0 }] },
      },
    }
  }),
)

/** Speed the run reaches at `distance` from a known muzzle velocity, m/s. */
function flown(p: Projectile, muzzleVelocity: number, distance: number): number {
  const t = trajectory(
    {
      projectile: p,
      muzzleVelocity,
      firearm: { sightHeight: 0 },
      air,
      zero: { elevationAngle: 0, windageAngle: 0 },
    },
    [distance],
    { coriolis: false },
  )
  const q = t.points[0]
  if (!q) throw new Error('distance not reached')
  return q.velocity
}

const correct = (p: Projectile, v: number, distance: number) =>
  muzzleVelocityFromDownrange({ projectile: p, air, distance, velocity: v })

/** Closed-form loss v (exp(k s) - 1) with a drag coefficient of the area pi d2 / 4 that is held constant. */
const closedForm = (cd: number, p: Projectile, v: number, s: number) =>
  v * (Math.exp(((rho * cd * Math.PI * p.diameter ** 2) / (8 * p.mass)) * s) - 1)

console.log(`combinations: ${combos.length}, calibres (mm): ${calibres().join(' ')}`)

// 1. bias over seeded shots
const next = uniforms(371)
let sum = 0
let sum2 = 0
let worst = 0
let sumCorr = 0
for (let i = 0; i < SHOTS; i++) {
  const c = combos[Math.floor(next() * combos.length)] as Combo
  const v0 = 300 + 700 * next()
  const s = 1 + 9 * next()
  const v = flown(c.projectile, v0, s)
  const e = correct(c.projectile, v, s) - v0
  sum += e
  sum2 += e * e
  worst = Math.max(worst, Math.abs(e))
  sumCorr += v0 - v
}
console.log(
  `1. ${SHOTS} shots, v0 300 to 1000 m/s, distance 1 to 10 m: mean bias ${(sum / SHOTS).toExponential(2)} m/s, ` +
    `rms ${Math.sqrt(sum2 / SHOTS).toExponential(2)} m/s, largest ${worst.toExponential(2)} m/s, ` +
    `mean correction ${(sumCorr / SHOTS).toFixed(2)} m/s`,
)

// 1b. independent check: a constant drag coefficient has the exact solution v = v0 exp(-k s)
{
  const nextC = uniforms(3710)
  let sumC = 0
  let worstC = 0
  for (let i = 0; i < SHOTS; i++) {
    const c = combos[Math.floor(nextC() * combos.length)] as Combo
    const p: Projectile = {
      ...c.projectile,
      drag: {
        kind: 'curve',
        curve: [
          [0, 0.3],
          [10, 0.3],
        ],
      },
    }
    const v0 = 300 + 700 * nextC()
    const s = 1 + 9 * nextC()
    const v = v0 * Math.exp(-((rho * 0.3 * Math.PI * p.diameter ** 2) / (8 * p.mass)) * s)
    const e = correct(p, v, s) - v0
    sumC += e
    worstC = Math.max(worstC, Math.abs(e))
  }
  console.log(
    `1b. ${SHOTS} shots on a constant Cd 0.3, closed form as truth: mean bias ${(sumC / SHOTS).toExponential(2)} m/s, largest ${worstC.toExponential(2)} m/s`,
  )
}

// 2. the two named cases: constant coefficient (closed form) and a G7 bullet
const named: [string, Projectile, number, number][] = [
  [
    '68 gr, 6.17 mm, Cd 0.3',
    {
      mass: 68 * grain,
      diameter: 6.17e-3,
      drag: {
        kind: 'curve',
        curve: [
          [0, 0.3],
          [10, 0.3],
        ],
      },
    },
    2.44,
    975,
  ],
  [
    '68 gr, 6.17 mm, G7 0.15',
    {
      mass: 68 * grain,
      diameter: 6.17e-3,
      drag: {
        kind: 'bc',
        model: 'G7',
        bands: [{ ballisticCoefficient: 0.15 * lbPerSqInToKgPerSqM, minVelocity: 0 }],
      },
    },
    2.44,
    975,
  ],
  [
    '175 gr, 7.82 mm, G7 0.27',
    {
      mass: 175 * grain,
      diameter: 7.82e-3,
      drag: {
        kind: 'bc',
        model: 'G7',
        bands: [{ ballisticCoefficient: 0.27 * lbPerSqInToKgPerSqM, minVelocity: 0 }],
      },
    },
    4.0,
    800,
  ],
]
console.log(
  '2. named cases: case | distance m | v0 m/s | flown m/s | loss m/s | corrected - v0 m/s | closed form (Cd 0.3) loss',
)
for (const [name, p, s, v0] of named) {
  const v = flown(p, v0, s)
  const back = correct(p, v, s)
  console.log(
    `${name} | ${s} | ${v0} | ${v.toFixed(3)} | ${(v0 - v).toFixed(3)} | ${(back - v0).toExponential(1)} | ${closedForm(0.3, p, v0, s).toFixed(3)}`,
  )
}

// 3. size of the effect at 5 m
console.log(
  '3. at 5 m, per bullet type (mean over the calibres): type | v0 | loss m/s | percent | spread of percent over calibres | closed form at the local Cd / model | closed form at Cd 0.3 / model',
)
let below = 0
let total = 0
let minPct = Number.POSITIVE_INFINITY
let maxPct = 0
let maxSpread = 0
for (const [sd, model] of BULLETS) {
  const type = combos.filter((c) => c.sd === sd && c.model === model)
  for (const v0 of SPEEDS) {
    const rows = type.map((c) => {
      const v = flown(c.projectile, v0, 5)
      const loss = v0 - v
      const pct = (100 * loss) / v
      // constant-Cd closed form at the Cd of the standard function at the launch Mach number
      const cg = dragCoefficient(dragTables[c.model], v0 / a0)
      const local = v0 * (Math.exp(((Math.PI * rho * cg) / (8 * c.bc)) * 5) - 1)
      return { loss, pct, local: local / loss, fixed: closedForm(0.3, c.projectile, v0, 5) / loss }
    })
    for (const r of rows) {
      total++
      if (r.pct < LIMIT_PERCENT) below++
      minPct = Math.min(minPct, r.pct)
      maxPct = Math.max(maxPct, r.pct)
    }
    const pcts = rows.map((r) => r.pct)
    const spread = Math.max(...pcts) - Math.min(...pcts)
    maxSpread = Math.max(maxSpread, spread)
    const mean = (f: (r: (typeof rows)[number]) => number) =>
      rows.reduce((t, r) => t + f(r), 0) / rows.length
    const range = (f: (r: (typeof rows)[number]) => number) =>
      `${Math.min(...rows.map(f)).toFixed(3)} to ${Math.max(...rows.map(f)).toFixed(3)}`
    console.log(
      `SD ${sd} ${model} | ${v0} | ${mean((r) => r.loss).toFixed(2)} | ${mean((r) => r.pct).toFixed(3)} | ${spread.toExponential(1)} | ${range((r) => r.local)} | ${range((r) => r.fixed)}`,
    )
  }
}
console.log(
  `3. all ${total} cases: ${minPct.toFixed(3)} to ${maxPct.toFixed(3)} percent; ${below} below ${LIMIT_PERCENT} percent; largest spread over the calibres ${maxSpread.toExponential(1)} percent points`,
)

// 4. rule
console.log(
  `4. rule: ${below === total ? 'no change (every case below the limit)' : `build (${total - below} of ${total} cases at or above ${LIMIT_PERCENT} percent)`}`,
)
