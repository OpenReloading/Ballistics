/** `POST /interior/charge-target`: the charge of an M3 run that reaches a target, with range, limits and warnings. */
import {
  type ChargeTarget,
  InputError,
  overlay,
  type PressureRange,
  pressureToleranceDefaults,
} from '@open-reloading/core'
import { type Powder, toSi } from '@open-reloading/schema'
import { notice, resolvedRecord, unprocessable } from './answer.ts'
import type { ChargeBody } from './charge-schema.ts'
import { bulkDensityBound, m3Options } from './interior-schema.ts'
import { type CartridgeWithSpecs, type Limit, limitCheck } from './limits.ts'
import { caps } from './schemas.ts'
import type { ComputeRunner, Results } from './tasks.ts'
import { responseUnits } from './units.ts'

/**
 * The compute runner and the record lookups a charge-target request reads. Each lookup fails an
 * unknown id with a 404 error.
 */
export type ChargeContext = {
  compute: ComputeRunner
  /** The cartridge record `id` with its values. */
  findCartridge: (id: string) => CartridgeWithSpecs | Promise<CartridgeWithSpecs>
  /** The powder record `id`. */
  findPowder: (id: string) => Powder | Promise<Powder>
}

/** A range with no case, to read the limits of a cartridge without a run. */
const emptyPressureRange: PressureRange = {
  quantity: 'maxPressure',
  nominalPressure: 0,
  lowPressure: 0,
  highPressure: 0,
  complete: true,
  tolerances: pressureToleranceDefaults,
  cases: [],
}

/** A 422 body with its `reason`; every answer of the charge solver carries the notice. */
const unprocessableAnswer = (reason: string, message: string, extra: object = {}) => ({
  ...unprocessable,
  message,
  reason,
  ...extra,
  notice,
})

/**
 * The target of the solver: the request's, or for a percentage target a share of the first
 * compared limit, as the workbench's percent readout; a 422 body when there is no such limit.
 */
function percentTarget(
  body: ChargeBody,
  cartridge: CartridgeWithSpecs | undefined,
):
  | {
      target: ChargeTarget
      limit?: Pick<Limit, 'cartridge' | 'revised' | 'symbol'> & { pressure: number }
    }
  | { refusal: ReturnType<typeof unprocessableAnswer> } {
  const target: ChargeTarget = { kind: body.target.kind, value: body.target.value }
  if (body.target.unit !== 'percentOfLimit') return { target }
  const found =
    cartridge && limitCheck(emptyPressureRange, cartridge).limits?.find((l) => l.compared)
  if (!found || found.pressure === undefined)
    return {
      refusal: unprocessableAnswer(
        'noComparableLimit',
        body.cartridge === undefined
          ? 'a percentage target needs a cartridge id'
          : `${body.cartridge} has no CIP Pmax measured by transducer or piezo`,
      ),
    }
  const limit = {
    cartridge: found.cartridge,
    revised: found.revised,
    symbol: found.symbol,
    pressure: found.pressure,
  }
  return {
    target: { kind: 'peakPressure', value: (body.target.value / 100) * limit.pressure },
    limit,
  }
}

/** The 422 body of a target the solver did not reach, with the reachable values. */
function unreachedAnswer(
  solution: Extract<Results['chargeSolve'], { reached: false }>,
  target: object,
) {
  const { failure } = solution
  return unprocessableAnswer(
    solution.reason,
    failure
      ? `no scanned charge gives a valid run: interior ${failure.reason}${failure.field ? ` (${failure.field})` : ''}`
      : `charge solver: ${solution.reason}`,
    { target, reachable: solution.reachable, failure, units: responseUnits.m3 },
  )
}

/** The 200 body: the solved charge, its run without curves, the range, the limits and the warnings. */
function chargeAnswer({
  solution,
  target,
  run,
  range,
  checked,
  powder,
}: {
  solution: Extract<Results['chargeSolve'], { reached: true }>
  target: object
  run: Extract<Results['interiorM3']['result'], { valid: true }>
  range: PressureRange
  checked: ReturnType<typeof limitCheck>
  powder: Awaited<ReturnType<typeof resolvePowder>>['powder']
}) {
  const { points: _points, ...result } = run
  return {
    notice,
    model: 'm3',
    units: responseUnits.m3,
    target,
    charge: solution.charge,
    achievedValue: solution.value,
    relativeTolerance: solution.tolerance,
    evaluationCount: solution.evaluationCount,
    reachable: solution.reachable,
    burnoutInBarrel: run.burnout !== null,
    result,
    pressureRange: range,
    limits: checked.limits,
    warnings: checked.warnings,
    resolved: powder || checked.cartridge ? { powder, cartridge: checked.cartridge } : undefined,
  }
}

/**
 * The bulk density of a request (kg/m3), else of the powder record `id`, with the record's
 * `resolved.powder` part when `id` is set. A record value outside `bulkDensityBound` is an
 * `InputError`; a request value has passed that bound already.
 */
async function resolvePowder(
  findPowder: (id: string) => Powder | Promise<Powder>,
  id: string | undefined,
  bulkDensity?: number,
) {
  if (id === undefined) return { bulkDensity, powder: undefined }
  const record = await findPowder(id)
  const fromRecord = bulkDensity === undefined
  const density = bulkDensity ?? powderBulkDensity(record)
  const powder = resolvedRecord(record, fromRecord && density !== undefined ? ['bulkDensity'] : [])
  if (density !== undefined && !bulkDensityBound.safeParse(density).success)
    throw new InputError(
      `powder ${id} bulk density ${density} kg/m3 must be above 0 and at most ${bulkDensityBound.maxValue} kg/m3`,
    )
  return { bulkDensity: density, powder }
}

/** Bulk density in kg/m3 (record g/cm3); undefined when the record has none or 0. */
export function powderBulkDensity(record: Powder): number | undefined {
  const value = record.bulkDensity?.value
  return value ? toSi('density', value) : undefined
}

/** One charge-target request (`body` parsed by `chargeBody`): the status and body of the answer. */
export async function runChargeTarget(
  context: ChargeContext,
  body: ChargeBody,
): Promise<{ status: 200 | 422; payload: Record<string, unknown> }> {
  const cartridge =
    body.cartridge === undefined ? undefined : await context.findCartridge(body.cartridge)
  const { bulkDensity: requested, ...propellant } = body.load.propellant
  const { bulkDensity, powder } = await resolvePowder(context.findPowder, body.powder, requested)
  if (body.target.kind === 'loadRatio' && bulkDensity === undefined)
    throw new InputError(`powder ${body.powder} has no bulk density`)

  const chosen = percentTarget(body, cartridge)
  if ('refusal' in chosen) return { status: 422, payload: chosen.refusal }
  const { target, limit } = chosen

  const options = m3Options(caps.chargeSteps, body.options)
  const solution = await context.compute.run({
    kind: 'chargeSolve',
    load: { ...body.load, propellant },
    target,
    options: { bulkDensity, options },
  })
  const echoTarget = { ...target, ...(limit && { percentOfLimit: body.target.value, limit }) }
  if (!solution.reached) return { status: 422, payload: unreachedAnswer(solution, echoTarget) }
  // the pressure range, limits and warnings at the solved charge, as `POST /interior` gives them
  const load = { ...body.load, propellant, charge: solution.charge }
  const tolerances = overlay(pressureToleranceDefaults, body.tolerances)
  const { result, range } = await context.compute.run({
    kind: 'interiorM3',
    load,
    options,
    tolerances,
  })
  if (!result.valid || !range) throw new Error('the solved run is not valid')
  const checked = limitCheck(range, cartridge, { result, load })
  return {
    status: 200,
    payload: chargeAnswer({ solution, target: echoTarget, run: result, range, checked, powder }),
  }
}
