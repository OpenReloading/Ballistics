/**
 * Parts shared by the request schemas of the compute endpoints (`exterior-schema.ts`,
 * `strings-schema.ts`, `interior-schema.ts`, `charge-schema.ts`, `stability-schema.ts`) and the
 * step caps. Field names and units are those of the `@open-reloading/core` inputs (SI, rad, K). Objects are strict, so a misspelled key is an error instead of
 * being ignored. zod 4 `z.number()` rejects Infinity and NaN.
 */
import { recordIdRegex } from '@open-reloading/schema'
import { z } from 'zod'

/** A record id in a request body or query, at most 200 characters. */
export const recordId = z.string().max(200).regex(recordIdRegex)

/**
 * Step caps per integration (a trajectory runs at most 33 integrations), the truing iteration cap
 * and the truing step total over all its trajectories; the API passes each as the default.
 * `ladderSteps` caps the steps of an interior charge ladder, each one compute task.
 */
export interface StepCaps {
  trajectorySteps: 5000
  truingSteps: 1000
  truingIterations: 20
  truingTotalSteps: 200000
  interiorSteps: 50000
  /** `maxSteps` of `POST /interior/charge-target`: at most 152 runs in one task, so 152 x this x 2.4 us is under the 5 s deadline. */
  chargeSteps: 10000
  ladderSteps: 21
}

/** The values of {@link StepCaps}. */
export const caps: Readonly<StepCaps> = {
  trajectorySteps: 5000,
  truingSteps: 1000,
  truingIterations: 20,
  truingTotalSteps: 200000,
  interiorSteps: 50000,
  chargeSteps: 10000,
  ladderSteps: 21,
}

/** The iteration cap of a truing fit, optional, from 1 to `caps.truingIterations`. */
export const fitIterations = z
  .number()
  .int()
  .min(1)
  .max(caps.truingIterations)
  .optional()
  .describe(
    `Iterations of the least-squares fit, accepted plus rejected, before it fails, default ${caps.truingIterations}.`,
  )

/** An optional integer step count from 1 to `max`. */
export const steps = (max: number) => z.number().int().min(1).max(max).optional()
