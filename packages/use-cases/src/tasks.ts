/** Run in a worker (a Node worker thread in the API, a Web Worker in the web app); errors cross the thread boundary as plain objects, rebuilt into `TruingError`, `InputError` or `Error`; no Node imports, as the web app bundles this module. */

import {
  type ChargeSolverOptions,
  type ChargeTarget,
  comparePlanCandidates,
  fitTruingStrings,
  type InteriorLoad,
  type InteriorOptions,
  type InteriorResult,
  interior,
  interiorPressureRange,
  interiorSampledBand,
  type PressureRange,
  type PressureTolerances,
  type SampledBand,
  type SamplingOptions,
  solveCharge,
  type TruedParameter,
  TruingError,
  type TruingReason,
  trajectory,
  trueDrag,
  trueMuzzleVelocity,
} from '@open-reloading/ballistics'
import { InputError } from '@rangefoundry/statistics'

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

/** A compute task and its arguments; `kind` selects the ballistics function that runs it. */
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
      sampling?: Omit<SamplingOptions, 'now'> | undefined
    }
  | { kind: 'chargeSolve'; load: InteriorLoad; target: ChargeTarget; options: ChargeSolverOptions }

/** Result type of each `Task` kind: the return type of the ballistics function that runs it; `interiorM3` holds the run, its pressure range and its sampled band. */
export interface Results {
  trajectory: ReturnType<typeof trajectory>
  truingMuzzleVelocity: ReturnType<typeof trueMuzzleVelocity>
  truingDrag: ReturnType<typeof trueDrag>
  rangeStringsPlan: ReturnType<typeof comparePlanCandidates>
  rangeStringsFit: ReturnType<typeof fitTruingStrings>
  interiorM3: {
    result: InteriorResult
    range: PressureRange | undefined
    sampled: SampledBand | undefined
  }
  chargeSolve: ReturnType<typeof solveCharge>
}

const runners: { [K in Task['kind']]: (t: Extract<Task, { kind: K }>) => Results[K] } = {
  trajectory: (t) => trajectory(...t.args),
  truingMuzzleVelocity: (t) => trueMuzzleVelocity(...t.args),
  truingDrag: (t) => trueDrag(...t.args),
  rangeStringsPlan: (t) => comparePlanCandidates(...t.args),
  rangeStringsFit: (t) => fitTruingStrings(...t.args),
  interiorM3: (t) => {
    const result = interior(t.load, t.options)
    // the pressure range is computed only for a valid result
    const range = result.valid
      ? interiorPressureRange(t.load, result.peakBreechPressure, t.tolerances, t.options)
      : undefined
    const sampled =
      result.valid && t.sampling
        ? interiorSampledBand(
            t.load,
            t.tolerances,
            { ...t.sampling, now: () => performance.now() },
            t.options,
          )
        : undefined
    return { result, range, sampled }
  },
  chargeSolve: (t) => solveCharge(t.load, t.target, t.options),
}

/** Runs `task` in this thread and returns the result of the ballistics function of its `kind`. */
export function runTask<T extends Task>(task: T): Results[T['kind']] {
  // a task can arrive in a worker message: only the table's own kinds dispatch
  const run: unknown = Object.hasOwn(runners, task.kind) ? runners[task.kind] : undefined
  if (typeof run !== 'function') throw new Error(`unknown compute task kind ${task.kind}`)
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- `runners` maps each kind to the function of that kind's task and result
  return (run as (t: Task) => unknown)(task) as Results[T['kind']]
}

/** An error as a plain object, so it crosses the worker thread boundary. */
export type SerializedError = {
  name: 'TruingError' | 'InputError' | 'Error'
  message: string
  reason?: TruingReason | undefined
  conditionNumber?: number | undefined
  unresolved?: number[] | undefined
  direction?: number[] | undefined
  estimate?: TruedParameter[] | undefined
  /** The trajectory refusal that stopped a truing fit. */
  detail?: TruingError['detail']
  /** The typed refusal of an `InputError` that has one. */
  issue?: InputError['issue']
}

/** Plain-object form of `error`: `TruingError` and `InputError` keep their fields, any other value becomes an `Error` with its message. */
export function serializeError(error: unknown): SerializedError {
  if (error instanceof TruingError) {
    const { message, reason, conditionNumber, unresolved, direction, estimate, detail } = error
    return {
      name: 'TruingError',
      message,
      reason,
      conditionNumber,
      unresolved,
      direction,
      estimate,
      detail,
    }
  }
  if (error instanceof InputError)
    return {
      name: 'InputError',
      message: error.message,
      ...(error.issue && { issue: error.issue }),
    }
  return { name: 'Error', message: error instanceof Error ? error.message : String(error) }
}

/** What a worker posts back for one task: the result, or the error as a plain object. */
export type TaskReply =
  | { succeeded: true; value: unknown }
  | { succeeded: false; error: SerializedError }

/** The reply to `task` that a worker posts: runs it in this thread and serializes its error. */
export function replyTo(task: Task): TaskReply {
  try {
    return { succeeded: true, value: runTask(task) }
  } catch (error) {
    return { succeeded: false, error: serializeError(error) }
  }
}

/** Inverse of `serializeError`: rebuilds a `TruingError`, an `InputError` or an `Error`. */
export function reviveError(error: SerializedError): Error {
  if (error.name === 'TruingError') {
    const { conditionNumber, unresolved, direction, estimate, detail } = error
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- serializeError writes the reason of every TruingError
    return new TruingError(error.reason as TruingReason, {
      conditionNumber,
      unresolved,
      direction,
      estimate,
      detail,
    })
  }
  if (error.name === 'InputError') return new InputError(error.issue ?? error.message)
  return new Error(error.message)
}

/** Runs tasks and returns their results; a failing task rejects with the rebuilt error. */
export interface ComputeRunner {
  /** Runs `task` and resolves with its result. */
  run<T extends Task>(task: T): Promise<Results[T['kind']]>
  /** Releases the workers, if any. */
  close(): Promise<void>
}

/** Runs tasks in this thread: the command line, the API's contract document and static files, and tests. */
export const inlineRunner: ComputeRunner = {
  run: async (task) => runTask(task),
  close: async () => {},
}
