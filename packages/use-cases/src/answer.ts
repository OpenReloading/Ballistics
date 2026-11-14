/** Parts of compute answers shared by the compute routes: the notice, error answers and checks. */

import { TruingError } from '@rangefoundry/ballistics'
import type { Bullet, Powder, Provenance } from '@rangefoundry/schema'
import { InputError } from '@rangefoundry/statistics'
import { z } from 'zod'
import { RecordNotFound, InputError as UseCaseInputError } from './issue.ts'
import { ComputeBusy, ComputeTimeout } from './tasks.ts'

/** The text every interior answer carries. */
export const notice = 'simulation, not load data'
/** Status fields of a 422 answer. */
export const unprocessable = { statusCode: 422, error: 'Unprocessable Entity' } as const
const unavailable = { statusCode: 503, error: 'Service Unavailable' } as const

/**
 * The `resolved.bullet` or `resolved.powder` part of a response: identity and provenance of the
 * record, and `suppliedFields`, the names of request values the record supplied.
 */
export interface ResolvedRecord {
  id: string
  manufacturer: string
  name: string
  suppliedFields: string[]
  /** Absent on a record of basic fields only. */
  provenance?: Provenance | undefined
}

/** The {@link ResolvedRecord} of a bullet or powder record. */
export function resolvedRecord(record: Bullet | Powder, suppliedFields: string[]): ResolvedRecord {
  const { id, manufacturer, name, provenance } = record
  return { id, manufacturer, name, suppliedFields, provenance }
}

/** A compute error as an answer: status, body and, for a full pool, `retry-after` in seconds. */
export type ErrorAnswer = { status: number; body: Record<string, unknown>; retryAfter?: number }

/**
 * The answer of a compute error: 503 for a compute deadline (`timeout`) or a full pool (`busy`,
 * with `retryAfter`), 400 with `issues` for a zod error, 404 with the `code` and `params` of a
 * `RecordNotFound`, 422 for an `InputError`, with the `TruingError` fields where `truingDetails` is
 * set and with the `code` and `params` of a typed refusal. `withNotice` adds the notice (a
 * `TruingError` or `RecordNotFound` answer never has it). Undefined for any other error.
 */
export function errorAnswer(
  error: unknown,
  { withNotice, truingDetails }: { withNotice: boolean; truingDetails: boolean },
): ErrorAnswer | undefined {
  const extra = withNotice ? { notice } : {}
  if (error instanceof ComputeTimeout)
    return {
      status: 503,
      body: { ...unavailable, message: error.message, reason: 'timeout', ...extra },
    }
  if (error instanceof ComputeBusy)
    return {
      status: 503,
      body: { ...unavailable, message: error.message, reason: 'busy', ...extra },
      retryAfter: error.retryAfterSeconds,
    }
  if (error instanceof z.ZodError)
    return {
      status: 400,
      body: {
        statusCode: 400,
        error: 'Bad Request',
        message: 'request does not match the schema',
        issues: error.issues.map(({ path, message }) => ({ path, message })),
        ...extra,
      },
    }
  if (error instanceof RecordNotFound) return notFoundAnswer(error)
  if (truingDetails && error instanceof TruingError) return truingAnswer(error)
  if (error instanceof InputError) {
    const { issue } = error
    const typed = issue === undefined ? {} : { code: issue.code, params: jsonParams(issue.params) }
    return { status: 422, body: { ...unprocessable, message: error.message, ...typed, ...extra } }
  }
  return undefined
}

/** The 404 answer of an unknown record id, with its `code` and `params`. */
function notFoundAnswer(error: RecordNotFound): ErrorAnswer {
  const { code, params } = error.issue
  return {
    status: 404,
    body: { statusCode: 404, error: 'Not Found', message: error.message, code, params },
  }
}

/** The 422 answer of a `TruingError` with its fields and the trajectory refusal that stopped it. */
function truingAnswer(error: TruingError): ErrorAnswer {
  const { message, reason, conditionNumber, unresolved, direction, estimate, detail } = error
  return {
    status: 422,
    body: {
      ...unprocessable,
      message,
      reason,
      conditionNumber,
      unresolved,
      direction,
      estimate,
      ...(detail && { detail: { code: detail.code, params: jsonParams(detail.params) } }),
    },
  }
}

/** `params` with a number JSON cannot hold (NaN, an infinity) written as JavaScript writes it. */
const jsonParams = (params: object) =>
  Object.fromEntries(
    Object.entries(params).map(([k, v]) => [
      k,
      typeof v === 'number' && !Number.isFinite(v) ? String(v) : v,
    ]),
  )

/** Whether the number `n` at `path` may stand: finite, or NaN (with `infinite` also infinite) at an `allowed` path. */
const numberAllowed = (n: number, path: string, allowed: RegExp | undefined, infinite: boolean) =>
  Number.isFinite(n) || ((infinite || Number.isNaN(n)) && allowed?.test(path) === true)

/** The path of the first non-finite number in a result, undefined if none (null is allowed); `allowed` paths may hold NaN, and with `infinite` also an infinite number. */
function nonFinite(
  value: unknown,
  path: string,
  allowed?: RegExp,
  infinite = false,
): string | undefined {
  if (typeof value === 'number')
    return numberAllowed(value, path, allowed, infinite) ? undefined : path
  if (value === null || typeof value !== 'object') return undefined
  for (const [key, v] of Object.entries(value)) {
    const found = nonFinite(v, `${path}.${key}`, allowed, infinite)
    if (found !== undefined) return found
  }
  return undefined
}

/** `response` unchanged; throws `InputError` (a 422) at its first non-finite number outside the `allowed` paths (`nonFinite`). */
export function assertFinite<T>(response: T, allowed?: RegExp, infinite = false): T {
  const path = nonFinite(response, '', allowed, infinite)
  // extreme inputs inside the schema bounds can overflow, so this is answered as a client error
  if (path !== undefined)
    throw new UseCaseInputError({ code: 'resultNotFinite', params: { path: path.slice(1) } })
  return response
}
