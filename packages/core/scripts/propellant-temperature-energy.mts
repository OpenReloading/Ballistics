/**
 * Study of the propellant-temperature term of the specific energy
 * (`apps/docs/docs/research/propellant-temperature-energy.md`). Synthetic loads and ladders only:
 * simulations, not load data. Run from the repository root, after `npm ci`:
 *
 *   node packages/core/scripts/propellant-temperature-energy.mts
 *
 * Prints the three tables of the entry as Markdown. Seeds are fixed, so a rerun prints the same
 * numbers. The rules below were set before the first run.
 *
 * Study 1: change of muzzle velocity and peak breech pressure for a step of `step` K above the
 * reference, from the burn-rate term alone, the energy term alone and both. Energy share =
 * change of the energy term alone / change of both together.
 *
 * Study 2: ladders from a truth at three temperatures, fitted with (A) the current model, whose
 * shared temperature factor is free, and (B) the same with the energy coefficient fixed at the
 * figure of the study. Metric: RMS of the residual against independently noisy held-out strings
 * (velocity in m/s, peak breech pressure in percent), pooled over the replicates, and the same
 * against the noise-free truth. Two spans: interpolating (fit on the outer two temperatures, hold
 * out the middle one) and extrapolating (fit on all three, hold out 20 K beyond the hottest).
 *
 * Rule: the option is supported when, with the term in the truth, (B) has an RMS at least 15 %
 * lower than (A) for velocity and pressure at both spans in both calibration arms, and, with no
 * term in the truth, (B) has an RMS at most 5 % above (A) in all of them.
 */
import { fitPowder, type InteriorLoad, interior, type LadderPoint } from '../src/index.ts'
import { normals } from '../test/random.ts'

const reference = 294.15
const step = 5.6
const burnSensitivity = 0.004
const energyCoefficient = 3e-4
const replicates = 50
const velocitySigma = 3
const pressureSigma = 0.03

const kept = (load: InteriorLoad): InteriorLoad => load

/** Run of a load; a refusal is a defect of the study. */
function run(load: InteriorLoad) {
  const r = interior(load)
  if (!r.valid) throw new Error(`${r.reason} ${r.field ?? ''}`)
  return r
}

/** Sensitivities, reference and energy coefficient put on a load. */
const withTemperature = (
  load: InteriorLoad,
  burn: number,
  energy: number,
  temperature: number,
): InteriorLoad => ({
  ...load,
  propellant: {
    ...load.propellant,
    temperatureSensitivity: { reference, cold: burn, hot: burn },
    energyTemperature: energy,
  },
  propellantTemperature: temperature,
})

const plain: InteriorLoad = kept({
  chamber: { volume: 3.4e-6, boreArea: 3.75e-5, boreDiameter: 7e-3 },
  barrel: { length: 0.6, twist: 0.254 },
  bullet: { mass: 0.0095 },
  charge: 0.0028,
  propellant: {
    specificEnergy: 3.9e6,
    gamma: 1.23,
    density: 1600,
    covolume: 1e-3,
    burn: {
      kind: 'geometric',
      coefficient: 7e-9,
      exponent: 0.9,
      grain: { shape: 'sevenPerf', diameter: 1.25e-3, perforationDiameter: 1.5e-4, length: 2e-3 },
    },
  },
  propellantTemperature: reference,
  ignitionPressure: 5e6,
  startPressure: 25e6,
})

const resisted: InteriorLoad = {
  ...plain,
  resistance: {
    friction: 4e6,
    engraving: [
      { travel: 0.001, pressure: 0 },
      { travel: 0.003, pressure: 50e6 },
      { travel: 0.008, pressure: 10e6 },
    ],
  },
  heat: {
    model: 'convective',
    flameTemperature: 2900,
    wallTemperature: 300,
    viscosity: 8e-5,
    prandtl: 0.7,
  },
}

const gun: InteriorLoad = {
  chamber: { volume: 0.0215, boreArea: (Math.PI / 4) * 0.203 ** 2, boreDiameter: 0.203 },
  barrel: { length: 4.1, twist: 0 },
  bullet: { mass: 90 },
  charge: 10,
  propellant: {
    specificEnergy: 3.4e6,
    gamma: 1.24,
    density: 1650,
    covolume: 1e-3,
    burn: {
      kind: 'geometric',
      coefficient: 2e-9,
      exponent: 1,
      grain: { shape: 'sevenPerf', diameter: 15e-3, perforationDiameter: 1.1e-3, length: 22e-3 },
    },
  },
  propellantTemperature: reference,
  ignitionPressure: 1e6,
  startPressure: 20e6,
  resistance: { friction: 1e6 },
}

const pistol: InteriorLoad = {
  chamber: { volume: 1.2e-6, boreArea: 6.36e-5, boreDiameter: 9e-3 },
  barrel: { length: 0.1, twist: 0.25 },
  bullet: { mass: 0.008 },
  charge: 0.0004,
  propellant: {
    specificEnergy: 3.6e6,
    gamma: 1.25,
    density: 1550,
    covolume: 1e-3,
    burn: {
      kind: 'geometric',
      coefficient: 1.2e-7,
      exponent: 0.85,
      grain: { shape: 'cylinder', diameter: 8e-4, length: 8e-4 },
    },
  },
  propellantTemperature: reference,
  ignitionPressure: 5e6,
  startPressure: 15e6,
}

const loads: [string, InteriorLoad][] = [
  ['rifle, charge 2.8 g', plain],
  ['rifle, resistance and heat loss', resisted],
  ['gun, 203 mm bore', gun],
  ['rifle, light charge 1.8 g', { ...plain, charge: 0.0018 }],
  ['rifle, heavy charge 3.3 g', { ...plain, charge: 0.0033 }],
  ['pistol, 0.4 g', pistol],
]

const pct = (a: number, b: number) => (100 * (a - b)) / b

function study1() {
  const lines = [
    '| load | charge / bullet | charge / chamber (kg/m³) | burn term: v / p (%) | energy term: v / p (%) | both: v / p (%) | energy share: v / p |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ]
  for (const [name, load] of loads) {
    const at = (burn: number, energy: number, t: number) =>
      run(withTemperature(load, burn, energy, t))
    const base = at(0, 0, reference)
    const change = (burn: number, energy: number) => {
      const r = at(burn, energy, reference + step)
      return [
        pct(r.muzzleVelocity, base.muzzleVelocity),
        pct(r.peakBreechPressure, base.peakBreechPressure),
      ] as const
    }
    const b = change(burnSensitivity, 0)
    const e = change(0, energyCoefficient)
    const t = change(burnSensitivity, energyCoefficient)
    const f = (x: readonly [number, number]) => `${x[0].toFixed(3)} / ${x[1].toFixed(2)}`
    lines.push(
      `| ${name} | ${(load.charge / load.bullet.mass).toFixed(3)} | ${(load.charge / load.chamber.volume).toFixed(0)} | ${f(b)} | ${f(e)} | ${f(t)} | ${((100 * e[0]) / t[0]).toFixed(1)} % / ${((100 * e[1]) / t[1]).toFixed(1)} % |`,
    )
  }
  return lines.join('\n')
}

/** Ladder load of the fits: a vivacity burn law, so the burn rate is one number to fit. */
const ladderLoad: InteriorLoad = {
  ...plain,
  propellant: {
    ...plain.propellant,
    burn: {
      kind: 'vivacity',
      vivacity: 0.45,
      exponent: 1,
      referencePressure: 98066.5,
      form: { kind: 'twoStage', a: 0.8, m: 0.5, q: 0.5, z1: 0.8 },
    },
  },
  startPressure: 30e6,
}
const charges = [2.6e-3, 2.8e-3, 3e-3]
const calibrationTemperatures = [274.15, 294.15, 314.15]
/** Interpolating span: fit on the outer two, hold out the middle. Extrapolating: fit on all three, hold out 20 K beyond. */
const spans = [
  { name: 'interpolating (294 K)', fit: [274.15, 314.15], held: 294.15 },
  { name: 'extrapolating (334 K)', fit: calibrationTemperatures, held: 334.15 },
] as const
const truthFor = (energy: number, charge: number, temperature: number) =>
  run({
    ...withTemperature(ladderLoad, burnSensitivity, energy, temperature),
    charge,
  })
/** The load a fit starts from: burn rate 12 % low and sensitivities 25 % low, away from the truth. */
const start = (energy: number): InteriorLoad => {
  const burn = ladderLoad.propellant.burn
  if (burn.kind !== 'vivacity') throw new Error('vivacity burn expected')
  return {
    ...withTemperature(ladderLoad, 0.75 * burnSensitivity, energy, reference),
    propellant: {
      ...withTemperature(ladderLoad, 0.75 * burnSensitivity, energy, reference).propellant,
      burn: { ...burn, vivacity: 0.88 * burn.vivacity },
    },
  }
}

interface Rms {
  /** Against noisy held-out strings: velocity m/s, pressure %. */
  velocity: number
  pressure: number
  /** Against the noise-free truth. */
  velocityModel: number
  pressureModel: number
  failed: number
}

/** Pooled RMS over the replicates of one arm, span and model. */
function evaluate(
  truthEnergy: number,
  fitEnergy: number,
  span: (typeof spans)[number],
  withPressure: boolean,
): Rms {
  const sum = { v: 0, p: 0, vm: 0, pm: 0 }
  let n = 0
  let failed = 0
  for (let r = 0; r < replicates; r++) {
    const noise = normals(1000 + r)
    const held = normals(5000 + r)
    const ladder: LadderPoint[] = span.fit.flatMap((temperature) =>
      charges.map((charge) => {
        const t = truthFor(truthEnergy, charge, temperature)
        return {
          charge,
          propellantTemperature: temperature,
          muzzleVelocity: t.muzzleVelocity + velocitySigma * noise(),
          velocitySigma,
          ...(withPressure
            ? {
                peakPressure: t.peakBreechPressure * (1 + pressureSigma * noise()),
                pressureSigma: pressureSigma * t.peakBreechPressure,
                pressureBasis: 'transducer' as const,
              }
            : {}),
        }
      }),
    )
    let fitted: InteriorLoad
    try {
      fitted = fitPowder(start(fitEnergy), ladder, {
        parameters: ['burnRate', 'temperatureFactor'],
        maxIterations: 60,
      }).load
    } catch {
      failed++
      continue
    }
    for (const charge of charges) {
      const t = truthFor(truthEnergy, charge, span.held)
      const p = run({ ...fitted, charge, propellantTemperature: span.held })
      const measuredV = t.muzzleVelocity + velocitySigma * held()
      const measuredP = t.peakBreechPressure * (1 + pressureSigma * held())
      sum.v += (p.muzzleVelocity - measuredV) ** 2
      sum.p += pct(p.peakBreechPressure, measuredP) ** 2
      sum.vm += (p.muzzleVelocity - t.muzzleVelocity) ** 2
      sum.pm += pct(p.peakBreechPressure, t.peakBreechPressure) ** 2
      n++
    }
  }
  const root = (x: number) => Math.sqrt(x / n)
  return {
    velocity: root(sum.v),
    pressure: root(sum.p),
    velocityModel: root(sum.vm),
    pressureModel: root(sum.pm),
    failed,
  }
}

interface Row {
  arm: string
  span: string
  a: Rms
  b: Rms
}

const arms = [
  {
    name: 'truth with term, velocity only',
    truth: energyCoefficient,
    pressure: false,
    wrong: false,
  },
  {
    name: 'truth with term, velocity and pressure',
    truth: energyCoefficient,
    pressure: true,
    wrong: false,
  },
  { name: 'truth without term, velocity only', truth: 0, pressure: false, wrong: true },
  { name: 'truth without term, velocity and pressure', truth: 0, pressure: true, wrong: true },
]

function study2() {
  const rows: (Row & { wrong: boolean })[] = arms.flatMap((arm) =>
    spans.map((span) => ({
      arm: arm.name,
      span: span.name,
      wrong: arm.wrong,
      a: evaluate(arm.truth, 0, span, arm.pressure),
      b: evaluate(arm.truth, energyCoefficient, span, arm.pressure),
    })),
  )
  const lines = [
    '| arm | held-out span | model | velocity RMS (m/s) | pressure RMS (%) | velocity, noise-free truth | pressure, noise-free truth | failed fits |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ]
  for (const r of rows)
    for (const [model, x] of [
      ['A', r.a],
      ['B', r.b],
    ] as const)
      lines.push(
        `| ${r.arm} | ${r.span} | ${model} | ${x.velocity.toFixed(2)} | ${x.pressure.toFixed(2)} | ${x.velocityModel.toFixed(2)} | ${x.pressureModel.toFixed(2)} | ${x.failed} |`,
      )
  // change of (B) against (A) in percent of (A); negative is better
  const change = (r: Row) => ({
    v: pct(r.b.velocity, r.a.velocity),
    p: pct(r.b.pressure, r.a.pressure),
  })
  const verdict = [
    '| arm | held-out span | velocity RMS, B against A (%) | pressure RMS, B against A (%) | criterion met |',
    '| --- | --- | --- | --- | --- |',
  ]
  for (const r of rows) {
    const c = change(r)
    const met = r.wrong ? c.v <= 5 && c.p <= 5 : c.v <= -15 && c.p <= -15
    verdict.push(
      `| ${r.arm} | ${r.span} | ${c.v.toFixed(1)} | ${c.p.toFixed(1)} | ${met ? 'yes' : 'no'} |`,
    )
  }
  const supported = rows.every((r) => {
    const c = change(r)
    return r.wrong ? c.v <= 5 && c.p <= 5 : c.v <= -15 && c.p <= -15
  })
  return {
    table: lines.join('\n'),
    verdict: verdict.join('\n'),
    text: `Rule met in every arm and span: ${supported ? 'yes' : 'no'}.`,
  }
}

console.log('### Study 1\n')
console.log(study1())
const two = study2()
console.log('\n### Study 2\n')
console.log(two.table)
console.log('\n### Verdict\n')
console.log(two.verdict)
console.log(`\n${two.text}`)
