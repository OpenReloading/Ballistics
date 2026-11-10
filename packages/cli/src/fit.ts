import {
  fitPowderPooled,
  type PooledSession,
  PowderFitError,
  type PowderFitReason,
} from '@open-reloading/ballistics'
import { compareKeys, fromSi, type Powder, toSi } from '@open-reloading/schema'
import { Refusal, UsageError } from './errors.ts'
import { type InteriorModel, loadOf, outcomes, predict } from './evaluate.ts'
import type { Records } from './records.ts'
import type { Row } from './rows.ts'
import { splitOf } from './split.ts'
import { percentile } from './stats.ts'

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
  /** With `--energy prior`: the specific energy laid over the record, J/kg, and where its prior impetus came from. */
  energy?: { value: number; prior: PriorKind }
}

/** Where a powder's prior impetus came from: its own thermochemistry, the median of its propellant base, or the median of all. */
type PriorKind = 'own' | 'base' | 'pooled'

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

/** `records` with each fitted burn coefficient (and energy of `--energy prior`) laid over its powder and without the interior parameters of a powder not fitted, whose rows then count as `noPowderModel`. */
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
