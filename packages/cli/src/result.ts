import { z } from 'zod'
import { reasons } from './evaluate.ts'
import { notFittedReasons } from './fit.ts'
import { groupings } from './metrics.ts'
import { skipReasons } from './published-rows.ts'
import { splits } from './split.ts'

/** Version of the JSON shape every result carries as `schemaVersion`. */
export const schemaVersion = 1

const count = z.int().nonnegative()
const fraction = z.number().describe('A fraction: 0.034 is 3.4 %.')
const errorStats = z.object({
  median: fraction.describe('Median of the absolute relative error, as a fraction.'),
  p90: fraction.describe('90th percentile of the absolute relative error, as a fraction.'),
})

/** The metrics of one group of rows: all rows of the split, one powder or one powder family. */
const metrics = z.object({
  rows: z.object({
    inSplit: count.describe('Rows of the split in this group.'),
    used: count.describe('Rows the model gave a result for.'),
    notUsed: z
      .partialRecord(z.enum(reasons), count)
      .describe('Rows not used, by reason; a reason without rows is left out.'),
  }),
  velocity: errorStats
    .nullable()
    .describe(
      'Absolute relative error of the muzzle velocity over the used rows; null without one.',
    ),
  pressure: errorStats
    .extend({ rows: count.describe('Used rows that print a peak pressure.') })
    .nullable()
    .describe(
      'Absolute relative error of the peak pressure over the used rows that print one in bar, every basis together.',
    ),
  pressureByBasis: z
    .record(z.string(), errorStats.extend({ rows: count }))
    .describe(
      'The pressure error per basis, the measuring method a row prints (`transducer`, `case-contact`, `piezo`, ..., `unstated` without one); a basis is never compared with another. A basis without a used row in bar is left out.',
    ),
  interval: z
    .object({
      coverage: fraction.describe(
        'Share of the used rows whose printed velocity is inside the interval.',
      ),
    })
    .nullable()
    .describe('Coverage of the 90 % interval; null without rows or without an interval.'),
})

/** Metrics of one group. */
export type Metrics = z.infer<typeof metrics>

const evaluation = z.object({
  model: z.string().describe('The name or module path the model was selected by.'),
  modelVersion: z
    .string()
    .describe('SHA-256 over the model sources, the records the rows name and the rows bytes.'),
  interval: z.object({
    basis: z.literal('training'),
    halfWidth: z
      .number()
      .nullable()
      .describe(
        'The 90th percentile of the absolute relative velocity error on the training split: the interval is the model velocity times (1 +/- this). Null without a training row.',
      ),
    trainingRows: count.describe('Used training rows the half width comes from.'),
  }),
  overall: metrics,
  byFamily: z
    .record(z.string(), metrics)
    .describe('By powder family, `<propellant base>/<grain form>` of the powder record.'),
  byPowder: z.record(z.string(), metrics).describe('By powder id.'),
  grouped: z
    .object({
      by: z.enum(groupings),
      groups: z.record(z.string(), metrics),
    })
    .optional()
    .describe('The groups of `--group-by`: the key by which the rows are grouped and the groups.'),
  notInFittedSet: metrics
    .extend({ powders: count.describe('Powders left out, one at a time, each without a value.') })
    .optional()
    .describe(
      'Powder not in the fitted set, with `--leave-one-powder-out`: the rows of each powder that has interior parameters, run without them. A powder without rows has no value, so its rows count as `noPowderModel` (a row with an unknown cartridge or bullet as `unknownCartridge` or `unknownBullet`, which are checked first) and the errors and the coverage are null.',
    ),
  fit: z
    .object({
      velocitySigma: fraction.describe('Velocity sigma of the fit, a fraction of the velocity.'),
      powders: count.describe('Powders fitted.'),
      notFitted: z
        .partialRecord(z.enum(notFittedReasons), count)
        .describe('Powders not fitted, by reason; a reason without powders is left out.'),
      exponent: z
        .object({
          pooled: z.number().describe('The exponent all powders pooled choose.'),
          families: z
            .record(z.string(), z.number())
            .describe('By powder family, the exponent it chose.'),
        })
        .optional()
        .describe('With `--exponent family`: the pressure exponents of the fit.'),
    })
    .optional()
    .describe(
      'With `--params fit-on-training`: the burn coefficients were fitted to the training rows; a powder not fitted has no value, so its rows count as `noPowderModel`.',
    ),
})

/** What one model gave on one split. */
export type Evaluation = z.infer<typeof evaluation>

const inputs = z.object({
  rows: z.string().describe('SHA-256 over the SHA-256 of each rows file.'),
  records: z.string().describe('SHA-256 over the records the rows name.'),
})
/** The label every result carries, the notice of the API's answers. */
export const notice = 'simulation, not load data'

const published = z
  .object({
    files: count.describe('Published load files read.'),
    rows: count.describe('Rows they gave: one per printed charge with a velocity.'),
    skipped: z
      .partialRecord(z.enum(skipReasons), count)
      .describe(
        'Printed charges that gave no row, by reason; a reason without charges is left out.',
      ),
  })
  .optional()
  .describe('With `--rows catalogue` or a folder of published loads: what the files gave.')

const common = {
  schemaVersion: z.literal(schemaVersion),
  notice: z.literal(notice),
  split: z.enum(splits),
  final: z.boolean().describe('True for a run of the test split, which needs `--final`.'),
  inputs,
  published,
}

/** The result of `verify`. */
export const verifyResult = z.object({
  ...common,
  command: z.literal('verify'),
  ...evaluation.shape,
})

/** The result of `verify`. */
export type VerifyResult = z.infer<typeof verifyResult>

const delta = z
  .number()
  .nullable()
  .describe('Candidate minus baseline; null where either has none.')
const change = z.object({
  usedRows: z.number().describe('Candidate minus baseline used rows.'),
  velocityMedian: delta,
  velocityP90: delta,
  pressureMedian: delta,
  pressureP90: delta,
  intervalCoverage: delta,
})

/** The change of each metric from the baseline to the candidate. */
export type Change = z.infer<typeof change>

const compareResult = z.object({
  ...common,
  command: z.literal('compare'),
  baseline: evaluation,
  candidate: evaluation,
  change: z.object({
    overall: change,
    byFamily: z.record(z.string(), change),
    grouped: z.record(z.string(), change).optional().describe('Per group of `--group-by`.'),
  }),
})

/** The result of `compare`. */
export type CompareResult = z.infer<typeof compareResult>

const fitResult = z.object({
  schemaVersion: z.literal(schemaVersion),
  notice: z.literal(notice),
  command: z.literal('fit'),
  inputs,
  published,
  model: z.string().describe('The name or module path the model was selected by.'),
  modelVersion: z
    .string()
    .describe(
      'SHA-256 over the model and fit sources, the params line, the records the rows name and the rows bytes.',
    ),
  split: z.literal('training').describe('The split whose rows the fit reads.'),
  velocitySigma: fraction.describe('Velocity sigma of each row, a fraction of its velocity.'),
  exponent: z
    .object({
      grid: z.array(z.number()).describe('The exponents chosen from.'),
      shrinkage: z.number().describe("Weight of the pooled term in a family's choice, in powders."),
      pooled: z
        .number()
        .describe('The exponent of least mean chi square over all powders that entered.'),
      families: z
        .record(
          z.string(),
          z.object({
            exponent: z
              .number()
              .describe(
                "The exponent of least sum of its powders' chi squares plus `shrinkage` times the mean over all powders.",
              ),
            powders: count.describe('Its powders that entered the sum.'),
          }),
        )
        .describe(
          'By powder family, `<propellant base>/<grain form>` of the powder record. A powder enters the sums when it was fitted at every exponent of the grid.',
        ),
    })
    .optional()
    .describe(
      'With `--exponent family`: the pressure exponent each powder family chose; each powder is fitted at the exponent of its family.',
    ),
  powders: z
    .record(
      z.string(),
      z.object({
        vivacity: z
          .object({
            value: z.number().describe('Fitted burn coefficient, in the unit of the record.'),
            standardUncertainty: z
              .number()
              .describe(
                'Of the fit, scaled by the root of the chi square per degree of freedom where that is above 1.',
              ),
          })
          .describe('The record burn coefficient times `factor`.'),
        factor: z
          .number()
          .describe(
            'Fitted over record burn coefficient; with another exponent than the record it also holds the change of the meaning of the coefficient.',
          ),
        rows: count.describe('Used training rows of the powder.'),
        cartridges: count.describe('Their distinct cartridges.'),
        chiSquarePerDegree: z
          .number()
          .nullable()
          .describe(
            'Chi square of every row, data and the prior rows of the rifle and lot effects, over all rows minus all parameters; null where that count is not above 0.',
          ),
        iterations: count.describe('Iterations of the solver.'),
        pressureExponent: z
          .number()
          .optional()
          .describe(
            'With `--exponent family`: the exponent of its family, the value fitted at it.',
          ),
      }),
    )
    .describe('By powder id: each powder fitted on its own.'),
  notFitted: z
    .record(z.string(), z.enum(notFittedReasons))
    .describe(
      'By powder id, why a powder with interior parameters that the rows name got no value: the reason of the fit (with `--exponent family`, of the fit at the exponent of its family), or `noUsableRow` without a used training row.',
    ),
})

/** The result of `fit`. */
export type FitResult = z.infer<typeof fitResult>

/** The JSON shape of every result. */
export const result = z.discriminatedUnion('command', [verifyResult, compareResult, fitResult])
