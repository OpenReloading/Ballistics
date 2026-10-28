import type { FastifyError, FastifyPluginAsync } from 'fastify'
import { computeErrorHandler } from '../compute/answer.ts'
import { runChargeTarget } from '../compute/charge-run.ts'
import { chargeBody, chargeTargetExample } from '../compute/charge-schema.ts'
import { chargeTargetResponse } from '../compute/interior-response.ts'
import { findCartridge, findPowder } from '../compute/resolve.ts'
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

  app.post(
    '/interior/charge-target',
    {
      bodyLimit: 256 * 1024,
      config: {
        body: chargeBody,
        errors: [404, 422, 503],
        response: chargeTargetResponse,
        example: chargeTargetExample,
        summary: 'Solve the charge for a target',
        description:
          'Searches the charge at which an M3 run reaches a target peak pressure (Pa or a percentage of the cartridge CIP Pmax), muzzle velocity, load ratio, barrel time or bullet lead time. Answers the charge, the value reached, the run at that charge without curves, its pressure range, limits and warnings. A target outside the reachable values answers 422 with the reachable range. Results are simulations, not load data.',
      },
    },
    async (request, reply) => {
      const { status, payload } = await runChargeTarget(
        {
          compute,
          findCartridge: (id) => findCartridge(catalogue, id),
          findPowder: (id) => findPowder(catalogue, id),
        },
        chargeBody.parse(request.body),
      )
      return status === 200 ? payload : reply.code(status).send(payload)
    },
  )
}
