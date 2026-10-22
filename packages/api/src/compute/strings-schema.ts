import { z } from 'zod'
import { exteriorOptions, shot, trajectoryExample } from './exterior-schema.ts'
import { caps, fitIterations, steps } from './schemas.ts'

/** Most entries of one candidate or fit, candidates of one plan. */
export const rangeStringsLimits = { entries: 20, candidates: 10 } as const

const stringsEntryBase = {
  kind: z
    .enum(['impact', 'dial'])
    .describe(
      'impact: height of the mean impact above the line of sight at the zero setting, m. dial: clicks dialled from the zero setting to centre the group, signed up.',
    ),
  range: z.number().positive().max(1e5).describe('Slant range, m.'),
  shotCount: z
    .number()
    .int()
    .min(1)
    .max(10000)
    .describe('Number of shots behind the mean, dimensionless.'),
  rounding: z
    .number()
    .min(0)
    .max(1e5)
    .optional()
    .describe(
      'Step of the reading in the unit of the kind, default 1 click for dial and 0 for impact.',
    ),
  group: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe(
      'Name of the group of shots behind the entry, default the distance. An impact and a dial entry of one group are rejected.',
    ),
}
const stringsChronograph = {
  instrumentDistance: z
    .number()
    .min(0)
    .max(1e5)
    .optional()
    .describe('Distance from the muzzle to the instrument, m, default 0.'),
  shotCount: z.number().int().min(1).max(10000).describe('Number of readings, dimensionless.'),
  standardDeviation: z
    .number()
    .positive()
    .max(1e4)
    .describe('Standard deviation of one reading, m/s.'),
  rounding: z.number().min(0).max(1e4).optional().describe('Step of the reading, m/s, default 0.'),
}
const stringsOptions = z
  .strictObject({
    trajectoryOptions: z
      .strictObject({
        ...exteriorOptions.shape,
        maxSteps: steps(caps.truingSteps).describe(
          `Accepted plus rejected integrator steps per integration before the run fails, default ${caps.truingSteps}.`,
        ),
      })
      .optional()
      .describe('Options of every trajectory of the fit.'),
    fitZeroOffset: z
      .boolean()
      .optional()
      .describe('Fit the zero offset as a fourth parameter, default false.'),
    priors: z
      .strictObject({
        muzzleVelocity: z
          .number()
          .positive()
          .max(10)
          .optional()
          .describe(
            'Standard deviation of the log of muzzle velocity over its nominal value, dimensionless.',
          ),
        dragFactor: z
          .number()
          .positive()
          .max(10)
          .optional()
          .describe('Standard deviation of the log of the drag factor, dimensionless.'),
        clickValue: z
          .number()
          .positive()
          .max(10)
          .optional()
          .describe(
            'Standard deviation of the log of click value over its nominal value, dimensionless.',
          ),
        zeroOffset: z
          .number()
          .positive()
          .max(1)
          .optional()
          .describe('Standard deviation of the zero offset, rad. It needs fitZeroOffset.'),
      })
      .optional()
      .describe('Gaussian priors centred on the nominal parameter values, default none.'),
    maxIterations: fitIterations,
    maxCondition: z
      .number()
      .min(1)
      .max(1e6)
      .optional()
      .describe(
        'Largest condition number of the fit, dimensionless, default 1e3. Parameters beyond it are held.',
      ),
    confidenceLevel: z
      .number()
      .gt(0)
      .lt(1)
      .optional()
      .describe('Two-sided confidence level of the intervals, ratio, default 0.95.'),
    maxInflation: z
      .number()
      .min(1)
      .max(1e6)
      .optional()
      .describe(
        'Variance inflation above which a parameter is weakly identified, dimensionless, default 10.',
      ),
    maxRelativeStandardUncertainty: z
      .number()
      .positive()
      .max(10)
      .optional()
      .describe(
        'Standard error of the log of a parameter above which it is weakly identified, dimensionless, default 0.05.',
      ),
    maxZeroSigma: z
      .number()
      .positive()
      .max(1)
      .optional()
      .describe(
        'Standard error of the zero offset above which it is weakly identified, rad, default 1e-4.',
      ),
    residualConfidenceLevel: z
      .number()
      .gt(0)
      .lt(1)
      .optional()
      .describe('Level of the chi-square test of the residuals, ratio, default 0.99.'),
    scaleByResidual: z
      .boolean()
      .optional()
      .describe(
        "Scale the intervals by the residual and use Student's t, for spreads that are not known, default false.",
      ),
  })
  .refine((o) => o.priors?.zeroOffset === undefined || o.fitZeroOffset === true, {
    message: 'a zeroOffset prior needs the fitZeroOffset option',
    path: ['priors', 'zeroOffset'],
  })
  .describe('Solver settings and identification thresholds.')

const clickValue = z
  .number()
  .positive()
  .max(1)
  .describe('Nominal click value of the sight, rad per click.')

/**
 * Body of `POST /exterior/range-strings/plan`: SI, rad.
 * Request type: {@link RangeStringsPlanRequest}.
 */
export const rangeStringsPlanBody = z
  .strictObject({
    shot,
    clickValue,
    dispersion: z
      .number()
      .positive()
      .max(1)
      .describe("Standard deviation of one shot's vertical angle, rad."),
    candidates: z
      .array(
        z.strictObject({
          name: z.string().max(100).optional().describe('Label returned with the result.'),
          entries: z
            .array(z.strictObject(stringsEntryBase))
            .max(rangeStringsLimits.entries)
            .describe('Planned distances. A candidate needs at least one entry or a chronograph.'),
          chronograph: z
            .strictObject(stringsChronograph)
            .optional()
            .describe('Planned muzzle velocity readings.'),
        }),
      )
      .min(1)
      .max(rangeStringsLimits.candidates)
      .describe('Candidate range strings to compare.'),
    options: stringsOptions.optional(),
  })
  .describe('A nominal shot and candidate range strings to plan. Units SI, rad.')

/**
 * Body of `POST /exterior/range-strings/fit`: SI, rad.
 * Request type: {@link RangeStringsFitRequest}.
 */
export const rangeStringsFitBody = z
  .strictObject({
    shot,
    clickValue,
    entries: z
      .array(
        z.strictObject({
          ...stringsEntryBase,
          value: z
            .number()
            .min(-1e5)
            .max(1e5)
            .describe('Mean over the shots: m for impact, clicks for dial.'),
          standardDeviation: z
            .number()
            .positive()
            .max(1e5)
            .describe('Standard deviation of one shot in the unit of value.'),
        }),
      )
      .max(rangeStringsLimits.entries)
      .describe('Measured distances. The fit needs at least one entry or a chronograph.'),
    chronograph: z
      .strictObject({
        ...stringsChronograph,
        mean: z.number().positive().max(1e4).describe('Mean muzzle velocity of the readings, m/s.'),
      })
      .optional()
      .describe('Measured muzzle velocity readings.'),
    options: stringsOptions.optional(),
  })
  .describe('A nominal shot and measured range strings to fit. Units SI, rad.')

/** A body of `POST /exterior/range-strings/plan` as a client sends it, before defaults. */
export interface RangeStringsPlanRequest extends z.input<typeof rangeStringsPlanBody> {}

/** A valid body of `POST /exterior/range-strings/plan`. */
export const rangeStringsPlanExample: RangeStringsPlanRequest = {
  shot: trajectoryExample.shot,
  clickValue: 0.1e-3,
  dispersion: 0.2e-3,
  candidates: [
    { name: 'one', entries: [{ kind: 'impact', range: 300, shotCount: 5 }] },
    {
      name: 'three',
      entries: [
        { kind: 'impact', range: 300, shotCount: 5 },
        { kind: 'impact', range: 600, shotCount: 5 },
        { kind: 'impact', range: 900, shotCount: 5 },
      ],
      chronograph: { shotCount: 10, standardDeviation: 4 },
    },
  ],
}

/** A body of `POST /exterior/range-strings/fit` as a client sends it, before defaults. */
export interface RangeStringsFitRequest extends z.input<typeof rangeStringsFitBody> {}

/** A valid body of `POST /exterior/range-strings/fit`. */
export const rangeStringsFitExample: RangeStringsFitRequest = {
  shot: trajectoryExample.shot,
  clickValue: 0.1e-3,
  entries: [
    { kind: 'impact', range: 300, value: -0.4257, shotCount: 5, standardDeviation: 0.06 },
    { kind: 'impact', range: 600, value: -3.136, shotCount: 5, standardDeviation: 0.12 },
    { kind: 'impact', range: 900, value: -9.9613, shotCount: 5, standardDeviation: 0.18 },
  ],
  chronograph: { mean: 800, shotCount: 10, standardDeviation: 4 },
  options: { fitZeroOffset: true },
}
