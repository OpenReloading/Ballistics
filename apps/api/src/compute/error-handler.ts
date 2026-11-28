/** The error handler of the compute route plugins: the answers of `errorAnswer` of `@rangefoundry/use-cases`. */
import { errorAnswer } from '@rangefoundry/use-cases'
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'

/** A Fastify error handler that answers with a status code and a JSON body. */
type ComputeErrorHandler = (
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
) => FastifyReply

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
