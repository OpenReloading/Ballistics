import {
  fitPowderPooled,
  type PooledSession,
  PowderFitError,
  type PowderFitReason,
} from '@open-reloading/ballistics'
import { compareKeys, toSi } from '@open-reloading/schema'
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
}

/** The sessions of one powder's used training rows: one per load without its charge. */
function sessionsOf(powder: string, rows: readonly Row[], records: Records, velocitySigma: number) {
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
      ladder: group.map((r) => ({
        charge: toSi('mass', r.charge),
        muzzleVelocity: r.velocity,
        velocitySigma: velocitySigma * r.velocity,
      })),
    }
  })
}

/** The fit of one powder under `model` whose record burn coefficient is `vivacity`, independent of the other powders, or why it failed. */
function fitOne(
  id: string,
  vivacity: number,
  rows: readonly Row[],
  records: Records,
  run: { model: InteriorModel; velocitySigma: number },
): PowderFitValue | NotFitted {
  if (rows.length === 0) return 'noUsableRow'
  try {
    const sessions = sessionsOf(id, rows, records, run.velocitySigma)
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
    }
  } catch (error) {
    if (error instanceof PowderFitError) return error.reason
    throw error
  }
}

/** The burn coefficient of each powder with interior parameters the rows name, fitted under `model` to its training rows that model can run, velocities corrected to the muzzle; `velocitySigma` is a fraction of the velocity. */
export function fitPowders(
  rows: readonly Row[],
  records: Records,
  model: InteriorModel,
  velocitySigma: number,
) {
  const used = outcomes(rows, records, model, ['training'])
    .filter((o) => 'velocity' in o.prediction)
    .map((o) => o.row)
  const powders: Record<string, PowderFitValue> = {}
  const notFitted: Record<string, NotFitted> = {}
  for (const id of [...new Set(rows.map((r) => r.powder))].toSorted(compareKeys)) {
    const vivacity = records.powders.get(id)?.interior?.vivacity.value
    if (vivacity === undefined) continue
    const own = used.filter((r) => r.powder === id)
    const fit = fitOne(id, vivacity, own, records, { model, velocitySigma })
    if (typeof fit === 'string') notFitted[id] = fit
    else powders[id] = fit
  }
  return { powders, notFitted }
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
