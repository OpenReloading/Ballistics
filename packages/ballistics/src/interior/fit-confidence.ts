/** The peak-pressure range the fixed inputs add, a prior from similar powders and the confidence label (`apps/docs/docs/models/interior-powder-fit.md`, "Pressure range from the fixed inputs", "Prior from similar powders", "Confidence label"), describing the simulation's uncertainty, not a load; SI in and out. */

import { nth } from '@rangefoundry/statistics'
import { need } from '../issue.ts'
import type { Complete } from '../key-list.ts'
import {
  fitPowder,
  type LadderPoint,
  outsideDomain,
  type PowderFit,
  PowderFitError,
  type PowderFitOptions,
  type PowderParameter,
  type PowderPrediction,
  type PowderPrior,
  predictPowder,
} from './fit.ts'
import { type InteriorLoad, interior } from './model.ts'

/** An input of the interior model that the range can shift by its standard uncertainty. */
export type PowderInput =
  | 'caseCapacity'
  | 'propellantEnergy'
  | 'startPressure'
  | 'boreFriction'
  | 'propellantTemperature'
  | 'ignitionPressure'
  | 'gamma'
  | 'covolume'
  | 'bulletMass'

/** How an input is known: `measured` (or entered) for this load, `estimated` (or assumed) otherwise. */
export type InputBasis = 'measured' | 'estimated'

/** Default standard uncertainty of an input: relative to its value, or in K for the temperature. */
interface InputDefault {
  /** `relative` fraction of the value, or `K`. */
  unit: 'relative' | 'K'
  /** When the input is measured or entered; absent where there is no such case. */
  measured?: number
  /** When the input is taken from a record or assumed. */
  estimated: number
}

/** Where the caller states none, assumptions on the model page; inputs not listed (ignition pressure, gamma, covolume, bullet mass) count only with a stated uncertainty. */
const powderInputDefaults: Readonly<Partial<Record<PowderInput, Readonly<InputDefault>>>> =
  Object.freeze({
    caseCapacity: Object.freeze({ unit: 'relative', measured: 0.005, estimated: 0.03 }),
    propellantEnergy: Object.freeze({ unit: 'relative', estimated: 0.03 }),
    startPressure: Object.freeze({ unit: 'relative', estimated: 0.25 }),
    boreFriction: Object.freeze({ unit: 'relative', estimated: 0.3 }),
    propellantTemperature: Object.freeze({ unit: 'K', measured: 3, estimated: 10 }),
  })

/** A point at which the range is evaluated: a charge, fired at the load's barrel and temperature unless stated. */
export interface PowderRangePoint {
  /** Charge mass, kg. */
  charge: number
  /** Barrel length, m. */
  barrelLength?: number | undefined
  /** Propellant temperature, K. */
  propellantTemperature?: number | undefined
}

/** Uncertainty of one input, stated by the caller. */
export interface PowderInputUncertainty {
  /** Standard uncertainty: a fraction of the value, or K for the temperature; 0 leaves the input out. Default: `powderInputDefaults`. */
  standardUncertainty?: number | undefined
  /** Selects the default of `powderInputDefaults`; default `estimated`. */
  basis?: InputBasis | undefined
}

/** Options of `powderPressureRange`. */
export interface PowderRangeOptions {
  /** The options the fit ran with: its priors, loss and integration settings carry over to every refit. `parameters` is the fit's own. */
  fit?: PowderFitOptions | undefined
  /** Per-input uncertainty; the inputs of `powderInputDefaults` take their default. */
  inputs?: Partial<Record<PowderInput, PowderInputUncertainty | undefined>> | undefined
  /** Points of the range; default the distinct points of the ladder. */
  points?: readonly PowderRangePoint[] | undefined
  /** Coverage of the range, in (0, 1); default 0.9. */
  level?: number | undefined
}

/** Why an input has no contribution to the range. */
export type SkippedInput = 'fitted' | 'absent' | 'refit-failed'

/** What one input adds to the range. */
export interface PowderRangeContribution {
  /** The input shifted. */
  input: PowderInput
  /** Whether its uncertainty is a measured or an estimated one. */
  basis: InputBasis
  /** Standard uncertainty used, in `unit`. */
  standardUncertainty: number
  /** Unit of `standardUncertainty`. */
  unit: 'relative' | 'K'
  /** Set where the input adds nothing: it is a fitted parameter, the load does not carry it, or a refit failed. */
  skipped?: SkippedInput
  /** Change of the peak pressure per point (half the difference of the refits at plus and minus one standard uncertainty), Pa; empty when skipped. */
  effects: number[]
}

/** The range at one point. */
export interface PowderRangeBand extends PowderRangePoint {
  /** Predicted peak breech pressure of the fitted load, Pa. */
  peakPressure: number
  /** Standard uncertainty from the fit's covariance, Pa. */
  fitUncertainty: number
  /** Combined standard uncertainty of independent inputs and fit, Pa. */
  standardUncertainty: number
  /** The fit's and every input's uncertainty added, Pa: the limit of fully correlated inputs. */
  correlatedLimit: number
  /** Lower end of the range, Pa. */
  lower: number
  /** Upper end of the range, Pa. */
  upper: number
  /** Half-width of the range over the peak pressure. */
  relativeHalfWidth: number
}

/** Peak-pressure range of a powder fit. */
export interface PowderPressureRange {
  /** Coverage of the range. */
  level: number
  /** Coverage factor of the fit's intervals, applied to the combined uncertainty. */
  coverageFactor: number
  /** One band per point. */
  points: PowderRangeBand[]
  /** One entry per input considered. */
  contributions: PowderRangeContribution[]
  /** Largest `relativeHalfWidth` over the points. */
  relativeHalfWidth: number
  /** Whether a point lies outside the fit's domain on the charge or barrel length axis. */
  extrapolated: boolean
}

interface Shift {
  /** The fit parameter that already carries this input's uncertainty. */
  fitted?: PowderParameter
  unit: 'relative' | 'K'
  /** Whether the load has the input at all. */
  present: (load: InteriorLoad) => boolean
  /** The load with the input moved by `d`: a fraction of its value, or K. */
  apply: (load: InteriorLoad, d: number) => InteriorLoad
}

const scaled = (v: number, d: number) => v * (1 + d)
const withPropellant = (l: InteriorLoad, p: Partial<InteriorLoad['propellant']>): InteriorLoad => ({
  ...l,
  propellant: { ...l.propellant, ...p },
})

const shifts: Record<PowderInput, Shift> = {
  caseCapacity: {
    fitted: 'volumeFactor',
    unit: 'relative',
    present: () => true,
    apply: (l, d) => ({ ...l, chamber: { ...l.chamber, volume: scaled(l.chamber.volume, d) } }),
  },
  propellantEnergy: {
    fitted: 'energy',
    unit: 'relative',
    present: () => true,
    apply: (l, d) => withPropellant(l, { specificEnergy: scaled(l.propellant.specificEnergy, d) }),
  },
  startPressure: {
    fitted: 'startPressure',
    unit: 'relative',
    present: () => true,
    apply: (l, d) => ({ ...l, startPressure: scaled(l.startPressure, d) }),
  },
  boreFriction: {
    unit: 'relative',
    present: (l) => (l.resistance?.friction ?? 0) > 0,
    apply: (l, d) => ({
      ...l,
      resistance: { ...l.resistance, friction: scaled(l.resistance?.friction ?? 0, d) },
    }),
  },
  propellantTemperature: {
    unit: 'K',
    // the temperature acts through the burn-rate sensitivity only
    present: (l) =>
      l.propellant.temperatureSensitivity !== undefined &&
      (l.propellant.temperatureSensitivity.cold !== 0 ||
        l.propellant.temperatureSensitivity.hot !== 0),
    apply: (l, d) => ({ ...l, propellantTemperature: l.propellantTemperature + d }),
  },
  ignitionPressure: {
    unit: 'relative',
    present: () => true,
    apply: (l, d) => ({ ...l, ignitionPressure: scaled(l.ignitionPressure, d) }),
  },
  gamma: {
    unit: 'relative',
    present: () => true,
    apply: (l, d) => withPropellant(l, { gamma: scaled(l.propellant.gamma, d) }),
  },
  covolume: {
    unit: 'relative',
    present: () => true,
    apply: (l, d) => withPropellant(l, { covolume: scaled(l.propellant.covolume, d) }),
  },
  bulletMass: {
    unit: 'relative',
    present: () => true,
    apply: (l, d) => ({ ...l, bullet: { ...l.bullet, mass: scaled(l.bullet.mass, d) } }),
  },
}

// in the order of `shifts`, which is the order of the contributions
const inputList = [
  'caseCapacity',
  'propellantEnergy',
  'startPressure',
  'boreFriction',
  'propellantTemperature',
  'ignitionPressure',
  'gamma',
  'covolume',
  'bulletMass',
] as const satisfies readonly PowderInput[]
const inputNames: readonly PowderInput[] = inputList satisfies Complete<
  PowderInput,
  typeof inputList
>

const pointKey = (p: PowderRangePoint) => `${p.charge} ${p.barrelLength} ${p.propellantTemperature}`

/** Peak breech pressure of `load` at a point. */
function peakAt(load: InteriorLoad, point: PowderRangePoint, fit: PowderFitOptions): number {
  const r = interior(
    {
      ...load,
      charge: point.charge,
      ...(point.barrelLength === undefined
        ? {}
        : { barrel: { ...load.barrel, length: point.barrelLength } }),
      ...(point.propellantTemperature === undefined
        ? {}
        : { propellantTemperature: point.propellantTemperature }),
    },
    fit.options,
  )
  if (!r.valid) throw new PowderFitError('invalid', { charge: point.charge, result: r })
  return r.peakBreechPressure
}

/** The distinct points of the ladder: charge, barrel length and temperature. */
function ladderPoints(ladder: readonly LadderPoint[]): PowderRangePoint[] {
  return [
    ...new Map(
      ladder.map((x): [string, PowderRangePoint] => [
        pointKey(x),
        {
          charge: x.charge,
          barrelLength: x.barrelLength,
          propellantTemperature: x.propellantTemperature,
        },
      ]),
    ).values(),
  ]
}

/** An input with a standard uncertainty above 0, and how it moves the load. */
interface UsedInput {
  input: PowderInput
  basis: InputBasis
  u: number
  shift: Shift
}

/** The inputs with a standard uncertainty above 0: the caller's, else the default of their basis. */
function usedInputs(options: PowderRangeOptions): UsedInput[] {
  const inputs = options.inputs ?? {}
  return inputNames.flatMap((input) => {
    const given = inputs[input]
    const basis = given?.basis ?? 'estimated'
    const table = powderInputDefaults[input]
    const u = given?.standardUncertainty ?? (table && (table[basis] ?? table.estimated))
    need(u === undefined || (Number.isFinite(u) && u >= 0), {
      code: 'inputUncertaintyNegative',
      params: { input },
    })
    return u ? [{ input, basis, u, shift: shifts[input] }] : []
  })
}

/** What the refits of a range share: the fit, its ladder and options, and the points of the range. */
interface RangeRefit {
  fit: PowderFit
  ladder: readonly LadderPoint[]
  fitOptions: PowderFitOptions
  points: readonly PowderRangePoint[]
  /** The fitted parameters. */
  names: readonly PowderParameter[]
}

/** After the input of `shift` moves by `d` and the ladder is fitted again from the solution, so every refit starts near its answer. */
function refitPeaks(refit: RangeRefit, shift: Shift, d: number): number[] {
  const { fit, ladder, fitOptions, points } = refit
  const dT = shift.unit === 'K' ? d : 0
  const moved = shift.apply(fit.load, d)
  const again = fitPowder(
    moved,
    dT === 0
      ? ladder
      : ladder.map((x) => ({
          ...x,
          ...(x.propellantTemperature === undefined
            ? {}
            : { propellantTemperature: x.propellantTemperature + dT }),
        })),
    fitOptions,
  )
  return points.map((p) =>
    peakAt(
      again.load,
      {
        ...p,
        ...(dT === 0 || p.propellantTemperature === undefined
          ? {}
          : { propellantTemperature: p.propellantTemperature + dT }),
      },
      fitOptions,
    ),
  )
}

/** What one input adds to the range: half the change of the peak between its two refits, or why it adds nothing. */
function inputContribution(
  refit: RangeRefit,
  { input, basis, u, shift }: UsedInput,
): PowderRangeContribution {
  const out = { input, basis, standardUncertainty: u, unit: shift.unit, effects: [] }
  if (shift.fitted !== undefined && refit.names.includes(shift.fitted))
    return { ...out, skipped: 'fitted' }
  if (!shift.present(refit.fit.load)) return { ...out, skipped: 'absent' }
  try {
    const up = refitPeaks(refit, shift, u)
    const down = refitPeaks(refit, shift, -u)
    return { ...out, effects: up.map((v, i) => (v - nth(down, i)) / 2) }
  } catch (e) {
    if (e instanceof PowderFitError) return { ...out, skipped: 'refit-failed' }
    throw e
  }
}

/** The range at each point: the fit's own uncertainty and the inputs' effects combined, with its interval. */
function rangeBands(
  points: readonly PowderRangePoint[],
  predictions: readonly PowderPrediction[],
  contributions: readonly PowderRangeContribution[],
): PowderRangeBand[] {
  const k = nth(predictions, 0).coverageFactor
  return points.map((p, i): PowderRangeBand => {
    const fitUncertainty = nth(predictions, i).pressure.standardUncertainty
    const effects = contributions.map((c) => c.effects[i] ?? 0)
    const standardUncertainty = Math.hypot(fitUncertainty, ...effects)
    const peakPressure = nth(predictions, i).pressure.value
    return {
      ...p,
      peakPressure,
      fitUncertainty,
      standardUncertainty,
      correlatedLimit: effects.reduce((s, e) => s + Math.abs(e), fitUncertainty),
      lower: peakPressure - k * standardUncertainty,
      upper: peakPressure + k * standardUncertainty,
      relativeHalfWidth: (k * standardUncertainty) / peakPressure,
    }
  })
}

/** Whether a point lies outside the fit's domain in charge or barrel length. */
const outsidePoints = (fit: PowderFit, points: readonly PowderRangePoint[]) =>
  points.some(
    (p) =>
      Object.keys(
        outsideDomain(fit.domain, {
          charge: p.charge,
          barrelLength: p.barrelLength ?? fit.load.barrel.length,
        }),
      ).length > 0,
  )

/** The fit's own uncertainty with each fixed input moved by its standard uncertainty and refitted (`apps/docs/docs/models/interior-powder-fit.md`, "Pressure range from the fixed inputs"); `ladder` and `options.fit` are those `fit` ran with, a fitted input is skipped as the covariance holds it; needs the covariance and a single fit, not sessions at several barrel lengths. */
export function powderPressureRange(
  fit: PowderFit,
  ladder: readonly LadderPoint[],
  options: PowderRangeOptions = {},
): PowderPressureRange {
  const { level = 0.9 } = options
  const names = fit.parameters.map((p) => p.name)
  const fitOptions: PowderFitOptions = { ...options.fit, parameters: names }
  const points = options.points ?? ladderPoints(ladder)
  need(points.length > 0, { code: 'noPoint', params: {} })
  const used = usedInputs(options)
  const predictions = points.map((p) =>
    predictPowder(fit, p.charge, {
      level,
      options: fitOptions.options,
      barrelLength: p.barrelLength,
      propellantTemperature: p.propellantTemperature,
    }),
  )
  const refit: RangeRefit = { fit, ladder, fitOptions, points, names }
  const contributions = used.map((entry) => inputContribution(refit, entry))
  const bands = rangeBands(points, predictions, contributions)
  return {
    level,
    coverageFactor: nth(predictions, 0).coverageFactor,
    points: bands,
    contributions,
    relativeHalfWidth: Math.max(...bands.map((b) => b.relativeHalfWidth)),
    extrapolated: outsidePoints(fit, points),
  }
}

/** A powder to take a prior from: the burn coefficient of the burn law of the fit and its specific energy. */
export interface SimilarPowder {
  /** Burn coefficient (vivacity, 1/s) of the same burn law as the fit's. */
  burnRate: number
  /** Specific energy, J/kg. */
  energy: number
}

/** Rules of the choice of similar powders and of the prior they give. */
interface SimilarPowderRules {
  /** Neighbors taken. */
  count: number
  /** Fewest neighbors for a prior from their spread; fewer give a weak prior. */
  minimum: number
  /** Standard deviation of ln(burn coefficient) of a weak prior. */
  weakSigma: number
  /** Smallest standard deviation of a prior from a spread, so near-equal neighbors do not fix the fit. */
  minimumSigma: number
}

/** The rules of {@link similarPowdersPrior}. */
const similarPowderRules: Readonly<SimilarPowderRules> = Object.freeze({
  count: 5,
  minimum: 3,
  weakSigma: 1,
  minimumSigma: 0.05,
})

/** A prior on the burn coefficient from similar powders. */
export interface SimilarPowdersPrior {
  /** The prior, to pass as `priors.burnRate`. */
  prior: PowderPrior
  /** Neighbors the prior is built from. */
  count: number
  /** Fewer neighbors than `similarPowderRules.minimum`: the prior is centered on the target's own value with `weakSigma`. */
  weak: boolean
}

/** From the powders nearest to `target` in ln(burn coefficient) and ln(energy): the mean of their ln(burn coefficient) and its sample standard deviation (`apps/docs/docs/models/interior-powder-fit.md`, "Prior from similar powders"); `candidates` share the burn law, without the target. */
export function similarPowdersPrior(
  target: SimilarPowder,
  candidates: readonly SimilarPowder[],
  count: number = similarPowderRules.count,
): SimilarPowdersPrior {
  const valid = (x: SimilarPowder) =>
    Number.isFinite(x.burnRate) && x.burnRate > 0 && Number.isFinite(x.energy) && x.energy > 0
  need(valid(target) && candidates.every(valid), {
    code: 'burnCoefficientOrEnergyNotPositive',
    params: {},
  })
  need(Number.isInteger(count) && count > 0, { code: 'countNotPositiveInteger', params: {} })
  const distance = (x: SimilarPowder) =>
    Math.hypot(Math.log(x.burnRate / target.burnRate), Math.log(x.energy / target.energy))
  const near = candidates.toSorted((a, b) => distance(a) - distance(b)).slice(0, count)
  if (near.length < similarPowderRules.minimum)
    return {
      prior: { value: target.burnRate, sigma: similarPowderRules.weakSigma },
      count: near.length,
      weak: true,
    }
  const logs = near.map((x) => Math.log(x.burnRate))
  const mean = logs.reduce((s, x) => s + x, 0) / logs.length
  const sd = Math.sqrt(logs.reduce((s, x) => s + (x - mean) ** 2, 0) / (logs.length - 1))
  return {
    prior: { value: Math.exp(mean), sigma: Math.max(sd, similarPowderRules.minimumSigma) },
    count: near.length,
    weak: false,
  }
}

/** Confidence label of the fit's range: the relative half-width of the peak-pressure range is up to 10 %, up to 25 %, or above. */
export type PowderFitLabel = 'tight' | 'moderate' | 'loose'

/** Why the label is not better, or what the fit rests on. */
export type PowderConfidenceReason =
  | 'no-pressure'
  | 'capacity-estimated'
  | 'narrow-ladder'
  | 'residual-trend'
  | 'start-pressure-correlated'
  | 'outside-similar-powders'
  | 'weak-prior'
  | 'extrapolated'
  | 'input-refit-failed'

/** Thresholds of the label and of the reasons. */
export interface PowderConfidenceRules {
  /** Largest relative half-width of a `tight` range. */
  readonly tight: number
  /** Largest relative half-width of a `moderate` range. */
  readonly moderate: number
  /** `narrow-ladder` below this ratio of the largest to the smallest ladder charge. */
  readonly narrowRatio: number
  /** `start-pressure-correlated` above this magnitude of the correlation with the burn coefficient. */
  readonly correlation: number
  /** `residual-trend` needs at least this many velocity rows. */
  readonly trendRows: number
  /** `outside-similar-powders` beyond this many standard deviations of the prior. */
  readonly priorSpread: number
}

/** The thresholds in use. Assumptions, to be tuned against real sessions. */
export const powderConfidenceRules: PowderConfidenceRules = Object.freeze({
  tight: 0.1,
  moderate: 0.25,
  narrowRatio: 1.1,
  correlation: 0.9,
  trendRows: 5,
  priorSpread: 2,
})

/** Label and reasons of a powder fit. */
export interface PowderConfidence {
  /** Width class of the range: `tight`, `moderate` or `loose`. */
  label: PowderFitLabel
  /** Every reason that applies, in a fixed order; they do not change the label. */
  reasons: PowderConfidenceReason[]
  /** What the fit started from. */
  basis: PowderFit['basis']
  /** The relative half-width the label is set from. */
  relativeHalfWidth: number
}

/** Option of `powderConfidence`. */
export interface PowderConfidenceOptions {
  /** The prior the fit was given, when it came from `similarPowdersPrior`. */
  similar?: SimilarPowdersPrior | undefined
}

/** Velocity residuals ordered by charge in one or two sign blocks while above their uncertainties (chi-square per row above 1): the model misses a trend, not noise; only a fit with velocity sigmas is tested. */
function hasResidualTrend(fit: PowderFit): boolean {
  const velocities = fit.residuals
    .filter((r) => r.kind === 'velocity')
    .toSorted((a, b) => a.charge - b.charge)
    .map((r) => r.residual)
  const changes = velocities.slice(1).filter((r, i) => r * nth(velocities, i) < 0).length
  return (
    fit.weighted &&
    velocities.length >= powderConfidenceRules.trendRows &&
    changes <= 1 &&
    fit.dataChiSquare / fit.residuals.length > 1
  )
}

/** `weak-prior` and `outside-similar-powders` of a fit given a prior from `similarPowdersPrior`. */
function priorReasons(fit: PowderFit, similar: SimilarPowdersPrior | undefined) {
  if (!similar) return []
  if (similar.weak) return ['weak-prior' as const]
  const fitted = fit.parameters.find((p) => p.name === 'burnRate')
  const spread = powderConfidenceRules.priorSpread * similar.prior.sigma
  return fitted && Math.abs(Math.log(fitted.value / similar.prior.value)) > spread
    ? ['outside-similar-powders' as const]
    : []
}

/** What the ladder lacks: pressures, a measured capacity, charge span or a residual without trend. */
function ladderReasons(fit: PowderFit, range: PowderPressureRange): PowderConfidenceReason[] {
  const rules = powderConfidenceRules
  const reasons: PowderConfidenceReason[] = []
  if (!fit.residuals.some((r) => r.kind === 'pressure')) reasons.push('no-pressure')
  if (
    range.contributions.some(
      (c) => c.input === 'caseCapacity' && c.basis === 'estimated' && c.skipped === undefined,
    )
  )
    reasons.push('capacity-estimated')
  const { min, max } = fit.chargeRange
  if (max / min < rules.narrowRatio) reasons.push('narrow-ladder')
  if (hasResidualTrend(fit)) reasons.push('residual-trend')
  return reasons
}

/** What the fit and its range show: a correlated start pressure, the prior, extrapolation, a failed refit. */
function rangeReasons(
  fit: PowderFit,
  range: PowderPressureRange,
  similar: SimilarPowdersPrior | undefined,
): PowderConfidenceReason[] {
  const reasons: PowderConfidenceReason[] = []
  const names = fit.parameters.map((p) => p.name)
  const burn = names.indexOf('burnRate')
  const start = names.indexOf('startPressure')
  if (
    start >= 0 &&
    Math.abs(fit.correlation?.[burn]?.[start] ?? 0) > powderConfidenceRules.correlation
  )
    reasons.push('start-pressure-correlated')
  reasons.push(...priorReasons(fit, similar))
  if (range.extrapolated) reasons.push('extrapolated')
  if (range.contributions.some((c) => c.skipped === 'refit-failed'))
    reasons.push('input-refit-failed')
  return reasons
}

/** The label of the relative half-width `w` under `rules`. */
function labelOf(w: number, rules: PowderConfidenceRules): PowderFitLabel {
  if (w <= rules.tight) return 'tight'
  return w <= rules.moderate ? 'moderate' : 'loose'
}

/** Label of a fit's pressure range by its relative half-width, with the reasons that apply (`apps/docs/docs/models/interior-powder-fit.md`, "Confidence label"); it describes the simulation's uncertainty, not a load. */
export function powderConfidence(
  fit: PowderFit,
  range: PowderPressureRange,
  options: PowderConfidenceOptions = {},
): PowderConfidence {
  const rules = powderConfidenceRules
  const w = range.relativeHalfWidth
  need(Number.isFinite(w), { code: 'rangeWithoutWidth', params: {} })
  const reasons = [...ladderReasons(fit, range), ...rangeReasons(fit, range, options.similar)]
  return {
    label: labelOf(w, rules),
    reasons,
    basis: fit.basis,
    relativeHalfWidth: w,
  }
}
