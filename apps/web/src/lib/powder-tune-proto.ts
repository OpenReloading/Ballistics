/**
 * Prototype of the powder tuning screen (throwaway): synthetic ladders from the interior model, the
 * fit, its refusals in plain words and the hand-tuned curve. Nothing here is measured data.
 */
import {
  fitPowder,
  type InteriorLoad,
  interior,
  type LadderPoint,
  type PowderConfidence,
  type PowderFit,
  PowderFitError,
  type PowderFitReason,
  type PowderParameter,
  powderConfidence,
  powderConfidenceRules,
  powderPressureRange,
  predictPowder,
} from '@open-reloading/core'

/** The synthetic rifle load of the core fit tests: truth B_a 0.45 1/s, start pressure 30 MPa. */
export const syntheticLoad = (vivacity: number, startPressure = 30e6): InteriorLoad => ({
  chamber: { volume: 3.4e-6, boreArea: 3.75e-5, boreDiameter: 6.9e-3 },
  barrel: { length: 0.6, twist: 0.254 },
  bullet: { mass: 0.0095 },
  charge: 0.0028,
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
  startPressure,
})

/** The burn coefficient the ladders are generated with. */
export const truthVivacity = 0.45
/** The burn coefficient of a similar powder, where the fit starts. */
export const startVivacity = 0.38

/** One string of a ladder: the charge in grams and the shot velocities in m/s. */
export interface TuneString {
  grams: number
  shots: number[]
}

/** A synthetic ladder with what the screen offers on it. */
export interface TuneLadder {
  id: string
  title: string
  /** What the case shows, one line. */
  note: string
  strings: TuneString[]
  /** Peak pressure per string, bar, when the ladder carries them. */
  pressures?: number[]
  /** Parameters the user asks for beyond the burn coefficient. */
  extra: PowderParameter[]
  /** Fit the extras although the ladder is thin: shows the refusals the thin rule would pre-empt. */
  override?: boolean
  /** Iteration limit below the core's 30, for the one case that needs 34 steps: it shows the same refusal on every platform. */
  maxIterations?: number
}

/** Deterministic uniform numbers (mulberry32). */
function uniforms(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Standard normal numbers (Box-Muller over `uniforms`). */
function normals(seed: number): () => number {
  const u = uniforms(seed)
  return () => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u())
}

const shotsPerString = 5
/** Shot-to-shot standard deviation of a string, m/s. */
const shotSd = 4

/** Strings with the model's velocity plus fixed-seed noise on every shot. */
export function strings(grams: number[], seed: number): TuneString[] {
  const n = normals(seed)
  return grams.map((g) => {
    const r = interior({ ...syntheticLoad(truthVivacity), charge: g / 1000 })
    if (!r.valid) throw new Error(`synthetic charge ${g} g: ${r.reason}`)
    return {
      grams: g,
      shots: Array.from(
        { length: shotsPerString },
        () => Math.round((r.muzzleVelocity + shotSd * n()) * 10) / 10,
      ),
    }
  })
}

const goodGrams = [2.6, 2.7, 2.81, 2.92, 3.04]

/** The ladders of the prototype: three cases of the issue, then one per refusal reason. */
export const ladders: TuneLadder[] = [
  {
    id: 'good',
    title: 'Good: 5 charges, 4 % steps',
    note: 'Burn coefficient fitted, band over the ladder.',
    strings: strings(goodGrams, 11),
    extra: [],
  },
  {
    id: 'thin',
    title: 'Thin: 2 charges',
    note: 'Two charges 7 % apart: warning, burn coefficient only.',
    strings: strings([2.7, 2.9], 12),
    extra: [],
  },
  {
    id: 'velocity-only',
    title: 'Velocity only: asks for the start pressure too',
    note: 'No pressures: the start pressure moves with the burn coefficient and is held.',
    strings: strings(goodGrams, 13),
    extra: ['startPressure'],
  },
  {
    id: 'underdetermined',
    title: 'Refusal: two charges, three values (thin rule off)',
    note: 'Two charges; burn coefficient, start pressure and chamber volume asked, thin rule overridden.',
    strings: strings([2.7, 2.9], 14),
    extra: ['startPressure', 'volumeFactor'],
    override: true,
  },
  {
    id: 'unresolved',
    title: 'Refusal: specific energy from one barrel',
    note: 'Specific energy asked from a ladder at one barrel length.',
    strings: strings(goodGrams, 15),
    extra: ['energy'],
  },
  {
    id: 'ill-conditioned',
    title: 'Refusal: three values from 3 charges at 10 %',
    note: 'Three charges 10 % apart; burn coefficient, start pressure and chamber volume asked.',
    strings: strings([2.7, 2.85, 2.97], 21),
    extra: ['startPressure', 'volumeFactor'],
  },
  {
    id: 'invalid',
    title: 'Refusal: a charge the chamber cannot hold',
    note: 'The sixth string is 3.5 g in a 3.4 cm3 case.',
    strings: [...strings(goodGrams, 17), { grams: 3.5, shots: [900, 905, 898, 902, 901] }],
    extra: [],
  },
  {
    id: 'not-converged',
    title: 'Refusal: three close charges, two values, 10 steps',
    note: 'Three charges 3 % apart; burn coefficient and start pressure asked, thin rule overridden. The fit needs 34 steps, so the limit is 10 here.',
    strings: strings([2.8, 2.84, 2.88], 21),
    extra: ['startPressure'],
    override: true,
    maxIterations: 10,
  },
]

/** Mean, SD and count of a string. */
export function summary(s: TuneString) {
  const n = s.shots.length
  const mean = s.shots.reduce((a, b) => a + b, 0) / n
  const sd = n > 1 ? Math.sqrt(s.shots.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0
  return { n, mean, sd }
}

/** Smallest number of charges and charge spread (max over min, less 1) for a fit of more than the burn coefficient. */
export const thinRules = { charges: 3, spread: 0.1 }

/** Whether the strings are too few or too close for more than the burn coefficient. */
export function thin(strs: readonly TuneString[]): boolean {
  const g = strs.map((s) => s.grams)
  return (
    strs.length < thinRules.charges || Math.max(...g) / Math.min(...g) - 1 < thinRules.spread - 1e-9
  )
}

/** The plain-words sentence for each refusal reason: the cause and one action. */
export const refusals: Record<PowderFitReason, string> = {
  underdetermined:
    'There are fewer charges than values to fit. Add a string at another charge, or fit the burn coefficient alone.',
  unresolved:
    'These strings cannot tell one of the values apart from the burn coefficient. Widen the charge spread, add a measured pressure, or fit the burn coefficient alone.',
  'ill-conditioned':
    'The charges are too close to separate the values you asked for. Add a string at a charge well apart from the others, or add a measured pressure.',
  invalid:
    'The model cannot run one of the charges. Check the charge of the highlighted string against the case and the bullet.',
  'not-converged':
    'The fit did not settle. Start from the burn coefficient of a similar powder, or fit fewer values.',
}

/** Shown when an extra value moves with the burn coefficient: held at its start value, burn coefficient fitted alone. */
export const heldText =
  'These strings cannot tell the start pressure or the chamber volume from the burn coefficient: they move together. They stay at their start values and only the burn coefficient is fitted. Add a measured pressure to fit more.'

/** Shown when the ladder is thin and the extras are left out. */
export const thinText = `Fewer than ${thinRules.charges} charges, or charges less than ${Math.round(thinRules.spread * 100)} % apart: only the burn coefficient is fitted, the other values stay at those of the similar powder.`

/** Wording of the band's limit, for the screen only. */
export const bandNote =
  'Band: uncertainty of the fitted parameters only, not model error. Simulation, not load data.'

/** Request to the worker. */
export interface TuneRequest {
  ladderId: string
  /** Replaces the strings of the ladder (added or edited ones). */
  strings?: TuneString[]
  /** Fit the extras of a thin ladder anyway. */
  override?: boolean
}

/** A point of the curve drawn over the charge range. */
export interface CurvePoint {
  grams: number
  velocity: number
  lower?: number
  upper?: number
}

/** What the screen shows. */
export interface TuneAnswer {
  /** The ladder this answer belongs to. */
  ladderId: string
  thin: boolean
  /** Extras left out because they move with the burn coefficient. */
  held: boolean
  asked: PowderParameter[]
  used: PowderParameter[]
  refusal?: { reason: PowderFitReason; text: string; grams?: number | undefined }
  fit?: {
    parameters: { name: PowderParameter; initial: number; value: number; sigma?: number }[]
    residuals: { grams: number; observed: number; predicted: number }[]
    chiSquare: number
    degreesOfFreedom: number
    label: PowderConfidence['label']
    reasons: PowderConfidence['reasons']
    halfWidth: number
    load: InteriorLoad
    correlation?: number
  }
  curve: CurvePoint[]
  /** Milliseconds of the fit, of the band over the curve, of the pressure range. */
  ms: { fit: number; band: number; range: number }
}

const lines = (n: number, lo: number, hi: number) =>
  Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1))

/**
 * Pooled standard deviation of the shots about their string means, m/s: the sample SD of a string
 * of five shots is too noisy to weight a row by (see FINDING.md, coverage).
 */
export function pooledSd(strs: readonly TuneString[]): number {
  const v = strs.map(summary).filter((x) => x.n > 1)
  const dof = v.reduce((a, x) => a + x.n - 1, 0)
  return dof === 0 ? 0 : Math.sqrt(v.reduce((a, x) => a + (x.n - 1) * x.sd ** 2, 0) / dof)
}

/** The ladder points of the strings: the string mean, uncertainty pooled SD over root n. */
export function pointsOf(
  strs: readonly TuneString[],
  pressures: readonly number[] | undefined,
): LadderPoint[] {
  const sd = Math.max(pooledSd(strs), 0.5)
  return strs.map((s, i) => {
    const { n, mean } = summary(s)
    const p = pressures?.[i]
    return {
      charge: s.grams / 1000,
      muzzleVelocity: mean,
      velocitySigma: sd / Math.sqrt(n),
      ...(p === undefined
        ? {}
        : {
            peakPressure: p * 1e5,
            pressureSigma: p * 1e5 * 0.03,
            pressureBasis: 'transducer' as const,
          }),
    }
  })
}

/** Grid of the drawn curve: the ladder's range widened by 10 % each way. */
function grid(strs: readonly TuneString[], n = 25): number[] {
  const g = strs.map((s) => s.grams).filter((x) => x < 3.4)
  return lines(n, Math.min(...g) * 0.9, Math.max(...g) * 1.1)
}

/** The model's velocity at each gram value for `load`; null where the run is invalid. */
export function velocities(load: InteriorLoad, grams: readonly number[]): (number | null)[] {
  return grams.map((g) => {
    const r = interior({ ...load, charge: g / 1000 })
    return r.valid ? r.muzzleVelocity : null
  })
}

/** Largest magnitude of the correlation of an extra value with the burn coefficient before it is held. */
export const heldCorrelation = powderConfidenceRules.correlation

/** Fit, refusal and prediction band of a ladder, as the worker runs them. */
export function tune(request: TuneRequest): TuneAnswer {
  const ladder = ladders.find((l) => l.id === request.ladderId)
  if (!ladder) throw new Error(`no ladder ${request.ladderId}`)
  const strs = request.strings ?? ladder.strings
  const asked: PowderParameter[] = ['burnRate', ...ladder.extra]
  const isThin = thin(strs)
  const override = request.override ?? ladder.override ?? false
  const start = syntheticLoad(startVivacity)
  const points = pointsOf(strs, ladder.pressures)
  const ms = { fit: 0, band: 0, range: 0 }
  const base = { ladderId: ladder.id, thin: isThin, asked }
  const run = (parameters: PowderParameter[]) => {
    const t = performance.now()
    try {
      return fitPowder(start, points, {
        parameters,
        ...(ladder.maxIterations === undefined ? {} : { maxIterations: ladder.maxIterations }),
      })
    } finally {
      ms.fit += performance.now() - t
    }
  }
  let used: PowderParameter[] = isThin && !override ? ['burnRate'] : asked
  let fit: PowderFit
  let held = false
  try {
    fit = run(used)
    // an extra value that moves with the burn coefficient is not fixed by the strings
    const burn = fit.parameters.findIndex((p) => p.name === 'burnRate')
    const tied = fit.parameters.some(
      (_, j) => j !== burn && Math.abs(fit.correlation?.[burn]?.[j] ?? 0) > heldCorrelation,
    )
    if (tied) {
      held = true
      used = ['burnRate']
      fit = run(used)
    }
  } catch (e) {
    if (!(e instanceof PowderFitError)) throw e
    return {
      ...base,
      held: false,
      used,
      refusal: {
        reason: e.reason,
        text: refusals[e.reason],
        grams: e.charge === undefined ? undefined : e.charge * 1000,
      },
      curve: [],
      ms,
    }
  }
  const t1 = performance.now()
  const curve: CurvePoint[] = grid(strs).map((g) => {
    const p = predictPowder(fit, g / 1000)
    return {
      grams: g,
      velocity: p.velocity.value,
      lower: p.velocity.lower,
      upper: p.velocity.upper,
    }
  })
  ms.band = performance.now() - t1
  const t2 = performance.now()
  const range = powderPressureRange(fit, points, { fit: { parameters: used } })
  const confidence = powderConfidence(fit, range)
  ms.range = performance.now() - t2
  return {
    ...base,
    held,
    used,
    fit: {
      parameters: fit.parameters.map((p) => ({
        name: p.name,
        initial: p.initial,
        value: p.value,
        ...(p.standardUncertainty === undefined ? {} : { sigma: p.standardUncertainty }),
      })),
      residuals: fit.residuals
        .filter((r) => r.kind === 'velocity')
        .map((r) => ({ grams: r.charge * 1000, observed: r.observed, predicted: r.predicted })),
      chiSquare: fit.chiSquare,
      degreesOfFreedom: fit.degreesOfFreedom,
      label: confidence.label,
      reasons: confidence.reasons,
      halfWidth: confidence.relativeHalfWidth,
      load: fit.load,
    },
    curve,
    ms,
  }
}

/** Hand tuning: the fitted load with some parameters moved, the model's curve over the grid. */
export function handTune(
  load: InteriorLoad,
  values: Partial<Record<PowderParameter, number>>,
  grams: readonly number[],
): { velocities: (number | null)[]; runMs: number } {
  const t0 = performance.now()
  let next = load
  const burn = next.propellant.burn
  if (values.burnRate !== undefined && burn.kind === 'vivacity')
    next = {
      ...next,
      propellant: { ...next.propellant, burn: { ...burn, vivacity: values.burnRate } },
    }
  if (values.startPressure !== undefined) next = { ...next, startPressure: values.startPressure }
  if (values.energy !== undefined)
    next = { ...next, propellant: { ...next.propellant, specificEnergy: values.energy } }
  if (values.volumeFactor !== undefined)
    next = {
      ...next,
      chamber: { ...next.chamber, volume: load.chamber.volume * values.volumeFactor },
    }
  return { velocities: velocities(next, grams), runMs: performance.now() - t0 }
}
