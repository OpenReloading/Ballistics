import {
  fitPowderPooled,
  type PooledSession,
  PowderFitError,
  type PowderFitReason,
} from '@open-reloading/ballistics'
import { compareKeys, fromSi, type Powder, toSi } from '@open-reloading/schema'
import { InputError, nth } from '@open-reloading/statistics'
import { Refusal, UsageError } from './errors.ts'
import { type InteriorModel, loadOf, outcomes, predict } from './evaluate.ts'
import type { Records } from './records.ts'
import type { Row } from './rows.ts'
import { splitOf } from './split.ts'
import { percentile } from './stats.ts'
import { familyOf } from './unseen.ts'

/** Why a powder with interior parameters got no fitted value. */
export const notFittedReasons = [
  'unresolved',
  'invalid',
  'not-converged',
  'ill-conditioned',
  'underdetermined',
  'noUsableRow',
] as const satisfies readonly (PowderFitReason | 'noUsableRow')[]

type NotFitted = (typeof notFittedReasons)[number]

/** The fitted burn coefficient of one powder in record units, with what it was fitted to. */
interface PowderFitValue {
  vivacity: { value: number; standardUncertainty: number }
  /** Fitted over record burn coefficient. */
  factor: number
  rows: number
  cartridges: number
  chiSquarePerDegree: number | null
  iterations: number
  /** With `--exponent family`: the exponent of its family, which the value was fitted at. */
  pressureExponent?: number
  /** With pressure rows: its used rows that print a pressure. */
  pressureRows?: number
  /** With `--energy prior`: the specific energy laid over the record, J/kg, and where its prior impetus came from. */
  energy?: { value: number; prior: PriorKind }
}

/** Where a powder's prior impetus came from: its own thermochemistry, the median of its propellant base, or the median of all. */
type PriorKind = 'own' | 'base' | 'pooled'

/** A fitted value with the chi square of its fit, data and prior rows. */
type Fitted = PowderFitValue & { chiSquare: number }

/** The exponents `--exponent family` chooses from, the grid of the study, exact from integers. */
const exponentGrid = [7, 8, 9, 10, 11, 12, 13].map((k) => k / 10)

/** Weight of the pooled term in a family's choice, in powders; fixed before any result on real rows. */
const shrinkage = 5

/** The pressure rows of a fit: the sigma, a fraction of the observed pressure, and the factor per basis (1 where absent). */
interface PressureRun {
  sigma: number
  factors: Readonly<Record<string, number>>
}

/** The basis a row's printed pressure is grouped by, as the metrics group it. */
export const basisOf = (row: Row) => row.pressureBasis ?? 'unstated'

/** The factor of a row's printed pressure, undefined without a pressure or without a factor of its basis. */
function factorOf(pressure: PressureRun | undefined, row: Row) {
  const basis = basisOf(row)
  // own keys only: a basis named like an Object.prototype member has no factor
  if (!pressure || row.pressure === undefined || !Object.hasOwn(pressure.factors, basis)) return
  return pressure.factors[basis]
}

/** The model a fit runs and the sigmas of its rows. */
type FitRun = { model: InteriorModel; velocitySigma: number; pressure?: PressureRun | undefined }

/** The sessions of one powder's used training rows, one per load without its charge; with `pressure`, a printed pressure over its basis factor is a point's peak pressure. */
function sessionsOf(
  powder: string,
  rows: readonly Row[],
  records: Records,
  sigmas: { velocity: number; pressure?: PressureRun | undefined },
) {
  const groups = new Map<string, Row[]>()
  for (const r of rows) {
    const key = JSON.stringify([
      r.cartridge,
      r.bullet,
      r.barrel,
      r.coal,
      r.temperature,
      r.session,
      r.rifle,
      r.lot,
      r.table,
    ])
    groups.set(key, [...(groups.get(key) ?? []), r])
  }
  return [...groups.values()].map((group): PooledSession => {
    const row = group[0] as Row
    const load = loadOf(row, records)
    // a used outcome had its load built, so this never holds
    if (typeof load === 'string') throw new Error(`no load for a used row: ${load}`)
    return {
      powder,
      // one test barrel per cartridge of a table where the row names no rifle
      rifle: row.rifle ?? [row.cartridge, row.barrel, row.table].join('/'),
      lot: row.lot,
      load,
      ladder: group.map((r) => {
        const point = {
          charge: toSi('mass', r.charge),
          muzzleVelocity: r.velocity,
          velocitySigma: sigmas.velocity * r.velocity,
        }
        const factor = factorOf(sigmas.pressure, r)
        if (!sigmas.pressure || factor === undefined) return point
        const peak = toSi('pressure', r.pressure as number) / factor
        return { ...point, peakPressure: peak, pressureSigma: sigmas.pressure.sigma * peak }
      }),
    }
  })
}

/** `model` with a thrown `InputError` returned as an invalid run. */
const refusedAsInvalid =
  (model: InteriorModel): InteriorModel =>
  (load, options) => {
    try {
      return model(load, options)
    } catch (error) {
      // `predict` reads this throw as a refused row; in the fit it would end the whole run instead of listing the powder
      if (error instanceof InputError) return { valid: false, reason: 'input' }
      throw error
    }
  }

/** The fit of one powder under `model` whose record burn coefficient is `vivacity.record` and whose `records` start it at `vivacity.start`, independent of the other powders, or why it failed. */
function fitOne(
  id: string,
  vivacity: { record: number; start: number },
  rows: readonly Row[],
  records: Records,
  run: FitRun,
): Fitted | NotFitted {
  if (rows.length === 0) return 'noUsableRow'
  try {
    const sessions = sessionsOf(id, rows, records, {
      velocity: run.velocitySigma,
      pressure: run.pressure,
    })
    const fit = fitPowderPooled(sessions, { interior: refusedAsInvalid(run.model) })
    const burn = fit.parameters.find((p) => p.kind === 'burnRate' && p.group === id)
    if (!burn) throw new Error(`no burn coefficient in the fit of ${id}`)
    const factor = (burn.value / burn.initial) * (vivacity.start / vivacity.record)
    const value = vivacity.record * factor
    // each rifle or lot parameter has one prior row, so this is all rows, data and prior, over all rows minus all parameters
    const degrees =
      fit.degreesOfFreedom +
      fit.parameters.filter((p) => p.kind === 'rifle' || p.kind === 'lot').length
    const perDegree = degrees > 0 ? fit.chiSquare / degrees : null
    // the usual scaling of a covariance when the residuals are larger than the assumed sigma
    const scale = Math.sqrt(Math.max(1, perDegree ?? 1))
    return {
      vivacity: {
        value,
        standardUncertainty: (burn.standardUncertainty / burn.value) * scale * value,
      },
      factor,
      rows: rows.length,
      cartridges: new Set(rows.map((r) => r.cartridge)).size,
      chiSquarePerDegree: perDegree,
      iterations: fit.iterations,
      ...(run.pressure && {
        pressureRows: rows.filter((r) => factorOf(run.pressure, r) !== undefined).length,
      }),
      chiSquare: fit.chiSquare,
    }
  } catch (error) {
    if (error instanceof PowderFitError) return error.reason
    throw error
  }
}

/** A used training row with the peak pressure (Pa) the model predicts for it at the record values. */
type Used = { row: Row; pressure: number }

/** Each powder of `ids` fitted to its rows of `used`, at its record exponent or, with `n`, at `n` from the start value that belongs to `n`. */
function fitEach(
  ids: readonly string[],
  used: readonly Used[],
  records: Records,
  run: FitRun,
  n?: number,
) {
  return new Map(
    ids.map((id): [string, Fitted | NotFitted] => {
      const own = used.filter((u) => u.row.powder === id)
      const rows = own.map((u) => u.row)
      // `ids` holds only powders with interior parameters
      const interior = records.powders.get(id)?.interior as NonNullable<Powder['interior']>
      const record = interior.vivacity.value
      if (n === undefined || rows.length === 0)
        return [id, fitOne(id, { record, start: record }, rows, records, run)]
      const pressures = own.map((u) => u.pressure)
      const typical = (percentile(pressures, 0.5) as number) / 2
      const reference = toSi('pressure', interior.referencePressure.value)
      // the rate is B (p / p_ref)^n, so a coefficient fitted at one exponent is off by a large factor at another and the solver would start in runs it cannot use
      const start = record * (typical / reference) ** (interior.pressureExponent - n)
      const at = withFit(records, {
        powders: { [id]: { vivacity: { value: start }, pressureExponent: n } },
        notFitted: {},
      })
      return [id, fitOne(id, { record, start }, rows, at, run)]
    }),
  )
}

/** The grid index of least `objective`; a tie goes to the index nearer `pooled` (by default to the smaller exponent), then to the smaller exponent. */
const best = (objective: readonly number[], pooled = 0) =>
  nth(
    objective
      .map((value, k) => ({ value, k }))
      .toSorted(
        (a, b) => a.value - b.value || Math.abs(a.k - pooled) - Math.abs(b.k - pooled) || a.k - b.k,
      ),
    0,
  ).k

/** Each powder fitted at the grid exponent its family chooses, and the choice: per family the least sum of its powders' chi squares plus `shrinkage` times the mean over all powders, over the powders fitted at every grid value. */
function familyExponents(
  ids: readonly string[],
  records: Records,
  fitAt: (n: number) => Map<string, Fitted | NotFitted>,
) {
  const fits = exponentGrid.map(fitAt)
  const entered = ids.filter((id) => fits.every((f) => typeof f.get(id) === 'object'))
  if (entered.length === 0)
    throw new Refusal(
      'no powder was fitted at every exponent of the grid, so none can be chosen; fit without --exponent lists the powders not fitted at the record exponent',
    )
  const sums = (of: readonly string[]) =>
    fits.map((f) => of.reduce((s, id) => s + (f.get(id) as Fitted).chiSquare, 0))
  const mean = sums(entered).map((s) => s / entered.length)
  const pooled = best(mean)
  const family = (id: string) => familyOf(records.powders.get(id))
  const chosen = new Map(
    [...new Set(ids.map(family))].toSorted(compareKeys).map((name) => {
      const members = entered.filter((id) => family(id) === name)
      const objective = sums(members).map((s, k) => s + shrinkage * nth(mean, k))
      return [name, { k: best(objective, pooled), powders: members.length }]
    }),
  )
  return {
    fits: new Map(
      ids.map((id): [string, Fitted | NotFitted] => {
        const k = chosen.get(family(id))?.k as number
        const fit = nth(fits, k).get(id) as Fitted | NotFitted
        return [
          id,
          typeof fit === 'string' ? fit : { ...fit, pressureExponent: nth(exponentGrid, k) },
        ]
      }),
    ),
    summary: {
      grid: exponentGrid,
      shrinkage,
      pooled: nth(exponentGrid, pooled),
      families: Object.fromEntries(
        [...chosen].map(([name, c]) => [
          name,
          { exponent: nth(exponentGrid, c.k), powders: c.powders },
        ]),
      ),
    },
  }
}

/** The fitted values and the reasons of the powders not fitted, from the fits of `fitEach`. */
function fittedAndNot(fits: ReturnType<typeof fitEach>) {
  const powders: Record<string, PowderFitValue> = {}
  const notFitted: Record<string, NotFitted> = {}
  for (const [id, fit] of fits) {
    if (typeof fit === 'string') notFitted[id] = fit
    else {
      const { chiSquare: _, ...value } = fit
      powders[id] = value
    }
  }
  return { powders, notFitted }
}

/** Per basis of the `used` rows that print a pressure, of the powders `fit` holds, the exponential of the median log of printed over model peak pressure under that fit, and their number, bases sorted. */
function basisFactors(
  used: readonly Used[],
  records: Records,
  model: InteriorModel,
  fit: ReturnType<typeof fittedAndNot>,
) {
  const fitted = withFit(records, fit)
  const bases = new Map<string, number[]>()
  for (const { row: r } of used) {
    if (r.pressure === undefined || !Object.hasOwn(fit.powders, r.powder)) continue
    const p = predict(r, fitted, model)
    if (!('pressure' in p)) continue
    const log = Math.log(toSi('pressure', r.pressure) / p.pressure)
    bases.set(basisOf(r), [...(bases.get(basisOf(r)) ?? []), log])
  }
  // the median: a misprinted row or a powder with a minority of the basis's rows does not move the factor of the others
  return Object.fromEntries(
    [...bases]
      .toSorted(([a], [b]) => compareKeys(a, b))
      .map(([basis, list]) => [
        basis,
        { factor: Math.exp(percentile(list, 0.5) as number), rows: list.length },
      ]),
  )
}

/** The burn coefficient of each powder with interior parameters the rows name, fitted under `model` to its training rows that model can run, velocities corrected to the muzzle; `velocitySigma` is a fraction of the velocity; `exponent` `family` fits each at the pressure exponent its family chooses; with `pressureSigma`, a fraction of the pressure, the printed pressures over the factor of their basis join a second fit. */
export function fitPowders(
  rows: readonly Row[],
  records: Records,
  model: InteriorModel,
  velocitySigma: number,
  options: { exponent?: 'family' | undefined; pressureSigma?: number | undefined } = {},
) {
  const used = outcomes(rows, records, model, ['training']).flatMap((o) =>
    'velocity' in o.prediction ? [{ row: o.row, pressure: o.prediction.pressure }] : [],
  )
  const ids = [...new Set(rows.map((r) => r.powder))]
    .toSorted(compareKeys)
    .filter((id) => records.powders.get(id)?.interior)
  const fitAt = (n?: number) => fitEach(ids, used, records, { model, velocitySigma }, n)
  if (options.exponent === 'family') {
    const family = familyExponents(ids, records, fitAt)
    return { ...fittedAndNot(family.fits), exponent: family.summary }
  }
  const velocities = fittedAndNot(fitAt())
  const { pressureSigma } = options
  if (pressureSigma === undefined) return velocities
  // the factor is what the basis has in common against the model fitted to velocities (the measuring method, the source, what the model lacks), so the pressure rows move a powder's burn coefficient only by its own deviation from the median of its basis; fitted together with the pressures, the burn coefficients would take part of that common offset
  const factors = basisFactors(used, records, model, velocities)
  const pressure = {
    sigma: pressureSigma,
    factors: Object.fromEntries(Object.entries(factors).map(([b, f]) => [b, f.factor])),
  }
  const fit = fittedAndNot(fitEach(ids, used, records, { model, velocitySigma, pressure }))
  return { ...fit, pressure: { sigma: pressureSigma, factors } }
}

/** The prior impetus of a powder of `records`, J/kg, and its kind; a `UsageError` without a powder with a thermochemistry. */
function priorsOf(records: Records) {
  const own = [...records.powders.values()].flatMap((p) =>
    p.thermochemistry ? [{ base: p.propellantBase, impetus: p.thermochemistry.impetus.value }] : [],
  )
  const pooled = percentile(
    own.map((o) => o.impetus),
    0.5,
  )
  if (pooled === undefined)
    throw new UsageError('--energy prior needs a powder record with a thermochemistry')
  return (powder: Powder): { value: number; prior: PriorKind } => {
    const impetus = powder.thermochemistry?.impetus.value
    if (impetus !== undefined) return { value: impetus, prior: 'own' }
    const ofBase = own.filter((o) => o.base !== undefined && o.base === powder.propellantBase)
    const base = percentile(
      ofBase.map((o) => o.impetus),
      0.5,
    )
    return base === undefined ? { value: pooled, prior: 'pooled' } : { value: base, prior: 'base' }
  }
}

// the model's impetus is (gamma - 1) times its energy, so the prior fixes the impetus and the model's own gamma turns it into the energy
const energyOf = (level: number, impetus: number, gamma: number) => (level * impetus) / (gamma - 1)

// an effective energy-level factor: it takes whatever separates the thermochemical impetus from the level the model needs (heat to the bore, what the lumped model leaves out, how the pressures were measured)
const levels = Array.from({ length: 9 }, (_, i) => (60 + 5 * i) / 100)

/** As {@link fitPowders}, with each powder's energy from its prior impetus times one energy-level factor of `levels`, the one whose fitted peak pressures are nearest the printed ones of the training rows (median absolute log ratio over the same rows at every factor that takes part); a `UsageError` without a training row that prints a pressure. */
export function fitPowdersWithPrior(
  rows: readonly Row[],
  records: Records,
  model: InteriorModel,
  velocitySigma: number,
) {
  const priorOf = priorsOf(records)
  const pressured = rows.filter(
    (r) => r.pressure !== undefined && splitOf(r.cartridge) === 'training',
  )
  if (pressured.length === 0)
    throw new UsageError('--energy prior needs training rows that print a pressure in bar')
  const named = [...new Set(rows.map((r) => r.powder))].flatMap((id) => {
    const powder = records.powders.get(id)
    return powder?.interior ? [{ powder, interior: powder.interior, prior: priorOf(powder) }] : []
  })
  const runs = levels.map((level) => {
    const powders = new Map(records.powders)
    for (const { powder, interior, prior } of named) {
      const energy = energyOf(level, prior.value, interior.gamma)
      // more energy needs a slower burn for the same velocity; 3.5 is about the ratio of the velocity's sensitivities to energy and burn rate (0.55 / 0.15), enough to start near
      const vivacity = interior.vivacity.value * (interior.energy.value / energy) ** 3.5
      powders.set(powder.id, {
        ...powder,
        interior: {
          ...interior,
          energy: { ...interior.energy, value: energy },
          vivacity: { ...interior.vivacity, value: vivacity },
        },
      })
    }
    const start = { ...records, powders }
    const fit = fitPowders(rows, start, model, velocitySigma)
    const fitted = withFit(start, fit)
    // by position in `pressured`; a powder not fitted loses its interior parameters in withFit, so its rows give no peak
    const logRatios = pressured.map((row) => {
      const p = predict(row, fitted, model)
      return 'velocity' in p && row.pressure !== undefined
        ? Math.abs(Math.log(fromSi('pressure', p.pressure) / row.pressure))
        : undefined
    })
    return { level, fit, logRatios }
  })
  const everFitted = new Set(runs.flatMap((r) => Object.keys(r.fit.powders)))
  if (everFitted.size === 0)
    throw new Refusal(
      '--energy prior: no powder was fitted at any energy-level factor; fit without --energy lists the powders not fitted at the record energy',
    )
  const takesPart = runs.map((r) => Object.keys(r.fit.powders).length >= 0.9 * everFitted.size)
  if (!takesPart.includes(true))
    throw new Refusal(
      '--energy prior: no energy-level factor has 90 % of the powders fitted at any factor fitted',
    )
  // the same rows at every factor, so a factor cannot win by losing the rows of a powder it fails to fit
  const common = pressured.flatMap((_, i) =>
    runs.every((r, k) => !takesPart[k] || r.logRatios[i] !== undefined) ? [i] : [],
  )
  if (common.length === 0)
    throw new Refusal(
      '--energy prior: no fitted powder has a training row with a pressure to compare',
    )
  const objective = runs.map((r, k) =>
    takesPart[k]
      ? (percentile(
          common.map((i) => r.logRatios[i] as number),
          0.5,
        ) ?? null)
      : null,
  )
  let best: number | undefined
  for (const [i, o] of objective.entries())
    if (o !== null && (best === undefined || o <= (objective[best] ?? o))) best = i
  const chosen = best === undefined ? undefined : runs[best]
  if (!chosen) throw new Error('a factor that takes part has no objective')
  const byId = new Map(named.map((n) => [n.powder.id, n]))
  const powders: Record<string, PowderFitValue> = {}
  for (const [id, p] of Object.entries(chosen.fit.powders)) {
    const n = byId.get(id)
    if (!n) continue
    powders[id] = {
      ...p,
      factor: p.vivacity.value / n.interior.vivacity.value,
      energy: {
        value: energyOf(chosen.level, n.prior.value, n.interior.gamma),
        prior: n.prior.prior,
      },
    }
  }
  const took = (kind: PriorKind) => named.filter((n) => n.prior.prior === kind).length
  return {
    powders,
    notFitted: chosen.fit.notFitted,
    /** `<powder id>=<prior impetus>` of each powder the rows name that has interior parameters, for the model version. */
    priorLines: named.map((n) => `${n.powder.id}=${n.prior.value}`),
    energy: {
      factor: chosen.level,
      grid: levels,
      objective,
      pressureRows: common.length,
      priors: { own: took('own'), byBase: took('base'), pooled: took('pooled') },
    },
  }
}

/** `records` with each fitted burn coefficient (and exponent or energy) laid over its powder and without the interior parameters of a powder not fitted, whose rows then count as `noPowderModel`. */
export function withFit(
  records: Records,
  fit: {
    powders: Record<
      string,
      { vivacity: { value: number }; pressureExponent?: number; energy?: { value: number } }
    >
    notFitted: Record<string, NotFitted>
  },
): Records {
  const powders = new Map(records.powders)
  for (const [id, fitted] of Object.entries(fit.powders)) {
    const powder = records.powders.get(id)
    if (powder?.interior)
      powders.set(id, {
        ...powder,
        interior: {
          ...powder.interior,
          vivacity: { ...powder.interior.vivacity, value: fitted.vivacity.value },
          ...(fitted.pressureExponent !== undefined && {
            pressureExponent: fitted.pressureExponent,
          }),
          ...(fitted.energy && {
            energy: { ...powder.interior.energy, value: fitted.energy.value },
          }),
        },
      })
  }
  for (const id of Object.keys(fit.notFitted)) {
    const powder = records.powders.get(id)
    if (powder) {
      const { interior: _, ...plain } = powder
      powders.set(id, plain)
    }
  }
  return { ...records, powders }
}
