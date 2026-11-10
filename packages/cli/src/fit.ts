import {
  fitPowderPooled,
  type PooledSession,
  PowderFitError,
  type PowderFitReason,
} from '@open-reloading/ballistics'
import { compareKeys, type Powder, toSi } from '@open-reloading/schema'
import { InputError, nth } from '@open-reloading/statistics'
import { Refusal } from './errors.ts'
import { type InteriorModel, loadOf, outcomes } from './evaluate.ts'
import type { Records } from './records.ts'
import type { Row } from './rows.ts'
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
}

/** A fitted value with the chi square of its fit, data and prior rows. */
type Fitted = PowderFitValue & { chiSquare: number }

/** The exponents `--exponent family` chooses from, the grid of the study, exact from integers. */
const exponentGrid = [7, 8, 9, 10, 11, 12, 13].map((k) => k / 10)

/** Weight of the pooled term in a family's choice, in powders; fixed before any result on real rows. */
const shrinkage = 5

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
  run: { model: InteriorModel; velocitySigma: number },
): Fitted | NotFitted {
  if (rows.length === 0) return 'noUsableRow'
  try {
    const sessions = sessionsOf(id, rows, records, run.velocitySigma)
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
  run: { model: InteriorModel; velocitySigma: number },
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
  if (entered.length === 0) throw new Refusal('no powder was fitted at every exponent of the grid')
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

/** The burn coefficient of each powder with interior parameters the rows name, fitted under `model` to its training rows that model can run, velocities corrected to the muzzle; `velocitySigma` is a fraction of the velocity; `exponent` `family` fits each at the pressure exponent its family chooses. */
export function fitPowders(
  rows: readonly Row[],
  records: Records,
  model: InteriorModel,
  velocitySigma: number,
  exponent?: 'family',
) {
  const used = outcomes(rows, records, model, ['training']).flatMap((o) =>
    'velocity' in o.prediction ? [{ row: o.row, pressure: o.prediction.pressure }] : [],
  )
  const ids = [...new Set(rows.map((r) => r.powder))]
    .toSorted(compareKeys)
    .filter((id) => records.powders.get(id)?.interior)
  const fitAt = (n?: number) => fitEach(ids, used, records, { model, velocitySigma }, n)
  const family = exponent === 'family' ? familyExponents(ids, records, fitAt) : undefined
  const powders: Record<string, PowderFitValue> = {}
  const notFitted: Record<string, NotFitted> = {}
  for (const [id, fit] of family?.fits ?? fitAt()) {
    if (typeof fit === 'string') notFitted[id] = fit
    else {
      const { chiSquare: _, ...value } = fit
      powders[id] = value
    }
  }
  return { powders, notFitted, ...(family && { exponent: family.summary }) }
}

/** `records` with each fitted burn coefficient (and exponent) laid over its powder and without the interior parameters of a powder not fitted, whose rows then count as `noPowderModel`. */
export function withFit(
  records: Records,
  fit: {
    powders: Record<string, { vivacity: { value: number }; pressureExponent?: number }>
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
