import type { FastifyError, FastifyPluginAsync } from 'fastify'
import { computeErrorHandler } from '../compute/answer.ts'
import { stabilityResponse } from '../compute/exterior-response.ts'
import { type ExteriorContext, runStability } from '../compute/exterior-run.ts'
import { chargeTarget, type Operation, operations } from '../compute/operations.ts'
import { findBullet } from '../compute/resolve.ts'
import { simulate, simulateQuery } from '../compute/simulate.ts'
import { stabilityQuery } from '../compute/stability-schema.ts'
import { API_PREFIX } from '../version.ts'
import type { ComputeContext } from './common.ts'
import { describeAnswers } from './identity.ts'

/**
 * Exterior trajectory and truing, interior simulation and Miller stability.
 * Registered without fastify-plugin, so the error handler applies to these routes only. Solver
 * calls run on `compute` (a worker pool), stability here (closed form).
 */
// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync returns a promise
export const computeRoutes: FastifyPluginAsync<ComputeContext> = async (
  app,
  { catalogue, compute },
) => {
  const interiorUrls = [`${API_PREFIX}/interior`, `${API_PREFIX}/interior/load-file`]
  app.setErrorHandler<FastifyError>(
    computeErrorHandler({
      withNotice: (request) => interiorUrls.includes(request.routeOptions.url ?? ''),
      truingDetails: true,
    }),
  )
  describeAnswers(app, catalogue)

  const exterior: ExteriorContext = { compute, findBullet: (id) => findBullet(catalogue, id) }

  // `config` carries the zod schema of the request and the error statuses to the contract
  // document (`openapi.ts`): 404 for an unknown id, 422 from the error handler, 503 from the pool
  const errors = [404, 422, 503]
  const docs = ({ body, response, example, summary, description }: Operation) => ({
    body,
    errors,
    response,
    example,
    summary,
    description,
  })

  for (const op of operations.filter((o) => o !== chargeTarget)) {
    const loadFile = op.name === 'interior/load-file'
    app.post(
      `/${op.name}`,
      {
        bodyLimit: (loadFile ? 1024 : 256) * 1024,
        config: { ...docs(op), ...(loadFile && { query: simulateQuery }) },
      },
      async (request, reply) => {
        const { status, payload } = loadFile
          ? await simulate({ catalogue, compute }, request.query, request.body)
          : await op.run({ catalogue, compute }, request.body)
        return status === 200 ? payload : reply.code(status).send(payload)
      },
    )
  }

  // on the main thread: no 503
  const stabilityOptions = {
    config: {
      query: stabilityQuery,
      errors: [404, 422],
      response: stabilityResponse,
      summary: 'Gyroscopic stability',
      description:
        'The gyroscopic stability factor of a bullet by the Miller twist rule from mass, diameter, length, twist and muzzle velocity, corrected for air temperature and pressure. A `bullet` id supplies the values the query omits.',
    },
  }
  app.get('/exterior/stability', stabilityOptions, (request) =>
    runStability(exterior, stabilityQuery.parse(request.query)),
  )
}
