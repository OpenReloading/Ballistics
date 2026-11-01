/** `POST /interior`: one run or a charge ladder of the M3 model, with range, limits and warnings. */
import {
  chargeLadder,
  overlay,
  type PressureRange,
  type PressureTolerances,
  pressureToleranceDefaults,
  type SampledBand,
  type SamplingOptions,
} from '@open-reloading/core'
import { assertFinite, notice, unprocessable } from './answer.ts'
import { type InteriorBody, m3Options, maxPoints, samplingDefaults } from './interior-schema.ts'
import { type CartridgeWithSpecs, limitCheck, maximumCheck } from './limits.ts'
import { caps } from './schemas.ts'
import { type ComputeRunner, ComputeTimeout, taskTimeoutMs } from './tasks.ts'
import { responseUnits } from './units.ts'

/** Ladder steps submitted to the pool at once: within the queue of a one-worker pool (4 per worker). */
const ladderBatch = 4
/**
 * A ladder batch starts only if it can end, at its tasks' deadline, within this many ms of the
 * request: a ladder answers within 15 s, so a client that waits 20 s (`requestTimeout` of the web
 * app) never gives up first.
 */
const ladderBudgetMs = 14_000
/** Output points of a whole ladder at most: five runs at the point cap, about 25 MB of JSON. */
const ladderPoints = 5 * maxPoints

/**
 * The compute runner and the cartridge lookup an interior request reads. The lookup fails an
 * unknown id with a 404 error.
 */
export type InteriorContext = {
  compute: ComputeRunner
  /** The cartridge record `id` with its values. */
  findCartridge: (id: string) => CartridgeWithSpecs | Promise<CartridgeWithSpecs>
}

type ResolvedCartridge = ReturnType<typeof limitCheck>['cartridge']

/** One interior run: the fields of a 200 answer, or the fields of a 422 for an invalid result. */
type Run =
  | {
      result: unknown
      pressureRange: PressureRange
      sampled?: SampledBand | undefined
      limits?: unknown
      warnings: unknown
      maximumCheck?: unknown
    }
  | {
      error: {
        message: string
        reason?: string | undefined
        field?: string | undefined
        flags?: unknown
      }
    }

/** The `resolved` part of an interior answer, set by a valid run. */
type Resolved = { cartridge?: ResolvedCartridge }

/** Range, limits and warnings of a valid interior result (core computes a range for each). */
function checkPressureRange(
  range: PressureRange | undefined,
  cartridge: CartridgeWithSpecs | undefined,
  run?: Parameters<typeof limitCheck>[2],
  pressureLimit?: number,
) {
  if (!range) throw new Error('no pressure range for a valid result')
  const { limits, warnings, cartridge: echoed } = limitCheck(range, cartridge, run, pressureLimit)
  return { pressureRange: range, limits, warnings, resolvedCartridge: echoed }
}

/** What every run of a request shares; a valid run sets `resolved.cartridge`. */
type RunSetup = {
  compute: ComputeRunner
  cartridge: CartridgeWithSpecs | undefined
  tolerances: PressureTolerances
  resolved: Resolved
}

/** The runs of an M3 body by charge. */
function m3Runner(body: InteriorBody, { compute, cartridge, tolerances, resolved }: RunSetup) {
  const options = m3Options(caps.interiorSteps, body.options)
  const sampling =
    body.sampling && overlay<Omit<SamplingOptions, 'now'>>(samplingDefaults, body.sampling)
  return async (charge: number): Promise<Run> => {
    const load = { ...body.load, charge }
    const { result, range, sampled } = await compute.run({
      kind: 'interiorM3',
      load,
      options,
      tolerances,
      sampling,
    })
    if (!result.valid)
      return {
        error: {
          message: `interior: ${result.reason}`,
          reason: result.reason,
          field: result.field,
        },
      }
    const { resolvedCartridge, ...checked } = checkPressureRange(
      range,
      cartridge,
      { result, load },
      body.pressureLimit,
    )
    resolved.cartridge = resolvedCartridge
    return {
      result,
      ...checked,
      ...(body.maximumPressure !== undefined && {
        maximumCheck: maximumCheck(checked.pressureRange, body.maximumPressure),
      }),
      sampled,
    }
  }
}

/** Output points of the valid runs among `steps`. */
const pointsOf = (steps: Run[]) =>
  steps.reduce(
    (n, s) => n + ('result' in s ? (s.result as { points: unknown[] }).points.length : 0),
    0,
  )

/**
 * One run per charge: each ladder step is its own pool task, with its own deadline; at most
 * `ladderBatch` at once, so a long ladder stays within the queue of a small pool. Stops after the
 * batch that brings the output above `ladderPoints`.
 */
async function runLadder(run: (charge: number) => Promise<Run>, charges: number[]) {
  const steps: ({ charge: number } & Run)[] = []
  const started = performance.now()
  for (let i = 0; i < charges.length && pointsOf(steps) <= ladderPoints; i += ladderBatch) {
    // a 503 timeout, as a step past its deadline gives, instead of a client that gave up
    if (performance.now() - started + taskTimeoutMs > ladderBudgetMs)
      throw new ComputeTimeout(`ladder would pass ${ladderBudgetMs} ms`)
    steps.push(
      ...(await Promise.all(
        charges
          .slice(i, i + ladderBatch)
          .map(async (charge) => ({ charge, ...(await run(charge)) })),
      )),
    )
  }
  return steps
}

/** The status and body of an interior answer from its ladder steps, or from one run at `load.charge`. */
async function interiorAnswer(
  body: InteriorBody,
  run: (charge: number) => Promise<Run>,
  steps: ({ charge: number } & Run)[] | undefined,
  resolved: Resolved,
): Promise<{ status: 200 | 422; payload: Record<string, unknown> }> {
  // a ladder of long runs is refused before its answer is serialized
  const points = pointsOf(steps ?? [])
  if (points > ladderPoints)
    return {
      status: 422,
      payload: {
        ...unprocessable,
        message: `ladder output of ${points} points is above ${ladderPoints}: fewer steps or a larger options.outputStep`,
        reason: 'outputTooLarge',
        notice,
      },
    }
  const one = steps ? undefined : await run(body.load.charge)
  // a ladder without one valid step is refused as a failed single run, with its first step's reason
  const failed = one ?? (steps?.every((s) => 'error' in s) ? steps[0] : undefined)
  if (failed && 'error' in failed)
    return { status: 422, payload: { ...unprocessable, ...failed.error, notice } }
  const { cartridge } = resolved
  return {
    status: 200,
    payload: assertFinite({
      notice,
      model: body.model,
      units: responseUnits[body.model],
      ...(one ?? { ladderSteps: steps }),
      resolved: cartridge ? { cartridge } : undefined,
    }),
  }
}

/**
 * One interior request: the status and body of the answer. `known` is the cartridge record when
 * the caller has fetched it already.
 */
export async function runInterior(
  context: InteriorContext,
  body: InteriorBody,
  known?: CartridgeWithSpecs,
): Promise<{ status: 200 | 422; payload: Record<string, unknown> }> {
  const cartridge =
    known ??
    (body.cartridge === undefined ? undefined : await context.findCartridge(body.cartridge))
  const tolerances = overlay(pressureToleranceDefaults, body.tolerances)
  const { ladder } = body
  const charges =
    ladder &&
    chargeLadder(body.load.charge, ladder.chargeStep, ladder.stepCount, ladder.direction ?? 'up')
  const setup: RunSetup = { compute: context.compute, cartridge, tolerances, resolved: {} }
  const run = m3Runner(body, setup)
  const steps = charges && (await runLadder(run, charges))
  return interiorAnswer(body, run, steps, setup.resolved)
}
