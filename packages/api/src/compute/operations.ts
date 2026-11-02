/**
 * The compute operations of the `POST` routes. The routes and the contract document read their
 * texts, schemas and examples here, the command line runs them offline, so none can drift.
 */
import type { z } from 'zod'
import type { Catalogue } from '../catalogue/types.ts'
import { runChargeTarget } from './charge-run.ts'
import { chargeBody, chargeTargetExample } from './charge-schema.ts'
import {
  rangeStringsFitResponse,
  rangeStringsPlanResponse,
  trajectoryResponse,
  truingResponse,
} from './exterior-response.ts'
import {
  type ExteriorContext,
  runRangeStringsFit,
  runRangeStringsPlan,
  runTrajectory,
  runTruing,
} from './exterior-run.ts'
import { trajectoryBody, trajectoryExample, truingBody, truingExample } from './exterior-schema.ts'
import { chargeTargetResponse, interiorResponse, loadFileResponse } from './interior-response.ts'
import { runInterior } from './interior-run.ts'
import { interiorBody, interiorExample } from './interior-schema.ts'
import { loadFileExample } from './load-file-example.ts'
import { findBullet, findCartridge, findPowder } from './resolve.ts'
import { loadFileBody, simulate } from './simulate.ts'
import {
  rangeStringsFitBody,
  rangeStringsFitExample,
  rangeStringsPlanBody,
  rangeStringsPlanExample,
} from './strings-schema.ts'
import type { ComputeRunner } from './tasks.ts'

/** What an operation runs on: the records and the compute runner. */
export interface OperationContext {
  catalogue: Catalogue
  compute: ComputeRunner
}

/** The status and body of an operation's answer. */
export interface OperationAnswer {
  status: number
  payload: unknown
}

/** One compute operation: the route `POST /v1/<name>`. */
export interface Operation {
  /** The route path without the version, for example `interior/charge-target`. */
  name: string
  /** One line on what it answers. */
  summary: string
  /** What it reads and computes. */
  description: string
  /** The zod schema of the body. */
  body: z.ZodType
  /** The zod schema of the 200 answer. */
  response: z.ZodType
  /** A valid body. */
  example: unknown
  /** Options of `errorAnswer` for the errors the run throws. */
  errors: { withNotice: boolean; truingDetails: boolean }
  /** Validates `body` (a `ZodError` when it does not match) and runs it. */
  run: (context: OperationContext, body: unknown) => Promise<OperationAnswer>
}

const exterior = ({ catalogue, compute }: OperationContext): ExteriorContext => ({
  compute,
  findBullet: (id) => findBullet(catalogue, id),
})

const exteriorErrors = { withNotice: false, truingDetails: true }

/** `POST /interior/charge-target`, in a route plugin of its own. */
export const chargeTarget: Operation = {
  name: 'interior/charge-target',
  summary: 'Solve the charge for a target',
  description:
    'Searches the charge at which an M3 run reaches a target peak pressure (Pa or a percentage of the cartridge CIP Pmax), muzzle velocity, load ratio, barrel time or bullet lead time. Answers the charge, the value reached, the run at that charge without curves, its pressure range, limits and warnings. A target outside the reachable values answers 422 with the reachable range. Results are simulations, not load data.',
  body: chargeBody,
  response: chargeTargetResponse,
  example: chargeTargetExample,
  errors: { withNotice: true, truingDetails: false },
  run: ({ catalogue, compute }, body) =>
    runChargeTarget(
      {
        compute,
        findCartridge: (id) => findCartridge(catalogue, id),
        findPowder: (id) => findPowder(catalogue, id),
      },
      chargeBody.parse(body),
    ),
}

/** The compute operations, in the order of the contract document. */
export const operations: readonly Operation[] = [
  {
    name: 'exterior/trajectory',
    summary: 'Compute a trajectory',
    description:
      'Integrates the flight of a projectile from the muzzle (point mass, or modified point mass with yaw of repose and spin) and answers its state at each requested slant range: distance, height, windage, time, velocity, energy and holds. The zero gives the bore angles. A `bullet` id supplies mass, diameter, length and ballistic coefficients.',
    body: trajectoryBody,
    response: trajectoryResponse,
    example: trajectoryExample,
    errors: exteriorErrors,
    run: async (context, body) => ({
      status: 200,
      payload: await runTrajectory(exterior(context), trajectoryBody.parse(body)),
    }),
  },
  {
    name: 'exterior/truing',
    summary: 'True a trajectory to observations',
    description:
      'Fits the muzzle velocity, or drag factors (constant or at Mach knots) with or without the muzzle velocity, to measured heights, elevation holds or velocities at known ranges, by least squares on log parameters. Answers the fitted parameters with standard uncertainties and correlations, the residuals and the trued shot.',
    body: truingBody,
    response: truingResponse,
    example: truingExample,
    errors: exteriorErrors,
    run: async (context, body) => ({
      status: 200,
      payload: await runTruing(exterior(context), truingBody.parse(body)),
    }),
  },
  {
    name: 'exterior/range-strings/plan',
    summary: 'Plan range strings',
    description:
      'Compares candidate range strings before any shot: per candidate the identifiability status, expected standard uncertainty and variance inflation of muzzle velocity, drag factor, click value and zero offset, and the condition number of the design.',
    body: rangeStringsPlanBody,
    response: rangeStringsPlanResponse,
    example: rangeStringsPlanExample,
    errors: exteriorErrors,
    run: async (context, body) => ({
      status: 200,
      payload: await runRangeStringsPlan(exterior(context), rangeStringsPlanBody.parse(body)),
    }),
  },
  {
    name: 'exterior/range-strings/fit',
    summary: 'Fit range strings',
    description:
      'Fits muzzle velocity, drag factor, click value and optionally a zero offset to the mean impacts or dialled corrections of strings at known ranges and an optional chronograph string. Answers each parameter with identifiability status, value and confidence interval, the residuals with their chi-square test and the condition of the fit.',
    body: rangeStringsFitBody,
    response: rangeStringsFitResponse,
    example: rangeStringsFitExample,
    errors: exteriorErrors,
    run: async (context, body) => ({
      status: 200,
      payload: await runRangeStringsFit(exterior(context), rangeStringsFitBody.parse(body)),
    }),
  },
  {
    name: 'interior',
    summary: 'Simulate a shot in the barrel',
    description:
      'Runs the M3 lumped-parameter model of the shot from ignition to muzzle exit and answers the time curves of pressure, travel, velocity and burnt fraction, the peak pressure, muzzle velocity and energy, the pressure range from the tolerances, and warnings. A `ladder` runs one step per charge. A `cartridge` id adds its CIP Pmax limits. Results are simulations, not load data.',
    body: interiorBody,
    response: interiorResponse,
    example: interiorExample,
    errors: { withNotice: true, truingDetails: true },
    run: ({ catalogue, compute }, body) =>
      runInterior(
        { compute, findCartridge: (id) => findCartridge(catalogue, id) },
        interiorBody.parse(body),
      ),
  },
  {
    name: 'interior/load-file',
    summary: 'Simulate a workbench load file',
    description:
      "Reads a load file saved by the workbench (a user data file with one load record), resolves its catalogue cartridge, bullet and powder references, runs the M3 model at its charge or over its charge ladder and answers a summary per step: peak pressure, muzzle velocity and energy, barrel time, load ratio and muzzle burnt fraction. Values the file does not type come from those records: the powder's model parameters, the bullet's mass and the cartridge's bore area. Every value no record gives is listed in one 422 (`reason` `missingValues`, `missing`: key, path in the file, quantity); a workbench download for the API holds them all. Results are simulations, not load data.",
    body: loadFileBody,
    response: loadFileResponse,
    example: loadFileExample,
    errors: { withNotice: true, truingDetails: true },
    // the query string of the route is not part of the body: the answer has no curves
    run: (context, body) => simulate(context, {}, body),
  },
  chargeTarget,
]
/** The operation `name`; undefined for an unknown name. */
export const operation = (name: string): Operation | undefined =>
  operations.find((o) => o.name === name)
