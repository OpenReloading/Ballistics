import type { FastifyError, FastifyPluginAsync } from 'fastify'
import type { z } from 'zod'
import { computeErrorHandler } from '../compute/answer.ts'
import {
  rangeStringsFitResponse,
  rangeStringsPlanResponse,
  stabilityResponse,
  trajectoryResponse,
  truingResponse,
} from '../compute/exterior-response.ts'
import {
  type ExteriorContext,
  runRangeStringsFit,
  runRangeStringsPlan,
  runStability,
  runTrajectory,
  runTruing,
} from '../compute/exterior-run.ts'
import {
  trajectoryBody,
  trajectoryExample,
  truingBody,
  truingExample,
} from '../compute/exterior-schema.ts'
import { interiorResponse, loadFileResponse } from '../compute/interior-response.ts'
import { runInterior } from '../compute/interior-run.ts'
import { interiorBody, interiorExample } from '../compute/interior-schema.ts'
import { loadFileExample } from '../compute/load-file-example.ts'
import { findBullet, findCartridge } from '../compute/resolve.ts'
import { loadFileBody, simulate, simulateQuery } from '../compute/simulate.ts'
import { stabilityQuery } from '../compute/stability-schema.ts'
import {
  rangeStringsFitBody,
  rangeStringsFitExample,
  rangeStringsPlanBody,
  rangeStringsPlanExample,
} from '../compute/strings-schema.ts'
import { API_PREFIX } from '../version.ts'
import type { ComputeContext } from './common.ts'
import { describeAnswers } from './identity.ts'

/**
 * Exterior trajectory and truing, interior simulation and Miller stability.
 * Registered without fastify-plugin, so the error handler applies to these routes only. Solver
 * calls run on `compute` (a worker pool), stability runs here (closed form).
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
  const options = <B extends z.ZodType>(
    body: B,
    doc: { response: z.ZodType; example: z.input<B>; summary: string; description: string },
  ) => ({
    bodyLimit: 256 * 1024,
    config: { body, errors, ...doc },
  })

  const trajectoryDoc = {
    response: trajectoryResponse,
    example: trajectoryExample,
    summary: 'Compute a trajectory',
    description:
      'Integrates the flight of a projectile from the muzzle (point mass, or modified point mass with yaw of repose and spin) and answers its state at each requested slant range: distance, height, windage, time, velocity, energy and the holds. The zero gives the elevation and windage angles of the bore. A `bullet` id takes mass, diameter, length and ballistic coefficients from the record.',
  }
  app.post('/exterior/trajectory', options(trajectoryBody, trajectoryDoc), (request) =>
    runTrajectory(exterior, trajectoryBody.parse(request.body)),
  )

  const truingDoc = {
    response: truingResponse,
    example: truingExample,
    summary: 'True a trajectory to observations',
    description:
      'Fits the muzzle velocity, or drag factors (constant or at Mach knots) with or without the muzzle velocity, to measured heights, elevation holds or velocities at known ranges, by least squares on log parameters. Answers the fitted parameters with their standard uncertainties and correlations, the residuals and the trued shot.',
  }
  app.post('/exterior/truing', options(truingBody, truingDoc), (request) =>
    runTruing(exterior, truingBody.parse(request.body)),
  )

  const planDoc = {
    response: rangeStringsPlanResponse,
    example: rangeStringsPlanExample,
    summary: 'Plan range strings',
    description:
      'Compares candidate range strings before any shot: for each candidate the identifiability status and expected standard uncertainty of muzzle velocity, drag factor, click value and zero offset, their variance inflation and the condition number of the design.',
  }
  app.post('/exterior/range-strings/plan', options(rangeStringsPlanBody, planDoc), (request) =>
    runRangeStringsPlan(exterior, rangeStringsPlanBody.parse(request.body)),
  )

  const fitDoc = {
    response: rangeStringsFitResponse,
    example: rangeStringsFitExample,
    summary: 'Fit range strings',
    description:
      'Fits muzzle velocity, drag factor, click value and optionally a zero offset to the mean impacts or dialled corrections of strings at known ranges and an optional chronograph string. Answers each parameter with its identifiability status, value and confidence interval, the residuals with their chi-square test and the condition of the fit.',
  }
  app.post('/exterior/range-strings/fit', options(rangeStringsFitBody, fitDoc), (request) =>
    runRangeStringsFit(exterior, rangeStringsFitBody.parse(request.body)),
  )

  const interiorDoc = {
    response: interiorResponse,
    example: interiorExample,
    summary: 'Simulate a shot in the barrel',
    description:
      'Runs the M3 lumped-parameter model of the shot from ignition to muzzle exit and answers the time curves of pressure, travel, velocity and burnt fraction, the peak pressure, muzzle velocity and energy, the pressure range from the tolerances, and warnings. A `ladder` runs one step per charge. A `cartridge` id adds its CIP Pmax limits. Results are simulations, not load data.',
  }
  app.post('/interior', options(interiorBody, interiorDoc), async (request, reply) => {
    const { status, payload } = await runInterior(
      { compute, findCartridge: (id) => findCartridge(catalogue, id) },
      interiorBody.parse(request.body),
    )
    return status === 200 ? payload : reply.code(status).send(payload)
  })

  app.post(
    '/interior/load-file',
    {
      bodyLimit: 1024 * 1024,
      config: {
        body: loadFileBody,
        query: simulateQuery,
        errors,
        response: loadFileResponse,
        example: loadFileExample,
        summary: 'Simulate a workbench load file',
        description:
          "Reads a load file saved by the workbench (a user data file with one load record), resolves its catalogue cartridge, bullet and powder references, runs the M3 model at its charge or over its charge ladder and answers a summary per step: peak pressure, muzzle velocity and energy, barrel time, load ratio and muzzle burnt fraction. The values the file does not type come from those records: the powder's model parameters, the bullet's mass and the cartridge's bore area. A value no record gives is listed, with every other such value, in one 422 (`reason` `missingValues`, `missing`: key, path in the file, quantity); a download from the workbench for the API holds them all. Results are simulations, not load data.",
      },
    },
    async (request, reply) => {
      const { status, payload } = await simulate(
        { catalogue, compute },
        request.query,
        request.body,
      )
      return status === 200 ? payload : reply.code(status).send(payload)
    },
  )

  // on the main thread: no 503
  const stabilityOptions = {
    config: {
      query: stabilityQuery,
      errors: [404, 422],
      response: stabilityResponse,
      summary: 'Gyroscopic stability',
      description:
        'The gyroscopic stability factor of a bullet by the Miller twist rule from mass, diameter, length, twist and muzzle velocity, corrected for air temperature and pressure. A `bullet` id supplies the values the query leaves out.',
    },
  }
  app.get('/exterior/stability', stabilityOptions, (request) =>
    runStability(exterior, stabilityQuery.parse(request.query)),
  )
}
