import { z } from 'zod'
import { reasons } from './evaluate.ts'
import { groupings } from './metrics.ts'
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
    .describe('Absolute relative error of the peak pressure over the used rows that print one.'),
  interval: z
    .object({ coverage: fraction.describe('Share of the used rows inside the interval.') })
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
        'The 90th percentile of the absolute relative velocity error on the training split: a printed velocity is inside the interval when its error is at most this. Null without a training row.',
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
})

/** What one model gave on one split. */
export type Evaluation = z.infer<typeof evaluation>

const inputs = z.object({
  rows: z.string().describe('SHA-256 over the SHA-256 of each rows file.'),
  records: z.string().describe('SHA-256 over the records the rows name.'),
})
const common = {
  schemaVersion: z.literal(schemaVersion),
  split: z.enum(splits),
  final: z.boolean().describe('True for a run of the test split, which needs `--final`.'),
  inputs,
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

/** The result of `compare`. */
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

/** The JSON shape of every result. */
export const result = z.discriminatedUnion('command', [verifyResult, compareResult])
