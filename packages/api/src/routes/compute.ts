import { InputError, icao, millerStability } from '@open-reloading/core'
import type { Bullet } from '@open-reloading/schema'
import { userDataFile } from '@open-reloading/schema'
import type { FastifyError, FastifyPluginAsync } from 'fastify'
import type { z } from 'zod'
import { assertFinite, computeErrorHandler, resolvedRecord } from '../compute/answer.ts'
import {
  rangeStringsFitResponse,
  rangeStringsPlanResponse,
  stabilityResponse,
  trajectoryResponse,
  truingResponse,
} from '../compute/exterior-response.ts'
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
import { bulletProjectile, bulletSi, findBullet, findCartridge } from '../compute/resolve.ts'
import { caps } from '../compute/schemas.ts'
import { simulate, simulateQuery } from '../compute/simulate.ts'
import { stabilityBounds, stabilityQuery } from '../compute/stability-schema.ts'
import {
  rangeStringsFitBody,
  rangeStringsFitExample,
  rangeStringsPlanBody,
  rangeStringsPlanExample,
} from '../compute/strings-schema.ts'
import { responseUnits } from '../compute/units.ts'
import { API_PREFIX } from '../version.ts'
import type { ComputeContext } from './common.ts'

/** Result paths where core can return NaN; JSON writes null. */
const nanPaths = {
  spinDrift: /^\.result\.points\.\d+\.spinDrift$/,
  truing: /^\.result\.(parameters\.\d+\.standardUncertainty|correlation\.\d+\.\d+)$/,
}

/**
 * Result paths of the range strings routes where a singular design gives an infinite number:
 * the standard uncertainties, variance inflation and condition number of a parameter in
 * the null direction. The correlations stay finite.
 */
const stringParameter = String.raw`parameters\.\d+\.(relativeStandardUncertainty|varianceInflation|standardUncertainty|posteriorSigma|prior\.ratio)`
const infinitePaths = {
  plan: new RegExp(String.raw`^\.result\.\d+\.plan\.(conditionNumber|${stringParameter})$`),
  fit: new RegExp(String.raw`^\.result\.(conditionNumber|${stringParameter})$`),
}

/**
 * Mass, diameter and length of a stability query, the missing ones from the bullet `record`, each
 * checked against `stabilityBounds`, with the record's `resolved.bullet` part.
 */
function stabilityInputs(q: z.infer<typeof stabilityQuery>, record: Bullet | undefined) {
  let { mass, diameter, length } = q
  let resolved: { bullet: ReturnType<typeof resolvedRecord> } | undefined
  if (record) {
    const si = bulletSi(record)
    const fields = [
      ...(mass === undefined ? ['mass'] : []),
      ...(diameter === undefined ? ['diameter'] : []),
      ...(length === undefined && si.length !== undefined ? ['length'] : []),
    ]
    mass ??= si.mass
    diameter ??= si.diameter
    length ??= si.length
    resolved = { bullet: resolvedRecord(record, fields) }
  }
  if (mass === undefined || diameter === undefined || length === undefined)
    throw new InputError(`bullet ${q.bullet} has no length`)
  // request values have passed these bounds already; record values have not
  for (const [key, value] of Object.entries({ mass, diameter, length })) {
    const [lo, hi] = stabilityBounds[key as 'mass' | 'diameter' | 'length']
    const unit = key === 'mass' ? 'kg' : 'm'
    if (!(value >= lo && value <= hi))
      throw new InputError(
        `bullet ${q.bullet} ${key} ${value} ${unit} must be within ${lo} and ${hi} ${unit}`,
      )
  }
  return { mass, diameter, length, resolved }
}

/** The body of `POST /interior/load-file` as the document shows it. The route reads it with `readLoadFile`. */
const loadFileBody = userDataFile
  .extend({
    records: userDataFile.shape.records.describe(
      'The records of the file. Exactly one is a workbench load (`kind` `workbenchState`), its `data.siValues` in SI units by workbench field key.',
    ),
    files: userDataFile.shape.files.describe('Photos of target sheets, base64. Not read here.'),
  })
  .describe('A load file saved by the workbench.')

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

  async function resolveShot<S extends z.infer<typeof trajectoryBody>['shot']>(shot: S) {
    const p = shot.projectile
    if (!('bullet' in p)) return { shot: { ...shot, projectile: p }, resolved: undefined }
    const { projectile, bullet: echoed } = bulletProjectile(
      await findBullet(catalogue, p.bullet),
      p,
    )
    return { shot: { ...shot, projectile }, resolved: { bullet: echoed, projectile } }
  }

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
  app.post('/exterior/trajectory', options(trajectoryBody, trajectoryDoc), async (request) => {
    const body = trajectoryBody.parse(request.body)
    const { shot, resolved } = await resolveShot(body.shot)
    const result = await compute.run({
      kind: 'trajectory',
      args: [shot, body.ranges, { maxSteps: caps.trajectorySteps, ...body.options }],
    })
    const mpm = body.options?.model === 'modified-point-mass'
    return assertFinite(
      { units: responseUnits.exterior, result, resolved },
      mpm ? nanPaths.spinDrift : undefined,
    )
  })

  const truingDoc = {
    response: truingResponse,
    example: truingExample,
    summary: 'True a trajectory to observations',
    description:
      'Fits the muzzle velocity, or drag factors (constant or at Mach knots) with or without the muzzle velocity, to measured heights, elevation holds or velocities at known ranges, by least squares on log parameters. Answers the fitted parameters with their standard uncertainties and correlations, the residuals and the trued shot.',
  }
  app.post('/exterior/truing', options(truingBody, truingDoc), async (request) => {
    const body = truingBody.parse(request.body)
    const { shot, resolved } = await resolveShot(body.shot)
    const o = {
      maxSteps: caps.truingSteps,
      maxIterations: caps.truingIterations,
      maxTotalSteps: caps.truingTotalSteps,
      ...body.options,
    }
    const fit = body.fit
    const result =
      fit.kind === 'muzzleVelocity'
        ? await compute.run({ kind: 'truingMuzzleVelocity', args: [shot, body.observations, o] })
        : await compute.run({
            kind: 'truingDrag',
            args: [
              shot,
              body.observations,
              { knots: fit.knots, fitMuzzleVelocity: fit.fitMuzzleVelocity },
              o,
            ],
          })
    return assertFinite({ units: responseUnits.truing, result, resolved }, nanPaths.truing)
  })

  /** Core options of a strings request: the API's defaults and the caps under the request's values. */
  const stringsOptions = (o: z.infer<typeof rangeStringsFitBody>['options']) => {
    const { trajectoryOptions, ...rest } = o ?? {}
    return {
      maxIterations: caps.truingIterations,
      ...rest,
      trajectoryOptions: { maxSteps: caps.truingSteps, ...trajectoryOptions },
    }
  }

  const planDoc = {
    response: rangeStringsPlanResponse,
    example: rangeStringsPlanExample,
    summary: 'Plan range strings',
    description:
      'Compares candidate range strings before any shot: for each candidate the identifiability status and expected standard uncertainty of muzzle velocity, drag factor, click value and zero offset, their variance inflation and the condition number of the design.',
  }
  app.post(
    '/exterior/range-strings/plan',
    options(rangeStringsPlanBody, planDoc),
    async (request) => {
      const body = rangeStringsPlanBody.parse(request.body)
      const { shot, resolved } = await resolveShot(body.shot)
      const { candidates, clickValue, dispersion } = body
      const result = await compute.run({
        kind: 'rangeStringsPlan',
        args: [{ shot, clickValue, dispersion }, candidates, stringsOptions(body.options)],
      })
      return assertFinite(
        { units: responseUnits.rangeStrings, result, resolved },
        infinitePaths.plan,
        true,
      )
    },
  )

  const fitDoc = {
    response: rangeStringsFitResponse,
    example: rangeStringsFitExample,
    summary: 'Fit range strings',
    description:
      'Fits muzzle velocity, drag factor, click value and optionally a zero offset to the mean impacts or dialled corrections of strings at known ranges and an optional chronograph string. Answers each parameter with its identifiability status, value and confidence interval, the residuals with their chi-square test and the condition of the fit.',
  }
  app.post('/exterior/range-strings/fit', options(rangeStringsFitBody, fitDoc), async (request) => {
    const body = rangeStringsFitBody.parse(request.body)
    const { shot, resolved } = await resolveShot(body.shot)
    const { clickValue, entries, chronograph } = body
    const result = await compute.run({
      kind: 'rangeStringsFit',
      args: [{ shot, clickValue, entries, chronograph }, stringsOptions(body.options)],
    })
    return assertFinite(
      { units: responseUnits.rangeStrings, result, resolved },
      infinitePaths.fit,
      true,
    )
  })

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
          'Reads a load file saved by the workbench (a user data file with one workbench record), resolves its cartridge, bullet and powder ids, runs the M3 model at its charge or over its charge ladder and answers a summary per step: peak pressure, muzzle velocity and energy, barrel time, load ratio and muzzle burnt fraction. Results are simulations, not load data.',
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
  app.get('/exterior/stability', stabilityOptions, async (request) => {
    const q = stabilityQuery.parse(request.query)
    const record = q.bullet === undefined ? undefined : await findBullet(catalogue, q.bullet)
    const { mass, diameter, length, resolved } = stabilityInputs(q, record)
    const result = millerStability({
      mass,
      diameter,
      length,
      twist: q.twist,
      velocity: q.muzzleVelocity,
      air: {
        altitude: 0,
        pressure: q.pressure ?? icao.pressure,
        temperature: q.temperature ?? icao.temperature,
        humidity: 0,
      },
    })
    return assertFinite({ units: responseUnits.stability, method: 'miller', result, resolved })
  })
}
