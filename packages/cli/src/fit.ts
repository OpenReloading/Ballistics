import {
  fitPowderPooled,
  type PooledSession,
  PowderFitError,
  type PowderFitReason,
} from '@open-reloading/ballistics'
import { compareKeys, toSi } from '@open-reloading/schema'
import { nth } from '@open-reloading/statistics'
import { type InteriorModel, loadOf, outcomes } from './evaluate.ts'
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

/** The sessions of one powder's used training rows, one per load without its charge, and their rows in ladder order; with `pressure`, a printed pressure over its basis factor is a point's peak pressure. */
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
  const sessions = [...groups.values()].map((group): PooledSession => {
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
  return { sessions, ordered: [...groups.values()].flat() }
}

/** The model a fit runs and the sigmas of its rows. */
type FitRun = { model: InteriorModel; velocitySigma: number; pressure?: PressureRun | undefined }

/** Per pressure row of a fit, its basis and the log of the printed pressure over the model's peak. */
type PressureLog = { basis: string; log: number }

/** The fit of one powder under `model` whose record burn coefficient is `vivacity`, independent of the other powders, with its pressure logs, or why it failed. */
function fitOne(
  id: string,
  vivacity: number,
  rows: readonly Row[],
  records: Records,
  run: FitRun,
): { value: PowderFitValue; logs: PressureLog[] } | NotFitted {
  if (rows.length === 0) return 'noUsableRow'
  try {
    const { sessions, ordered } = sessionsOf(id, rows, records, {
      velocity: run.velocitySigma,
      pressure: run.pressure,
    })
    const fit = fitPowderPooled(sessions, { interior: run.model })
    const peaks = fit.residuals.filter((r) => r.quantity === 'pressure')
    const printed = run.pressure
      ? ordered.flatMap((r) => (r.pressure === undefined ? [] : [{ r, pressure: r.pressure }]))
      : []
    const logs = printed.map(({ r, pressure }, i) => ({
      basis: basisOf(r),
      log: Math.log(toSi('pressure', pressure) / nth(peaks, i).predicted),
    }))
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
    const result: PowderFitValue = {
      vivacity: {
        value,
        standardUncertainty: (burn.standardUncertainty / burn.value) * scale * value,
      },
      factor,
      rows: rows.length,
      cartridges: new Set(rows.map((r) => r.cartridge)).size,
      chiSquarePerDegree: perDegree,
      iterations: fit.iterations,
      ...(run.pressure && { pressureRows: logs.length }),
    }
    return { value: result, logs }
  } catch (error) {
    if (error instanceof PowderFitError) return error.reason
    throw error
  }
}

/** One fit of each powder the rows name that has interior parameters, to its `used` rows, with the pressure logs of the powders fitted. */
function fitEach(ids: readonly string[], used: readonly Row[], records: Records, run: FitRun) {
  const powders: Record<string, PowderFitValue> = {}
  const notFitted: Record<string, NotFitted> = {}
  const logs: PressureLog[] = []
  for (const id of ids) {
    const vivacity = records.powders.get(id)?.interior?.vivacity.value
    if (vivacity === undefined) continue
    const own = used.filter((r) => r.powder === id)
    const fit = fitOne(id, vivacity, own, records, run)
    if (typeof fit === 'string') notFitted[id] = fit
    else {
      powders[id] = fit.value
      logs.push(...fit.logs)
    }
  }
  return { powders, notFitted, logs }
}

/** Per basis of `logs`, the exponential of their mean and their number, bases sorted. */
function basisFactors(logs: readonly PressureLog[]) {
  const bases = new Map<string, number[]>()
  for (const { basis, log } of logs) bases.set(basis, [...(bases.get(basis) ?? []), log])
  return Object.fromEntries(
    [...bases]
      .toSorted(([a], [b]) => compareKeys(a, b))
      .map(([basis, list]) => [
        basis,
        { factor: Math.exp(list.reduce((a, b) => a + b, 0) / list.length), rows: list.length },
      ]),
  )
}

/** The burn coefficient of each powder with interior parameters the rows name, fitted under `model` to its training rows that model can run, velocities corrected to the muzzle; `velocitySigma` is a fraction of the velocity; with `pressureSigma`, a fraction of the pressure, the printed pressures join the fit with one factor per basis. */
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
  if (pressureSigma === undefined) {
    const { logs: _, ...fit } = fitEach(ids, used, records, { model, velocitySigma })
    return fit
  }
  // the factor takes what the whole basis has in common (the measuring method, the source, and what the model lacks), so a powder's burn coefficient follows its velocities and only its own deviation from the basis
  let factors: ReturnType<typeof basisFactors> = {}
  for (let rounds = 1; ; rounds++) {
    const pressure = {
      sigma: pressureSigma,
      factors: Object.fromEntries(Object.entries(factors).map(([b, f]) => [b, f.factor])),
    }
    const { logs, ...fit } = fitEach(ids, used, records, { model, velocitySigma, pressure })
    const next = basisFactors(logs)
    const moved = Object.keys({ ...factors, ...next }).map((b) =>
      Math.abs(Math.log((next[b]?.factor ?? 1) / (factors[b]?.factor ?? 1))),
    )
    const converged = moved.every((m) => m < 0.001)
    factors = next
    if (converged || rounds === 5)
      return { ...fit, pressure: { sigma: pressureSigma, rounds, converged, factors } }
  }
}

/** `records` with each fitted burn coefficient laid over its powder and without the interior parameters of a powder not fitted, whose rows then count as `noPowderModel`. */
export function withFit(records: Records, fit: ReturnType<typeof fitPowders>): Records {
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
