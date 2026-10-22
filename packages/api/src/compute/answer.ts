/** Parts of compute answers shared by the compute routes: the notice, error answers and checks. */
import { InputError, TruingError } from '@openreloading/core'
import type { Bullet, Powder, Provenance } from '@openreloading/schema'
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
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
  provenance: Provenance
}

/** The {@link ResolvedRecord} of a bullet or powder record. */
export function resolvedRecord(record: Bullet | Powder, suppliedFields: string[]): ResolvedRecord {
  const { id, manufacturer, name, provenance } = record
  return { id, manufacturer, name, suppliedFields, provenance }
}

/** A Fastify error handler that answers with a status code and a JSON body. */
type ComputeErrorHandler = (
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
) => FastifyReply

/** A compute error as an answer: status, body and, for a full pool, `retry-after` in seconds. */
type ErrorAnswer = { status: number; body: Record<string, unknown>; retryAfter?: number }

/**
 * The answer of a compute error: 503 for a compute deadline (`timeout`) or a full pool (`busy`,
 * with `retryAfter`), 400 with `issues` for a zod error, 422 for an `InputError`, with the
 * `TruingError` fields where `truingDetails` is set. `withNotice` adds the notice (a `TruingError`
 * answer never has it). Undefined for any other error.
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
  if (truingDetails && error instanceof TruingError) {
    const { message, reason, conditionNumber, unresolved, direction, estimate } = error
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
      },
    }
  }
  if (error instanceof InputError)
    return { status: 422, body: { ...unprocessable, message: error.message, ...extra } }
  return undefined
}

/**
 * Error handler of a compute route plugin: the answer of `errorAnswer`, the notice on requests for
 * which `withNotice` is true. Anything else goes to Fastify's default handler: its own errors
 * (invalid JSON, body too large, not found) keep their status, the rest is a 500.
 */
export function computeErrorHandler({
  withNotice,
  truingDetails,
}: {
  withNotice: (request: FastifyRequest) => boolean
  truingDetails: boolean
}): ComputeErrorHandler {
  return (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const answer = errorAnswer(error, { withNotice: withNotice(request), truingDetails })
    if (!answer) throw error
    if (answer.retryAfter !== undefined) reply.header('retry-after', String(answer.retryAfter))
    return reply.code(answer.status).send(answer.body)
  }
}

/**
 * Path of the first non-finite number in a result, undefined if none (null is allowed). `allowed`
 * paths may hold NaN, and with `infinite` also an infinite number.
 */
function nonFinite(
  value: unknown,
  path: string,
  allowed?: RegExp,
  infinite = false,
): string | undefined {
  if (typeof value === 'number')
    return Number.isFinite(value) || ((infinite || Number.isNaN(value)) && allowed?.test(path))
      ? undefined
      : path
  if (value === null || typeof value !== 'object') return undefined
  for (const [key, v] of Object.entries(value)) {
    const found = nonFinite(v, `${path}.${key}`, allowed, infinite)
    if (found !== undefined) return found
  }
  return undefined
}

/**
 * `response` unchanged; throws `InputError` (a 422) at its first non-finite number outside the
 * `allowed` paths (see `nonFinite`).
 */
export function assertFinite<T>(response: T, allowed?: RegExp, infinite = false): T {
  const path = nonFinite(response, '', allowed, infinite)
  // extreme inputs inside the schema bounds can overflow, so this is answered as a client error
  if (path !== undefined)
    throw new InputError(`result holds a non-finite number at ${path.slice(1)}`)
  return response
}
