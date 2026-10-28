/**
 * Truing from range strings: plan which distances identify which of muzzle velocity, drag factor
 * and click value, and fit the three to measured impacts, dialled corrections and chronograph
 * readings, `apps/docs/docs/models/exterior-truing-strings.md`. Every evaluation is an ordinary
 * `trajectory` call. SI in and out; angles in rad, dialled corrections in clicks.
 */
import { InputError, need, nth, overlay, type Settings } from '../errors.ts'
import { chiSquareQuantile, chiSquareSurvival } from '../groups/chi-square.ts'
import { studentTwoSidedQuantile } from '../groups/student-t.ts'
import {
  type Identifiability,
  identifiability,
  type LogFitFailure,
  logLeastSquares,
} from '../least-squares.ts'
import { type TrajectoryInput, type TrajectoryOptions, trajectory } from './trajectory.ts'
import { dragCorrection, TruingError } from './truing.ts'

/**
 * Fitted parameters: muzzle velocity (m/s), drag factor (multiplies C_D), click value (rad per
 * click) and, with `RangeStringOptions.fitZeroOffset`, the zero offset (rad: the angle by which the
 * impacts at the zero setting lie above the nominal zero, so an impact at range r is `r` times
 * the offset higher and a dial lower by the offset in rad over the click value).
 */
export type RangeStringParameterName = 'muzzleVelocity' | 'dragFactor' | 'clickValue' | 'zeroOffset'
const names: readonly RangeStringParameterName[] = [
  'muzzleVelocity',
  'dragFactor',
  'clickValue',
  'zeroOffset',
]

/** One distance of a range string. */
export interface RangeStringEntry {
  /**
   * `impact`: height of the mean impact above the line of sight at the zero setting, m.
   * `dial`: clicks dialled to centre the group from the zero setting, signed up.
   */
  kind: 'impact' | 'dial'
  /** Slant range, m. */
  range: number
  /** Mean over the shots, in the unit of `kind`. */
  value: number
  /** Shots behind the mean, a whole number of at least 1. */
  shotCount: number
  /** Standard deviation of one shot in the unit of `value`. */
  standardDeviation: number
  /**
   * Step of the reading in the unit of `value`; adds step / sqrt(12). Default: `defaultRounding`
   * of the kind (a dial moves in whole clicks, 1; a measured impact has no step, 0).
   */
  rounding?: number | undefined
  /**
   * The group of shots behind the entry. An impact and a dial entry of one group count the same
   * shots twice and are rejected. Default: the distance, so give distinct names to two groups
   * shot at one distance.
   */
  group?: string | undefined
}

/** Muzzle velocity readings; `instrumentDistance` is the distance from the muzzle to the instrument. */
export interface Chronograph {
  instrumentDistance?: number | undefined
  /** Mean muzzle velocity of the readings, m/s. */
  mean: number
  shotCount: number
  /** Standard deviation of one shot, m/s. */
  standardDeviation: number
  /** Step of the reading, m/s; default 0. */
  rounding?: number | undefined
}

/**
 * Gaussian priors of the fit (`apps/docs/docs/models/exterior-truing-strings.md`, "Gaussian priors"). A prior is
 * centred on the nominal value of its parameter: its sigma is the standard deviation of ln q (muzzle
 * velocity, drag factor, click value) or of the offset in rad (zero offset). A prior narrows the
 * intervals of the parameters the data identifies. It never identifies a parameter: statuses
 * come from the data alone.
 */
export interface RangeStringPriors {
  /** Standard deviation of ln(v0 / nominal). */
  muzzleVelocity?: number | undefined
  /** Standard deviation of ln k. */
  dragFactor?: number | undefined
  /** Standard deviation of ln(c / nominal). */
  clickValue?: number | undefined
  /** Standard deviation of the zero offset, rad; needs `RangeStringOptions.fitZeroOffset`. */
  zeroOffset?: number | undefined
}

/** Solver settings and thresholds of `planTruingStrings` and `fitTruingStrings`. */
export interface RangeStringOptions {
  /** Fit the zero offset as a fourth parameter; default false (three parameters). */
  fitZeroOffset?: boolean | undefined
  /** Gaussian priors on the parameters; none by default. */
  priors?: RangeStringPriors | undefined
  /** Standard error of the zero offset in rad above which it is weakly identified; default 1e-4. */
  maxZeroSigma?: number | undefined
  /** Options of every trajectory; default tolerances `relativeTolerance` 1e-10, `absoluteTolerance` 1e-9, `zeroTolerance` 1e-9. */
  trajectoryOptions?: Settings<Omit<TrajectoryOptions, 'budget'>> | undefined
  /**
   * Levenberg-Marquardt iterations (accepted plus rejected steps) before the fit of the current
   * parameters fails with reason `not-converged`; default 30.
   */
  maxIterations?: number | undefined
  /** Largest condition number of the fit; parameters beyond it are held; default 1e3. */
  maxCondition?: number | undefined
  /** Two-sided confidence level of the intervals; default 0.95. */
  confidenceLevel?: number | undefined
  /** Variance inflation above which a parameter is weakly identified; default 10. */
  maxInflation?: number | undefined
  /** Standard error of ln q above which a parameter is weakly identified; default 0.05. */
  maxRelativeStandardUncertainty?: number | undefined
  /** Level of the chi-square test of the residuals; default 0.99. */
  residualConfidenceLevel?: number | undefined
  /**
   * Scale the standard errors in the intervals by the square root of the reduced chi-square
   * and use Student's t instead of the normal quantile, for spreads that are not known; no effect
   * at 0 degrees of freedom. Default false (`apps/docs/docs/models/exterior-truing-strings.md`, "Intervals").
   */
  scaleByResidual?: boolean | undefined
}

/** Defaults of `RangeStringOptions` for the fields it lists. */
export interface RangeStringDefaults {
  confidenceLevel: 0.95
  maxInflation: 10
  maxRelativeStandardUncertainty: 0.05
  residualConfidenceLevel: 0.99
  maxCondition: 1e3
  maxIterations: 30
  maxZeroSigma: 1e-4
}

/** The values of {@link RangeStringDefaults}. */
export const rangeStringDefaults: Readonly<RangeStringDefaults> = {
  confidenceLevel: 0.95,
  maxInflation: 10,
  maxRelativeStandardUncertainty: 0.05,
  residualConfidenceLevel: 0.99,
  maxCondition: 1e3,
  maxIterations: 30,
  maxZeroSigma: 1e-4,
}

/**
 * Smallest `intervalScale`: a residual of 0 must not give an interval of zero width
 * (`apps/docs/docs/models/exterior-truing-strings.md`, "Intervals"; a chosen value).
 */
export const minIntervalScale = 1e-6

/**
 * Rounding step of a row without `rounding`, in the unit of its value
 * (`apps/docs/docs/models/exterior-truing-strings.md`, "Uncertainty of a row").
 */
export const defaultRounding = { impact: 0, dial: 1, velocity: 0 }

/** `fit-failed`: the iteration for this parameter failed (`RangeStringFit.failures`). */
export type WeakReason = 'no-information' | 'collinear' | 'imprecise' | 'fit-failed'

/** Status and estimate of one parameter, from a plan or a fit. */
export interface RangeStringParameter {
  /** Which parameter. */
  name: RangeStringParameterName
  /** The value the fit started from and held when the parameter was not fitted. */
  nominal: number
  /**
   * `unresolved`: the data does not move it, or its fit failed. `weak`: one of the `reasons`
   * applies. Else `identified`.
   */
  status: 'identified' | 'weak' | 'unresolved'
  /** Why the parameter is not identified; empty when it is. */
  reasons: WeakReason[]
  /**
   * Standard error of ln q with all parameters free, from the data alone; Infinity for a
   * parameter in the null direction of a singular design. Absent for the zero offset, which
   * has `standardUncertainty` (rad) instead.
   */
  relativeStandardUncertainty?: number
  /** Variance inflation factor against knowing the other parameters. */
  varianceInflation?: number
  /**
   * Standard error at the nominal (plan) or fitted value; first order. With priors, the posterior
   * one (`posteriorSigma`).
   */
  standardUncertainty?: number
  /**
   * With priors: standard error of ln q (the zero offset: of the offset in rad) of the Laplace
   * posterior, the data and all priors of the live parameters; absent without priors.
   */
  posteriorSigma?: number
  /**
   * The prior on this parameter, when one is given: its sigma on the scale of `posteriorSigma` and
   * the ratio posterior over prior sigma. A ratio near 1 means the prior decides the interval.
   */
  prior?: { sigma: number; ratio: number }
  /** Fitted value; only an identified parameter has one. */
  value?: number
  /**
   * Confidence interval of `value`; only an identified parameter has one. In a plan, the interval
   * the fit would report around the nominal value (the zero offset: around 0), if the data
   * behave as the plan states.
   */
  interval?: { lower: number; upper: number; confidenceLevel: number }
  /**
   * Fit only: false when the residual check failed or the interval is conditional on a held
   * parameter (`conditionalOn`), so it is not to be relied on (`apps/docs/docs/models/exterior-truing-strings.md`, "Residual check").
   */
  intervalsTrusted?: boolean
  /**
   * Fit, identified parameter only: the weak or failed parameters held at their nominal value
   * while this one was fitted; absent when none. Its value and interval are conditional on them.
   */
  conditionalOn?: RangeStringParameterName[]
}

/** Identifiability of the parameters (three, four with `fitZeroOffset`) at one set of values. */
export interface Identification {
  /** The parameters (three, four with `fitZeroOffset`), in the order of `RangeStringParameterName`. */
  parameters: RangeStringParameter[]
  /** Condition number of the column-scaled information of the resolved parameters. */
  conditionNumber: number
  /** Parameters named by the smallest eigenvalue's eigenvector (component above 0.3), when weak. */
  confounded: RangeStringParameterName[]
  /** Correlation of each pair of resolved parameters, keyed `first:second`. */
  correlation: Record<string, number>
}

/** A planned `RangeStringEntry`: the same fields without the measured `value` and `standardDeviation`. */
export interface PlanEntry {
  /** `impact` (height above the line of sight, m) or `dial` (clicks). */
  kind: 'impact' | 'dial'
  /** Slant range, m. */
  range: number
  /** Planned shots behind the mean, a whole number of at least 1. */
  shotCount: number
  /** Step of the reading in the unit of the kind; default `defaultRounding`. */
  rounding?: number | undefined
  /** Group of shots, see `RangeStringEntry.group`. */
  group?: string | undefined
}

/** Input of `planTruingStrings`. */
export interface TruingPlanInput {
  /** The nominal shot: muzzle velocity, projectile with its drag, rifle, air, zero. */
  shot: TrajectoryInput
  /** Nominal click value, rad per click. */
  clickValue: number
  /** Standard deviation of one shot's vertical angle, rad. */
  dispersion: number
  /** Planned distances; at least one entry or a chronograph. */
  entries: readonly PlanEntry[]
  /** Planned muzzle velocity readings. */
  chronograph?:
    | Pick<Chronograph, 'instrumentDistance' | 'shotCount' | 'standardDeviation' | 'rounding'>
    | undefined
}

/**
 * Why a planned string cannot separate muzzle velocity from drag factor, whatever the numbers:
 * `single-range` (impacts or dials at one distance and no chronograph) and `velocity-only` (a
 * chronograph and no impact or dial).
 */
export type PlanRefusalId = 'single-range' | 'velocity-only'

/** A plan the structure of the string rules out, with what to change. */
export interface PlanRefusal {
  /** Fixed identifier. */
  id: PlanRefusalId
  /** What to add to the string. */
  advice: string
}

const refusalAdvice: Readonly<Record<PlanRefusalId, string>> = {
  'single-range':
    'All impacts or dials are at one distance, so one drop cannot separate muzzle velocity from drag factor. Add an entry at a second distance, or chronograph readings together with an impact entry. These may not separate every parameter (dial entries alone leave the click value in the fit, a zero offset needs more observations): the statuses show what is still open.',
  'velocity-only':
    'Chronograph readings alone cannot identify drag factor: at the muzzle the speed depends on muzzle velocity only, and at a distance one speed moves both. Add an impact entry at a distance, or dial entries at two distances. These may not separate every parameter: the statuses show what is still open.',
}

/** Result of `planTruingStrings`. */
export interface TruingPlan extends Identification {
  /** Number of planned rows: entries plus the chronograph. */
  observationCount: number
  /** Structural refusals of the planned string, none when it passes; the statuses still hold. */
  refusals: PlanRefusal[]
}

/** The refusals a planned string earns (`apps/docs/docs/models/exterior-truing-strings.md`, "Refusals of a plan"). */
function planRefusals(
  entries: readonly PlanEntry[],
  chronograph: TruingPlanInput['chronograph'],
): PlanRefusal[] {
  const ids: PlanRefusalId[] = []
  if (entries.length === 0) ids.push('velocity-only')
  else if (chronograph === undefined && new Set(entries.map((e) => e.range)).size === 1)
    ids.push('single-range')
  return ids.map((id) => ({ id, advice: refusalAdvice[id] }))
}

interface Row {
  kind: 'impact' | 'dial' | 'velocity'
  range: number
  /** Standard uncertainty of the row. */
  sigma: number
  value: number
  /** Scale of the row's values, for the noise floor. */
  scale: number
}

const rowSigma = (kind: Row['kind'], spread: number, shots: number, rounding?: number) =>
  Math.hypot(spread / Math.sqrt(shots), (rounding ?? defaultRounding[kind]) / Math.sqrt(12))

/** The row of the chronograph readings with the given value and noise scale. */
function chronographRow(
  chronograph: NonNullable<TruingPlanInput['chronograph']>,
  value: number,
  scale: number,
): Row {
  return {
    kind: 'velocity' as const,
    range: chronograph.instrumentDistance ?? 0,
    sigma: rowSigma(
      'velocity',
      chronograph.standardDeviation,
      chronograph.shotCount,
      chronograph.rounding,
    ),
    value,
    scale,
  }
}

/** Rows of a plan: values 0, uncertainties from the dispersion and the planned shots. */
function plannedRows(input: TruingPlanInput): Row[] {
  const { shot, clickValue, dispersion, entries, chronograph } = input
  return [
    ...entries.map((e): Row => {
      const spread = e.kind === 'impact' ? dispersion * e.range : dispersion / clickValue
      return {
        kind: e.kind,
        range: e.range,
        sigma: rowSigma(e.kind, spread, e.shotCount, e.rounding),
        value: 0,
        scale: e.kind === 'impact' ? e.range : 1,
      }
    }),
    ...(chronograph ? [chronographRow(chronograph, 0, shot.muzzleVelocity)] : []),
  ]
}

/** Rows of a fit: the measured values with their stated uncertainties. */
function measuredRows(
  entries: readonly RangeStringEntry[],
  chronograph: Chronograph | undefined,
): Row[] {
  return [
    ...entries.map(
      (e): Row => ({
        kind: e.kind,
        range: e.range,
        sigma: rowSigma(e.kind, e.standardDeviation, e.shotCount, e.rounding),
        value: e.value,
        scale: e.kind === 'impact' ? e.range : Math.max(Math.abs(e.value), 1),
      }),
    ),
    ...(chronograph ? [chronographRow(chronograph, chronograph.mean, chronograph.mean)] : []),
  ]
}

function checkCommon(shot: TrajectoryInput, clickValue: number, options: RangeStringOptions): void {
  need(shot.muzzleVelocity > 0, 'muzzle velocity must be positive')
  const { priors = {}, maxZeroSigma = rangeStringDefaults.maxZeroSigma } = options
  need(maxZeroSigma > 0 && Number.isFinite(maxZeroSigma), 'maxZeroSigma must be positive')
  for (const name of Object.keys(priors) as RangeStringParameterName[]) {
    need(names.includes(name), `prior ${name}`)
    const sigma = priors[name]
    need(
      sigma === undefined || (sigma > 0 && Number.isFinite(sigma)),
      `prior ${name} must be positive`,
    )
  }
  need(
    priors.zeroOffset === undefined || options.fitZeroOffset === true,
    'a zeroOffset prior needs the fitZeroOffset option',
  )
  need(clickValue > 0 && Number.isFinite(clickValue), 'click value must be positive')
  const d = rangeStringDefaults
  const { confidenceLevel: level = d.confidenceLevel, maxInflation = d.maxInflation } = options
  const {
    maxRelativeStandardUncertainty = d.maxRelativeStandardUncertainty,
    residualConfidenceLevel = d.residualConfidenceLevel,
  } = options
  const { maxCondition = d.maxCondition, maxIterations = d.maxIterations } = options
  need(Number.isFinite(level) && level > 0 && level < 1, 'confidenceLevel must lie in (0, 1)')
  need(
    Number.isFinite(residualConfidenceLevel) &&
      residualConfidenceLevel > 0 &&
      residualConfidenceLevel < 1,
    'residualConfidenceLevel must lie in (0, 1)',
  )
  need(maxInflation > 1, 'maxInflation must exceed 1')
  need(maxRelativeStandardUncertainty > 0, 'maxRelativeStandardUncertainty must be positive')
  need(Number.isFinite(maxCondition) && maxCondition > 1, 'maxCondition must be finite and above 1')
  need(
    Number.isInteger(maxIterations) && maxIterations >= 1,
    'maxIterations must be a whole number of at least 1',
  )
}

/** An impact and a dial entry of one group count the same shots twice. */
function checkGroups(
  entries: readonly { kind: string; range: number; group?: string | undefined }[],
): void {
  const kinds = new Map<string, Set<string>>()
  for (const e of entries) {
    const key = e.group ?? `${e.range} m`
    const seen = kinds.get(key) ?? new Set()
    seen.add(e.kind)
    kinds.set(key, seen)
    need(
      seen.size === 1,
      `group ${key}: an impact and a dial entry share their shots, keep one or name two groups`,
    )
  }
}

function checkRow(kind: string, range: number, shots: number, spread: number, rounding = 0): void {
  need(Number.isFinite(range) && (kind === 'velocity' ? range >= 0 : range > 0), `${kind} range`)
  need(
    Number.isInteger(shots) && shots >= 1,
    `${kind} shotCount must be a whole number of at least 1`,
  )
  need(spread > 0 && Number.isFinite(spread), `${kind} standardDeviation must be positive`)
  need(rounding >= 0 && Number.isFinite(rounding), `${kind} rounding must not be negative`)
}

/**
 * Checks the entries and the chronograph of a plan or, with `measured`, of a fit, which adds the
 * entry values, their spreads and the chronograph mean.
 */
function checkEntries(
  entries: readonly (PlanEntry & Partial<Pick<RangeStringEntry, 'value' | 'standardDeviation'>>)[],
  chronograph: (TruingPlanInput['chronograph'] & { mean?: number }) | undefined,
  measured: boolean,
): void {
  need(entries.length > 0 || chronograph !== undefined, 'at least one entry or a chronograph')
  for (const e of entries) {
    need(e.kind === 'impact' || e.kind === 'dial', `entry kind ${e.kind}`)
    if (measured) need(Number.isFinite(e.value), 'entry value')
    checkRow(
      e.kind,
      e.range,
      e.shotCount,
      measured ? (e.standardDeviation as number) : 1,
      e.rounding,
    )
  }
  checkGroups(entries)
  if (chronograph) {
    if (measured)
      need(
        (chronograph.mean as number) > 0 && Number.isFinite(chronograph.mean),
        'chronograph mean',
      )
    checkRow(
      'velocity',
      chronograph.instrumentDistance ?? 0,
      chronograph.shotCount,
      chronograph.standardDeviation,
      chronograph.rounding,
    )
  }
}

/** The shot with the parameters applied; `theta` holds ln(q / nominal) of the first three. */
function applied(shot: TrajectoryInput, theta: readonly number[]): TrajectoryInput {
  return {
    ...shot,
    muzzleVelocity: shot.muzzleVelocity * Math.exp(nth(theta, 0)),
    projectile: {
      ...shot.projectile,
      drag: dragCorrection(shot.projectile)([Math.exp(nth(theta, 1))]),
    },
  }
}

const zeros = [0, 0, 0, 0]

/** A Gaussian prior on parameter `j`, centred on its nominal value: the pseudo-row theta_j = 0. */
interface Prior {
  j: number
  sigma: number
}

class Model {
  readonly options: Settings<TrajectoryOptions>
  readonly shot: TrajectoryInput
  readonly clickValue: number
  readonly rows: readonly Row[]
  /** Parameters in play: indices 0 to 2, and 3 with the zero offset. */
  readonly active: readonly number[]
  readonly priors: readonly Prior[]
  /** Why the last prediction that returned null failed. */
  failure = ''
  constructor(
    shot: TrajectoryInput,
    clickValue: number,
    rows: readonly Row[],
    options: RangeStringOptions,
  ) {
    this.shot = shot
    this.clickValue = clickValue
    this.rows = rows
    this.options = overlay<Settings<TrajectoryOptions>>(
      { relativeTolerance: 1e-10, absoluteTolerance: 1e-9, zeroTolerance: 1e-9 },
      options.trajectoryOptions,
    )
    this.active = options.fitZeroOffset ? [0, 1, 2, 3] : [0, 1, 2]
    this.priors = this.active.flatMap((j) => {
      const sigma = options.priors?.[nth(names, j)]
      return sigma === undefined ? [] : [{ j, sigma }]
    })
  }

  /**
   * Predicted values of all rows, or null when the trajectory fails or misses a range. With
   * `strict` an `InputError` of the solver passes on (the nominal shot is invalid).
   */
  predict(theta: readonly number[], strict = false): number[] | null {
    let t: ReturnType<typeof trajectory>
    try {
      t = trajectory(
        applied(this.shot, theta),
        this.rows.map((x) => x.range),
        this.options,
      )
    } catch (e) {
      if (strict || !(e instanceof InputError)) throw e
      this.failure = e.message
      return null
    }
    const at = new Map(t.points.map((p) => [p.range, p]))
    const out: number[] = []
    for (const x of this.rows) {
      const p = at.get(x.range)
      if (!p) {
        this.failure = `range ${x.range} m not reached`
        return null
      }
      const offset = theta[3] ?? 0
      out.push(
        x.kind === 'impact'
          ? p.height + offset * x.range
          : x.kind === 'velocity'
            ? p.velocity
            : (p.elevationHold - offset) / (this.clickValue * Math.exp(nth(theta, 2))),
      )
    }
    return out
  }

  /** Predicted values at the nominal parameters; an invalid shot or an unreached range throws. */
  nominal(): number[] {
    const out = this.predict(zeros, true)
    if (!out) throw new TruingError('unreachable', { detail: this.failure })
    return out
  }

  /** Weighted Jacobian in ln parameters, central differences; null when a prediction fails. */
  jacobian(theta: readonly number[], columns: readonly number[]): number[][] | null {
    const h = 1e-3
    const cols = columns.map((j) => {
      if (j === 2) {
        // the click value only divides the dial rows
        const at = this.predict(theta)
        return at && this.rows.map((x, i) => (x.kind === 'dial' ? -nth(at, i) : 0))
      }
      if (j === 3) {
        // the offset is linear: range times it in an impact, minus it over the click value in a dial
        const perClick = 1 / (this.clickValue * Math.exp(nth(theta, 2)))
        return this.rows.map((x) =>
          x.kind === 'impact' ? x.range : x.kind === 'dial' ? -perClick : 0,
        )
      }
      const up = this.predict(theta.map((x, k) => (k === j ? x + h : x)))
      const down = this.predict(theta.map((x, k) => (k === j ? x - h : x)))
      return up && down && up.map((v, i) => (v - nth(down, i)) / (2 * h))
    })
    const complete = cols.filter((c) => c !== null)
    if (complete.length < cols.length) return null
    return this.rows.map((x, i) => complete.map((c) => nth(c, i) / x.sigma))
  }
}

/**
 * Parameters whose column is zero, or below the noise floor everywhere
 * (`apps/docs/docs/models/exterior-truing-strings.md`, "Status of a parameter").
 */
function unresolved(model: Model, j: number[][], columns: readonly number[]): number[] {
  const norms = columns.map((_, c) => Math.hypot(...j.map((row) => nth(row, c))))
  const largest = Math.max(...norms)
  return columns.filter((_, c) => {
    const norm = nth(norms, c)
    return (
      norm === 0 ||
      norm < 1e-9 * largest ||
      j.every((row, i) => {
        const { scale, sigma } = nth(model.rows, i)
        return Math.abs(nth(row, c)) < (1e-6 * scale) / sigma
      })
    )
  })
}

/** Inputs of `parameterStatuses`: the information of the data alone and with the priors. */
interface StatusInput {
  model: Model
  theta: readonly number[]
  options: RangeStringOptions
  fitted?: { kept: readonly number[] } | undefined
  /** Resolved parameters, the columns of `info` and `post`. */
  live: readonly number[]
  info: Identifiability | null
  post: Identifiability | null
}

/** Why a parameter with these standard errors is weak, none when it is identified. */
function weakReasons(
  j: number,
  dataSigma: number,
  inflation: number,
  options: RangeStringOptions,
  fitted: StatusInput['fitted'],
): WeakReason[] {
  const { maxInflation = rangeStringDefaults.maxInflation } = options
  const { maxRelativeStandardUncertainty = rangeStringDefaults.maxRelativeStandardUncertainty } =
    options
  const { maxZeroSigma = rangeStringDefaults.maxZeroSigma } = options
  const reasons: WeakReason[] = []
  if (!(inflation <= maxInflation)) reasons.push('collinear')
  if (!(dataSigma <= (j === 3 ? maxZeroSigma : maxRelativeStandardUncertainty)))
    reasons.push('imprecise')
  // a parameter outside the fitted set has no fitted value, whatever its numbers say
  if (fitted && !fitted.kept.includes(j) && reasons.length === 0) reasons.push('collinear')
  return reasons
}

/** Status and standard errors of the resolved parameter `j`, column `k` of `info` and `post`. */
function resolvedStatus(
  input: StatusInput,
  j: number,
  k: number,
  base: { name: RangeStringParameterName; nominal: number },
): RangeStringParameter {
  const { model, theta, options, fitted, info, post } = input
  // standard error per unit parameter: of ln q, or of the zero offset in rad
  const dataSigma = info?.standardUncertainty[k] ?? Infinity
  const inflation = info?.varianceInflation[k] ?? Infinity
  const reasons = weakReasons(j, dataSigma, inflation, options, fitted)
  const at = j === 3 ? nth(theta, 3) : base.nominal * Math.exp(nth(theta, j))
  const used = post ? nth(post.standardUncertainty, k) : dataSigma
  const prior = model.priors.find((p) => p.j === j)
  const common = {
    ...base,
    ...(j === 3 ? {} : { relativeStandardUncertainty: dataSigma }),
    varianceInflation: inflation,
    standardUncertainty: j === 3 ? used : at * used,
    ...(post ? { posteriorSigma: used } : {}),
    ...(post && prior ? { prior: { sigma: prior.sigma, ratio: used / prior.sigma } } : {}),
  }
  if (reasons.length > 0) return { ...common, status: 'weak', reasons }
  return { ...common, status: 'identified', reasons, ...(fitted ? { value: at } : {}) }
}

/** Status, standard errors and, when fitted and identified, the value of each active parameter. */
function parameterStatuses(input: StatusInput): RangeStringParameter[] {
  const { model, live } = input
  const nominal = [model.shot.muzzleVelocity, 1, model.clickValue, 0]
  return model.active.map((j): RangeStringParameter => {
    const base = { name: nth(names, j), nominal: nth(nominal, j) }
    const k = live.indexOf(j)
    if (k < 0) return { ...base, status: 'unresolved', reasons: ['no-information'] }
    return resolvedStatus(input, j, k, base)
  })
}

/** Parameters named by the smallest eigenvalue's eigenvector, when one of them is collinear. */
function confoundedParameters(
  info: Identifiability | null,
  live: readonly number[],
  maxInflation: number,
): RangeStringParameterName[] {
  const collinear = info?.varianceInflation.some((v) => v > maxInflation) ?? false
  return info !== null && collinear
    ? live
        .filter((_, k) => Math.abs(nth(info.direction, k)) > confoundedComponent)
        .map((j) => nth(names, j))
    : []
}

/**
 * Statuses of the resolved parameters from their weighted Jacobian at `theta`. With `fitted`, the
 * parameters of `kept` have the values of `theta`; one outside `kept` cannot be identified.
 */
function analyse(
  model: Model,
  theta: readonly number[],
  options: RangeStringOptions,
  fitted?: { kept: readonly number[] } | undefined,
): Identification {
  const { maxInflation = rangeStringDefaults.maxInflation } = options
  const all = model.active
  const full = model.jacobian(theta, all)
  if (!full) throw new TruingError('unreachable', { detail: model.failure })
  const dead = unresolved(model, full, all)
  const live = all.filter((j) => !dead.includes(j))
  const info =
    live.length > 0 ? identifiability(full.map((row) => live.map((j) => nth(row, j)))) : null
  // Laplace posterior: the data rows and one pseudo-row 1 / sigma per prior of a live parameter.
  // Statuses stay with the data alone; a prior narrows an interval, it identifies nothing.
  const priors = model.priors.filter((p) => live.includes(p.j))
  const post =
    info && priors.length > 0
      ? identifiability([
          ...full.map((row) => live.map((j) => nth(row, j))),
          ...priors.map((p) => live.map((j) => (j === p.j ? 1 / p.sigma : 0))),
        ])
      : null
  const parameters = parameterStatuses({ model, theta, options, fitted, live, info, post })
  const correlation: Record<string, number> = {}
  if (info)
    for (const [ia, a] of live.entries())
      for (const [ib, b] of live.entries())
        if (a < b)
          correlation[`${nth(names, a)}:${nth(names, b)}`] = nth(nth(info.correlation, ia), ib)
  return {
    parameters,
    conditionNumber: info?.conditionNumber ?? Infinity,
    confounded: confoundedParameters(info, live, maxInflation),
    correlation,
  }
}

/** Component of the smallest eigenvalue's eigenvector above which a parameter is named confounded (chosen). */
const confoundedComponent = 0.3

/** Interval of `p` around `value` from its standard error per unit parameter, times `half`. */
function intervalAround(p: RangeStringParameter, value: number, half: number, level: number) {
  return p.name === 'zeroOffset'
    ? { lower: value - half, upper: value + half, confidenceLevel: level }
    : { lower: value * Math.exp(-half), upper: value * Math.exp(half), confidenceLevel: level }
}

/** Standard error of the parameter per unit of its scale: of ln q, or of the zero offset in rad. */
const unitSigma = (p: RangeStringParameter) =>
  p.posteriorSigma ??
  (p.name === 'zeroOffset'
    ? (p.standardUncertainty as number)
    : (p.relativeStandardUncertainty as number))

/**
 * Standard errors and identifiability of muzzle velocity, drag factor and click value (and the
 * zero offset with `fitZeroOffset`) for the
 * distances and shot counts of a planned session, at the nominal parameters. Nothing is fitted;
 * the standard errors are those the fit would report for noise-free data.
 */
export function planTruingStrings(
  input: TruingPlanInput,
  options: RangeStringOptions = {},
): TruingPlan {
  const { shot, clickValue, dispersion, entries, chronograph } = input
  checkCommon(shot, clickValue, options)
  need(dispersion > 0 && Number.isFinite(dispersion), 'dispersion must be positive')
  checkEntries(entries, chronograph, false)
  const rows = plannedRows(input)
  const model = new Model(shot, clickValue, rows, options)
  model.nominal()
  const a = analyse(model, zeros, options)
  const level = options.confidenceLevel ?? rangeStringDefaults.confidenceLevel
  const z = Math.sqrt(chiSquareQuantile(level, 1))
  return {
    ...a,
    parameters: a.parameters.map((p) =>
      p.status === 'identified'
        ? { ...p, interval: intervalAround(p, p.nominal, z * unitSigma(p), level) }
        : p,
    ),
    observationCount: rows.length,
    refusals: planRefusals(entries, chronograph),
  }
}

/** One candidate string of `comparePlanCandidates`: planned entries and chronograph readings. */
export interface PlanCandidate {
  /** Label returned with the result. */
  name?: string | undefined
  /** Planned distances. */
  entries: readonly PlanEntry[]
  /** Planned muzzle velocity readings. */
  chronograph?: TruingPlanInput['chronograph'] | undefined
}

/** Plan of one candidate string. */
export interface CandidatePlan {
  /** The candidate's `name`. */
  name?: string
  /** Total planned shots: the entries' and the chronograph's. */
  shotCount: number
  /** Statuses, standard errors and predicted intervals, as `planTruingStrings`. */
  plan: TruingPlan
}

/**
 * Plans each candidate string on the same nominal shot, click value, dispersion and options, in
 * the order given. Every plan carries the interval each identified parameter would get from
 * the fit (`RangeStringParameter.interval`), so candidates compare by predicted interval width and
 * shot count before any shot (`apps/docs/docs/models/exterior-truing-strings.md`).
 */
export function comparePlanCandidates(
  input: Omit<TruingPlanInput, 'entries' | 'chronograph'>,
  candidates: readonly PlanCandidate[],
  options: RangeStringOptions = {},
): CandidatePlan[] {
  need(candidates.length > 0, 'at least one candidate')
  return candidates.map((c) => ({
    ...(c.name === undefined ? {} : { name: c.name }),
    shotCount: c.entries.reduce((n, e) => n + e.shotCount, 0) + (c.chronograph?.shotCount ?? 0),
    plan: planTruingStrings({ ...input, entries: c.entries, chronograph: c.chronograph }, options),
  }))
}

/** Observed and predicted value of one row after the fit. */
export interface RangeStringResidual {
  /** `impact` (m), `dial` (clicks) or `velocity` (m/s); the unit of the values below. */
  kind: Row['kind']
  /** Slant range, m; the instrument distance for `velocity`. */
  range: number
  /** Observed value. */
  observed: number
  /** Predicted value of the reported model. */
  predicted: number
  /** Predicted minus observed. */
  residual: number
  /** Residual over the row's standard uncertainty. */
  standardized: number
}

/** A failure of the iteration, which left `parameters` out of the fit. */
export interface RangeStringFailure {
  reason: LogFitFailure
  parameters: RangeStringParameterName[]
}

/** Result of `fitTruingStrings`. */
export interface RangeStringFit {
  /** The parameters (three, four with `fitZeroOffset`), in the order of `RangeStringParameterName`; intervals where identified. */
  parameters: RangeStringParameter[]
  /** Parameters held at their nominal value in the final fit (no information, collinear, weak or failed). */
  held: RangeStringParameterName[]
  /** Pairs with their correlation, for the parameters that are not unresolved. */
  correlation: Record<string, number>
  /** Parameters in the direction of the smallest eigenvalue when some are collinear. */
  confounded: RangeStringParameterName[]
  /** Condition number of the column-scaled information of the resolved parameters; Infinity when singular. */
  conditionNumber: number
  /** One row per entry in input order, then the chronograph. */
  residuals: RangeStringResidual[]
  /** Of the model that is reported: the identified parameters fitted, every other at its nominal value. */
  chiSquare: number
  /** Rows minus the parameters fitted. */
  degreesOfFreedom: number
  /** Probability of a chi-square at least this large; absent without degrees of freedom. */
  pValue?: number
  /** Whether the residuals agree with the stated uncertainties at `residualConfidenceLevel`; absent at 0 dof. */
  consistent?: boolean
  /**
   * False when `consistent` is false, or when an identified parameter is conditional on a held
   * one (`RangeStringParameter.conditionalOn`): the intervals are not to be relied on
   * (`apps/docs/docs/models/exterior-truing-strings.md`, "Residual check").
   */
  intervalsTrusted: boolean
  /**
   * Factor on the standard errors in the intervals: sqrt(chiSquare / dof), at least
   * `minIntervalScale`, with `scaleByResidual` and dof > 0, else 1.
   */
  intervalScale: number
  /** Failures of the iteration, in order; the parameters named are `unresolved` with reason `fit-failed`. */
  failures: RangeStringFailure[]
  /** Iterations of the final solver run. */
  iterations: number
  /** The input shot with the identified values applied. */
  shot: TrajectoryInput
}

/** Input of `fitTruingStrings`. */
export interface TruingStringsInput {
  /** The nominal shot: muzzle velocity, projectile with its drag, rifle, air, zero. */
  shot: TrajectoryInput
  /** Nominal click value, rad per click. */
  clickValue: number
  /** Measured distances; at least one entry or a chronograph. */
  entries: readonly RangeStringEntry[]
  /** Measured muzzle velocity readings. */
  chronograph?: Chronograph | undefined
}

/**
 * Parameters to fit at the nominal values: the resolved ones; while the information is singular
 * or there are fewer rows than parameters, the most collinear one is held at its nominal value.
 */
function screenParameters(model: Model, maxCondition: number): number[] {
  const j0 = model.jacobian(zeros, model.active)
  if (!j0) throw new TruingError('unreachable', { detail: model.failure })
  const dead = unresolved(model, j0, model.active)
  const kept = model.active.filter((j) => !dead.includes(j))
  while (kept.length > 0) {
    const info = identifiability(j0.map((row) => kept.map((j) => nth(row, j))))
    if (kept.length <= model.rows.length && info.conditionNumber <= maxCondition) break
    const worst = info.varianceInflation.reduce(
      (m, v, k) => (v >= nth(info.varianceInflation, m) ? k : m),
      0,
    )
    kept.splice(worst, 1)
  }
  return kept
}

/** Solution of `solveStrings`: all four log parameters, the predicted rows and the iterations. */
interface StringsSolution {
  theta: readonly number[]
  predicted: readonly number[]
  iterations: number
}

/**
 * Levenberg-Marquardt on the parameters `fitting`; the others stay at their nominal value.
 * `first` holds the predicted rows at the nominal values.
 */
function solveStrings(
  model: Model,
  first: readonly number[],
  fitting: readonly number[],
  maxIterations: number,
  maxCondition: number,
): StringsSolution {
  const rows = model.rows
  if (fitting.length === 0) return { theta: zeros, predicted: first, iterations: 0 }
  const expand = (t: readonly number[]) =>
    [0, 1, 2, 3].map((j) => (fitting.includes(j) ? nth(t, fitting.indexOf(j)) : 0))
  // a prior is a pseudo-observation of theta_j = 0 with its sigma, after the data rows
  const priors = model.priors.filter((p) => fitting.includes(p.j))
  const fit = logLeastSquares({
    parameterCount: fitting.length,
    observed: [...rows.map((x) => x.value), ...priors.map(() => 0)],
    standardUncertainty: [...rows.map((x) => x.sigma), ...priors.map((p) => p.sigma)],
    weighted: true,
    floor: [...rows.map((x) => (1e-6 * x.scale) / x.sigma), ...priors.map(() => 0)],
    first: [...first, ...priors.map(() => 0)],
    predict: (trial) => {
      const out = model.predict(expand(trial))
      return out && [...out, ...priors.map((p) => nth(trial, fitting.indexOf(p.j)))]
    },
    maxIterations,
    maxCondition,
    fail: (reason, _t, extra = {}) => {
      throw new TruingError(reason, { ...extra, detail: model.failure })
    },
  })
  return {
    theta: expand(fit.theta),
    predicted: fit.predicted.slice(0, rows.length),
    iterations: fit.iterations,
  }
}

/** The reported model: its solution, its identification, the parameters fitted in it, and why others were left out. */
interface Refit {
  fitted: StringsSolution
  a: Identification
  kept: number[]
  failures: RangeStringFailure[]
  /** A dropped weak parameter keeps the numbers and reasons that made it weak. */
  dropped: Map<number, RangeStringParameter>
}

/** The kept parameters (by column) a failure of the fit names, none when it names none. */
function failureParameters(e: TruingError, kept: readonly number[]) {
  if (e.reason === 'unresolved') return kept.filter((_, i) => e.unresolved?.includes(i))
  if (e.reason === 'ill-conditioned')
    return kept.filter((_, i) => Math.abs(e.direction?.[i] ?? 0) > confoundedComponent)
  return []
}

/**
 * Fits `kept`, then re-screens at the solution: a parameter kept in the fit that turns out weak is
 * held at its nominal value and the rest is fitted again, so the reported model is the fitted one.
 * A failure drops the parameters it names and fits again.
 */
function refitUntilIdentified(
  model: Model,
  first: readonly number[],
  start: number[],
  options: RangeStringOptions,
): Refit {
  const { maxIterations = rangeStringDefaults.maxIterations } = options
  const { maxCondition = rangeStringDefaults.maxCondition } = options
  let kept = start
  const failures: RangeStringFailure[] = []
  const dropped = new Map<number, RangeStringParameter>()
  let fitted: StringsSolution
  let a: Identification
  for (;;) {
    try {
      fitted = solveStrings(model, first, kept, maxIterations, maxCondition)
      a = analyse(model, fitted.theta, options, { kept })
    } catch (e) {
      if (!(e instanceof TruingError) || kept.length === 0) throw e
      const named = failureParameters(e, kept)
      const left = named.length > 0 ? named : kept
      failures.push({
        reason: e.reason as LogFitFailure,
        parameters: left.map((j) => nth(names, j)),
      })
      kept = kept.filter((j) => !left.includes(j))
      continue
    }
    const weak = kept.filter((j) => nth(a.parameters, j).status !== 'identified')
    if (weak.length === 0) break
    for (const j of weak) dropped.set(j, nth(a.parameters, j))
    kept = kept.filter((j) => !weak.includes(j))
  }
  return { fitted, a, kept, failures, dropped }
}

/** Residuals, residual check and intervals of the reported model. */
function stringsFitResult(model: Model, options: RangeStringOptions, refit: Refit): RangeStringFit {
  const { fitted, a, kept, failures, dropped } = refit
  const rows = model.rows
  const n = rows.length
  const level = options.confidenceLevel ?? rangeStringDefaults.confidenceLevel
  const { theta, predicted, iterations } = fitted
  const residuals = rows.map((x, i): RangeStringResidual => {
    const value = nth(predicted, i)
    return {
      kind: x.kind,
      range: x.range,
      observed: x.value,
      predicted: value,
      residual: value - x.value,
      standardized: (value - x.value) / x.sigma,
    }
  })
  const chiSquare = residuals.reduce((s, r) => s + r.standardized ** 2, 0)
  const dof = n - kept.length
  const { residualConfidenceLevel = rangeStringDefaults.residualConfidenceLevel } = options
  const consistent =
    dof > 0 ? chiSquare <= chiSquareQuantile(residualConfidenceLevel, dof) : undefined
  const scaled = options.scaleByResidual === true && dof > 0
  const intervalScale = scaled ? Math.max(Math.sqrt(chiSquare / dof), minIntervalScale) : 1
  const quantile = scaled
    ? studentTwoSidedQuantile(level, dof)
    : Math.sqrt(chiSquareQuantile(level, 1))
  const failed = failures.flatMap((f) => f.parameters)
  const final = a.parameters.map((q, j) => dropped.get(j) ?? q)
  // A held parameter with information (weak or failed) shifts the fitted ones: their intervals
  // hold the sampling error of the data, not the error of its nominal value.
  const used = names.slice(0, model.active.length)
  const heldWithInformation = used.filter(
    (name, j) => !kept.includes(j) && (failed.includes(name) || nth(final, j).status === 'weak'),
  )
  const conditional = kept.length > 0 && heldWithInformation.length > 0
  const intervalsTrusted = consistent !== false && !conditional
  const parameters = final.map((p): RangeStringParameter => {
    const trusted = consistent !== false
    if (failed.includes(p.name)) {
      const { value: _v, standardUncertainty: _s, ...rest } = p
      return { ...rest, status: 'unresolved', reasons: ['fit-failed'], intervalsTrusted: trusted }
    }
    if (p.status !== 'identified' || p.value === undefined)
      return { ...p, intervalsTrusted: trusted }
    const half = quantile * intervalScale * unitSigma(p)
    return {
      ...p,
      intervalsTrusted,
      ...(conditional ? { conditionalOn: heldWithInformation } : {}),
      interval: intervalAround(p, p.value, half, level),
    }
  })
  return {
    parameters,
    held: used.filter((_, j) => !kept.includes(j)),
    correlation: a.correlation,
    confounded: a.confounded,
    conditionNumber: a.conditionNumber,
    residuals,
    chiSquare,
    degreesOfFreedom: dof,
    ...(consistent === undefined ? {} : { pValue: chiSquareSurvival(chiSquare, dof), consistent }),
    intervalsTrusted,
    intervalScale,
    failures,
    iterations,
    shot: applied(model.shot, theta),
  }
}

/**
 * Fits muzzle velocity, drag factor (C_D times k) and click value to the entries and the
 * chronograph, weighted by their stated uncertainties. A parameter the data cannot separate is
 * named weakly identified and returns no value; the others come with confidence intervals.
 * The values, `chiSquare`, `degreesOfFreedom` and `shot` are those of one model, in which the weakly
 * identified and the failed parameters are held at their nominal values
 * (`apps/docs/docs/models/exterior-truing-strings.md`, "Fit sequence").
 */
export function fitTruingStrings(
  input: TruingStringsInput,
  options: RangeStringOptions = {},
): RangeStringFit {
  const { shot, clickValue, entries, chronograph } = input
  checkCommon(shot, clickValue, options)
  checkEntries(entries, chronograph, true)
  const { maxCondition = rangeStringDefaults.maxCondition } = options
  const model = new Model(shot, clickValue, measuredRows(entries, chronograph), options)
  const first = model.nominal()
  const kept = screenParameters(model, maxCondition)
  return stringsFitResult(model, options, refitUntilIdentified(model, first, kept, options))
}
