import {
  fitPowderPooled,
  type PooledSession,
  PowderFitError,
  type PowderFitReason,
} from '@open-reloading/ballistics'
import { compareKeys, toSi } from '@open-reloading/schema'
import { type InteriorModel, loadOf, outcomes, predict } from './evaluate.ts'
import type { Records } from './records.ts'
import type { Row } from './rows.ts'

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
  /** With pressure rows: its used rows that print a pressure. */
  pressureRows?: number
}

/** The pressure rows of a fit: the sigma, a fraction of the observed pressure, and the factor per basis (1 where absent). */
interface PressureRun {
  sigma: number
  factors: Readonly<Record<string, number>>
}

/** The basis a row's printed pressure is grouped by, as the metrics group it. */
export const basisOf = (row: Row) => row.pressureBasis ?? 'unstated'

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
        const { pressure } = sigmas
        if (!pressure || r.pressure === undefined) return point
        const peak = toSi('pressure', r.pressure) / (pressure.factors[basisOf(r)] ?? 1)
        return { ...point, peakPressure: peak, pressureSigma: pressure.sigma * peak }
      }),
    }
  })
}

/** The model a fit runs and the sigmas of its rows. */
type FitRun = { model: InteriorModel; velocitySigma: number; pressure?: PressureRun | undefined }

/** The fit of one powder under `model` whose record burn coefficient is `vivacity`, independent of the other powders, or why it failed. */
function fitOne(
  id: string,
  vivacity: number,
  rows: readonly Row[],
  records: Records,
  run: FitRun,
): PowderFitValue | NotFitted {
  if (rows.length === 0) return 'noUsableRow'
  try {
    const sessions = sessionsOf(id, rows, records, {
      velocity: run.velocitySigma,
      pressure: run.pressure,
    })
    const fit = fitPowderPooled(sessions, { interior: run.model })
    const burn = fit.parameters.find((p) => p.kind === 'burnRate' && p.group === id)
    if (!burn) throw new Error(`no burn coefficient in the fit of ${id}`)
    const factor = burn.value / burn.initial
    const value = vivacity * factor
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
      ...(run.pressure && { pressureRows: rows.filter((r) => r.pressure !== undefined).length }),
    }
  } catch (error) {
    if (error instanceof PowderFitError) return error.reason
    throw error
  }
}

/** One fit of each powder the rows name that has interior parameters, to its `used` rows. */
function fitEach(ids: readonly string[], used: readonly Row[], records: Records, run: FitRun) {
  const powders: Record<string, PowderFitValue> = {}
  const notFitted: Record<string, NotFitted> = {}
  for (const id of ids) {
    const vivacity = records.powders.get(id)?.interior?.vivacity.value
    if (vivacity === undefined) continue
    const own = used.filter((r) => r.powder === id)
    const fit = fitOne(id, vivacity, own, records, run)
    if (typeof fit === 'string') notFitted[id] = fit
    else powders[id] = fit
  }
  return { powders, notFitted }
}

/** Per basis of the `used` rows that print a pressure, of the powders `fit` holds, the exponential of the mean log of printed over model peak pressure under that fit, and their number, bases sorted. */
function basisFactors(
  used: readonly Row[],
  records: Records,
  model: InteriorModel,
  fit: ReturnType<typeof fitEach>,
) {
  const fitted = withFit(records, fit)
  const bases = new Map<string, number[]>()
  for (const r of used) {
    if (r.pressure === undefined || !(r.powder in fit.powders)) continue
    const p = predict(r, fitted, model)
    if (!('pressure' in p)) continue
    const log = Math.log(toSi('pressure', r.pressure) / p.pressure)
    bases.set(basisOf(r), [...(bases.get(basisOf(r)) ?? []), log])
  }
  return Object.fromEntries(
    [...bases]
      .toSorted(([a], [b]) => compareKeys(a, b))
      .map(([basis, list]) => [
        basis,
        { factor: Math.exp(list.reduce((a, b) => a + b, 0) / list.length), rows: list.length },
      ]),
  )
}

/** The burn coefficient of each powder with interior parameters the rows name, fitted under `model` to its training rows that model can run, velocities corrected to the muzzle; `velocitySigma` is a fraction of the velocity; with `pressureSigma`, a fraction of the pressure, the printed pressures over the factor of their basis join a second fit. */
export function fitPowders(
  rows: readonly Row[],
  records: Records,
  model: InteriorModel,
  velocitySigma: number,
  pressureSigma?: number,
) {
  const used = outcomes(rows, records, model, ['training'])
    .filter((o) => 'velocity' in o.prediction)
    .map((o) => o.row)
  const ids = [...new Set(rows.map((r) => r.powder))].toSorted(compareKeys)
  const velocities = fitEach(ids, used, records, { model, velocitySigma })
  if (pressureSigma === undefined) return velocities
  // the factor is what the basis has in common against the model fitted to velocities (the measuring method, the source, what the model lacks), so the pressure rows move a powder's burn coefficient only by its own deviation from its basis; fitted together with the pressures, the burn coefficients would take part of that common offset
  const factors = basisFactors(used, records, model, velocities)
  const pressure = {
    sigma: pressureSigma,
    factors: Object.fromEntries(Object.entries(factors).map(([b, f]) => [b, f.factor])),
  }
  const fit = fitEach(ids, used, records, { model, velocitySigma, pressure })
  return { ...fit, pressure: { sigma: pressureSigma, factors } }
}

/** `records` with each fitted burn coefficient laid over its powder and without the interior parameters of a powder not fitted, whose rows then count as `noPowderModel`. */
export function withFit(records: Records, fit: ReturnType<typeof fitEach>): Records {
  const powders = new Map(records.powders)
  for (const [id, fitted] of Object.entries(fit.powders)) {
    const powder = records.powders.get(id)
    if (powder?.interior)
      powders.set(id, {
        ...powder,
        interior: {
          ...powder.interior,
          vivacity: { ...powder.interior.vivacity, value: fitted.vivacity.value },
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
