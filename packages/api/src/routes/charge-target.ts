import type { FastifyError, FastifyPluginAsync } from 'fastify'
import { computeErrorHandler } from '../compute/answer.ts'
import { chargeTarget } from '../compute/operations.ts'
import type { ComputeContext } from './common.ts'
import { describeAnswers } from './identity.ts'

/**
 * The charge solver of the M3 model. Registered without
 * fastify-plugin, so its error handler applies to this route only; every answer carries the notice.
 */
// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync returns a promise
export const chargeTargetRoutes: FastifyPluginAsync<ComputeContext> = async (
  app,
  { catalogue, compute },
) => {
  app.setErrorHandler<FastifyError>(
    computeErrorHandler({ withNotice: () => true, truingDetails: false }),
  )
  describeAnswers(app, catalogue)

  const { body, response, example, summary, description, run } = chargeTarget
  app.post(
    '/interior/charge-target',
    {
      bodyLimit: 256 * 1024,
      config: { body, errors: [404, 422, 503], response, example, summary, description },
    },
    async (request, reply) => {
      const { status, payload } = await run({ catalogue, compute }, request.body)
      return status === 200 ? payload : reply.code(status).send(payload)
    },
  )
}
