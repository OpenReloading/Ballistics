/**
 * Compute tasks run in a worker (a Node worker thread in the API, a Web Worker in the web app's
 * Pages edition). Errors cross the thread boundary as plain objects and are rebuilt into
 * `TruingError`, `InputError` or `Error`. No Node imports: the web app bundles this module.
 */
import {
  type ChargeSolverOptions,
  type ChargeTarget,
  comparePlanCandidates,
  fitTruingStrings,
  InputError,
  type InteriorLoad,
  type InteriorOptions,
  interior,
  interiorPressureRange,
  interiorSampledBand,
  type PressureTolerances,
  type SamplingOptions,
  solveCharge,
  type TruedParameter,
  TruingError,
  type TruingReason,
  trajectory,
  trueDrag,
  trueMuzzleVelocity,
} from '@openreloading/core'

/** The deadline passed while the task was queued or running. */
export class ComputeTimeout extends Error {}

/** Every worker is busy and the queue is full. */
export class ComputeBusy extends Error {
  /** Seconds a client should wait before it retries. */
  retryAfterSeconds: number
  constructor(message: string, retryAfterSeconds: number, options?: ErrorOptions) {
    super(message, options)
    this.retryAfterSeconds = retryAfterSeconds
  }
}

/** Deadline of one task from submit, queue wait included (ms). */
export const taskTimeoutMs = 5000

/** A compute task and its arguments; `kind` selects the core function that runs it. */
export type Task =
  | { kind: 'trajectory'; args: Parameters<typeof trajectory> }
  | { kind: 'truingMuzzleVelocity'; args: Parameters<typeof trueMuzzleVelocity> }
  | { kind: 'truingDrag'; args: Parameters<typeof trueDrag> }
  | { kind: 'rangeStringsPlan'; args: Parameters<typeof comparePlanCandidates> }
  | { kind: 'rangeStringsFit'; args: Parameters<typeof fitTruingStrings> }
  | {
      kind: 'interiorM3'
      load: InteriorLoad
      options: Partial<InteriorOptions>
      tolerances: PressureTolerances
      /** With it the answer also holds the sampled band (the clock is the runner's). */
      sampling?: Omit<SamplingOptions, 'now'>
    }
  | { kind: 'chargeSolve'; load: InteriorLoad; target: ChargeTarget; options: ChargeSolverOptions }

const runners = {
  trajectory: (t: Extract<Task, { kind: 'trajectory' }>) => trajectory(...t.args),
  truingMuzzleVelocity: (t: Extract<Task, { kind: 'truingMuzzleVelocity' }>) =>
    trueMuzzleVelocity(...t.args),
  truingDrag: (t: Extract<Task, { kind: 'truingDrag' }>) => trueDrag(...t.args),
  rangeStringsPlan: (t: Extract<Task, { kind: 'rangeStringsPlan' }>) =>
    comparePlanCandidates(...t.args),
  rangeStringsFit: (t: Extract<Task, { kind: 'rangeStringsFit' }>) => fitTruingStrings(...t.args),
  interiorM3: (t: Extract<Task, { kind: 'interiorM3' }>) => {
    const result = interior(t.load, t.options)
    // the pressure range is computed only for a valid result
    const range = result.valid
      ? interiorPressureRange(t.load, result.peakBreechPressure, t.tolerances, t.options)
      : undefined
    const sampled =
      result.valid && t.sampling
        ? interiorSampledBand(t.load, t.tolerances, { ...t.sampling, now: Date.now }, t.options)
        : undefined
    return { result, range, sampled }
  },
  chargeSolve: (t: Extract<Task, { kind: 'chargeSolve' }>) =>
    solveCharge(t.load, t.target, t.options),
}

/** Result type of each `Task` kind: the return type of the core function that runs it. */
export type Results = { [K in Task['kind']]: ReturnType<(typeof runners)[K]> }

/** Runs `task` in this thread and returns the result of the core function of its `kind`. */
export function runTask<T extends Task>(task: T): Results[T['kind']] {
  return (runners[task.kind] as (t: Task) => unknown)(task) as Results[T['kind']]
}

/** An error as a plain object, so it crosses the worker thread boundary. */
export type SerializedError = {
  name: 'TruingError' | 'InputError' | 'Error'
  message: string
  reason?: TruingReason
  conditionNumber?: number
  unresolved?: number[]
  direction?: number[]
  estimate?: TruedParameter[]
}

/** Plain-object form of `error`: `TruingError` and `InputError` keep their fields, any other value becomes an `Error` with its message. */
export function serializeError(error: unknown): SerializedError {
  if (error instanceof TruingError) {
    const { message, reason, conditionNumber, unresolved, direction, estimate } = error
    return {
      name: 'TruingError',
      message,
      reason,
      conditionNumber,
      unresolved,
      direction,
      estimate,
    }
  }
  if (error instanceof InputError) return { name: 'InputError', message: error.message }
  return { name: 'Error', message: error instanceof Error ? error.message : String(error) }
}

/** Inverse of `serializeError`: rebuilds a `TruingError`, an `InputError` or an `Error`. */
export function reviveError(error: SerializedError): Error {
  if (error.name === 'TruingError') {
    const { conditionNumber, unresolved, direction, estimate, message } = error
    // the message keeps the solver detail the constructor appended
    return Object.assign(
      new TruingError(error.reason as TruingReason, {
        conditionNumber,
        unresolved,
        direction,
        estimate,
      }),
      { message },
    )
  }
  if (error.name === 'InputError') return new InputError(error.message)
  return new Error(error.message)
}

/** Runs tasks and returns their results; a failing task rejects with the rebuilt error. */
export interface ComputeRunner {
  /** Runs `task` and resolves with its result. */
  run<T extends Task>(task: T): Promise<Results[T['kind']]>
  /** Releases the workers, if any. */
  close(): Promise<void>
}

/** Runs tasks in this thread; for tests that mock core. */
export const inlineRunner: ComputeRunner = {
  run: async (task) => runTask(task),
  close: async () => {},
}
