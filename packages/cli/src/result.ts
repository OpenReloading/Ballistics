import { z } from 'zod'
import { reasons } from './evaluate.ts'
import { notFittedReasons, pressureKeys } from './fit.ts'
import { foldCount, foldPool, foldSalt } from './folds.ts'
import { barrelClasses, groupings } from './metrics.ts'
import { skipReasons } from './published-rows.ts'
import { splitSalt, splits } from './split.ts'

/** Version of the JSON shape every result carries as `schemaVersion`. */
export const schemaVersion = 1

const count = z.int().nonnegative()
const fraction = z.number().describe('A fraction: 0.034 is 3.4 %.')
const errorStats = z.object({
  median: fraction.describe('Median of the absolute relative error, as a fraction.'),
  p90: fraction.describe('90th percentile of the absolute relative error, as a fraction.'),
})

const errors = {
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
}

/** The metrics of one group of rows: all rows of the split, one powder or one powder family. */
const metrics = z.object({
  rows: z.object({
    inSplit: count.describe('Rows of the split in this group.'),
    used: count.describe('Rows the model gave a result for.'),
    notUsed: z
      .partialRecord(z.enum(reasons), count)
      .describe('Rows not used, by reason; a reason without rows is left out.'),
  }),
  ...errors,
  byBarrel: z
    .partialRecord(z.enum(barrelClasses), z.object({ rows: count, ...errors }))
    // one definition in the JSON schema, referenced by every group
    .meta({ id: 'errorsByBarrel' })
    .optional()
    .describe(
      'The velocity and pressure errors per barrel class: `handgun`, a barrel under 300 mm, else `rifle`. A class without a used row is left out; a result written before it has none.',
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

const pressureFit = z
  .object({
    sigma: fraction.describe(
      'Pressure sigma of each row, a fraction of its printed pressure over the factor of its key.',
    ),
    by: z
      .enum(pressureKeys)
      .default('basis')
      .describe(
        'The key of `--pressure-factor` a factor is computed per and applied by: `basis`, the pressure basis (`unstated` without one); `table`, the table label (`unstated` without one); `cartridge`; `table-cartridge`, `<table>/<cartridge>`. A result without it reads as `basis`.',
      ),
    factors: z
      .record(
        z.string(),
        z.object({
          factor: z
            .number()
            .describe(
              'The model peak pressure times this is what the rows of the key read: the exponential of the median log of printed over model peak pressure of its rows under the fit to velocities only.',
            ),
          rows: count.describe('Pressure rows of the key of the powders fitted to velocities.'),
        }),
      )
      .describe(
        'By key of the training rows; a key without a row of a powder fitted to velocities is left out, and its training pressures are not read.',
      ),
  })
  .optional()
  .describe(
    'With `--pressure-sigma`: the burn coefficients come from a second fit, in which the printed pressures of the training rows join the velocities, each over the factor of its key of `--pressure-factor`.',
  )

const impetusCenter = z.object({
  impetus: z.number().describe('Median record impetus, (gamma - 1) times the energy, J/kg.'),
  sigma: z
    .number()
    .describe(
      'Spread of ln impetus: 1.4826 times its median absolute deviation, at least 0.02; the prior sigma of a powder of full weight.',
    ),
  powders: count.describe('Reference powders it is taken over.'),
})

const energyFamily = z
  .object({
    fullWeight: z
      .object({ rows: count, cartridges: count })
      .describe(
        "Rows the fit uses (with `--folds`, those of the other four folds) and their cartridges at which a powder's weight is 1: its weight is min(1, rows / `rows`, cartridges / `cartridges`) and its prior sigma the spread times the root of the weight. The reference powders are those of weight 1.",
      ),
    familyMinimum: count.describe('Fewest reference powders a family needs for its own center.'),
    families: z
      .record(z.string(), impetusCenter)
      .describe(
        'By powder family (propellant base and grain form), the center of its reference powders; a family with fewer than `familyMinimum` is left out and its powders take `pooled`.',
      ),
    pooled: impetusCenter.describe('The center of all reference powders.'),
  })
  .optional()
  .describe(
    "With `--energy family`: each powder's energy is fitted with its burn coefficient, under a Gaussian prior on its log centered on its family's median impetus (or `pooled`) over its own gamma minus 1.",
  )

const interval = z.object({
  basis: z
    .enum(['training', foldPool])
    .describe(
      'The split whose used rows set the half width: `training`, or with `--folds` the training and validation rows the fit read.',
    ),
  byBarrel: z
    .partialRecord(
      z.enum(barrelClasses),
      z.object({
        halfWidth: fraction.describe(
          'The 90th percentile of |model - printed| / model of the velocity over the used rows of the class in `basis`, the distance the coverage tests: the interval of a row of the class is the model velocity times (1 +/- this).',
        ),
        trainingRows: count.describe('Used rows of the class in `basis`.'),
      }),
    )
    .meta({ id: 'halfWidthByBarrel' })
    .optional()
    .describe(
      'The half width of the 90 % interval per barrel class, as `byBarrel` of the metrics. A class without a used row in `basis` is left out, and its rows have no interval. Absent at the top of a `--folds` result, where each row takes the half width of its class in its fold, and in a result written before it.',
    ),
  halfWidth: z
    .number()
    .nullable()
    .optional()
    .describe(
      'Only in a result written before `byBarrel`: one half width for every row, the 90th percentile of |model - printed| / printed of the velocity on the training split.',
    ),
  trainingRows: count.describe(
    'Used rows of `basis` the half width comes from; at the top of a `--folds` result the sum over the folds, in which each row counts once for every fold whose half width it sets.',
  ),
})

const fitSummary = z.object({
  velocitySigma: fraction.describe('Velocity sigma of the fit, a fraction of the velocity.'),
  powders: count.describe('Powders fitted.'),
  notFitted: z
    .partialRecord(z.enum(notFittedReasons), count)
    .describe('Powders not fitted, by reason; a reason without powders is left out.'),
  exponent: z
    .object({
      pooled: z
        .number()
        .describe('The exponent of least mean chi square over all powders that entered.'),
      families: z
        .record(z.string(), z.number())
        .describe('By powder family, the exponent it chose.'),
    })
    .optional()
    .describe('With `--exponent family`: the pressure exponents of the fit.'),
  pressure: pressureFit,
  energy: z
    .object({
      factor: z
        .number()
        .describe('The energy-level factor the prior impetus values were scaled by.'),
    })
    .optional()
    .describe('With `--energy prior`.'),
  energyFamily,
})

const evaluation = z.object({
  model: z.string().describe('The name or module path the model was selected by.'),
  modelVersion: z
    .string()
    .describe('SHA-256 over the model sources, the records the rows name and the rows bytes.'),
  interval,
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
  estimatedCapacity: metrics
    .optional()
    .describe(
      'The rows of the split that would be `noCaseCapacity` without the estimated capacity of their cartridge (a capacity record of provenance kind `derived`), present when there are any. They are left out of `overall`, the groups, the fit, the interval and the paired change, where they count as `estimatedCapacity`; the interval coverage here uses the half width of the other rows.',
    ),
  notInFittedSet: metrics
    .extend({ powders: count.describe('Powders left out, one at a time, each without a value.') })
    .optional()
    .describe(
      'Powder not in the fitted set, with `--leave-one-powder-out`: the rows of each powder that has interior parameters, run without them. A powder without rows has no value, so its rows count as `noPowderModel` (a row with an unknown cartridge or bullet as `unknownCartridge` or `unknownBullet`, which are checked first) and the errors and the coverage are null.',
    ),
  fit: fitSummary
    .optional()
    .describe(
      "With `--params fit-on-training`: the burn coefficients were fitted to the training rows; a powder not fitted has no value, so its rows count as `noPowderModel`. With `--pressure-sigma`, `pressure` holds the factor per key of `--pressure-factor` of the fit; the pressure errors still compare the model's peak pressure as it is with the printed pressure. With `--fit`: the summary of the saved fit. Left out with `--folds`, where each fold has its own in `folds.each`.",
    ),
  screen: z
    .object({
      version: z
        .string()
        .describe(
          "The model version of this build with the saved fit's options, the `modelVersion` a full run with `--params fit-on-training` gives.",
        ),
    })
    .optional()
    .describe(
      "With `--fit`: an evaluation only, a screen. The values are those of a saved fit, not fitted in this run, and `modelVersion` is that fit's, whose model and fit sources may differ from this build's; a full run with `--params fit-on-training` gives the result to report.",
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

const salt = z
  .literal(splitSalt)
  .describe(
    'The salt of the rule that assigns a cartridge to its split; results of different salts hold other rows per split and do not compare.',
  )

const common = {
  schemaVersion: z.literal(schemaVersion),
  notice: z.literal(notice),
  split: z.enum(splits),
  splitSalt: salt,
  final: z.boolean().describe('True for a run of the test split, which needs `--final`.'),
  inputs,
  published,
}

const signed = z.number().describe('(model - printed) / printed, as a fraction.')

/** `quantity` of velocity and pressure per barrel class of `byBarrel` in the metrics, as the JSON schema definition `id`. */
const byBarrel = <Q extends z.ZodType>(quantity: Q, id: string) =>
  z
    .record(z.enum(barrelClasses), z.object({ velocity: quantity, pressure: quantity }))
    .meta({ id })
    .describe('The same per barrel class, over the rows of the class.')

const pooledStat = z.object({
  value: fraction.describe('Over the rows of every fold.'),
  standardError: z.number().describe('Standard deviation over the bootstrap draws.'),
})
const pooledQuantity = z
  .object({
    rows: count.describe('Used rows of every fold (for pressure: that print one in bar).'),
    cartridges: count.describe('Their distinct cartridges, the units the bootstrap draws.'),
    median: pooledStat.describe('Of the median absolute relative error.'),
    p90: pooledStat.describe('Of the 90th percentile of the absolute relative error.'),
  })
  .nullable()
  .describe('Null without a used row that has the quantity.')

const folds = z
  .object({
    unit: z.literal('cartridge').describe('A fold holds whole cartridges.'),
    count: z.literal(foldCount),
    salt: z
      .literal(foldSalt)
      .describe(
        'The salt of the rule that deals the cartridges to the folds: sorted by the hex SHA-256 of `<salt>/<cartridge id>`, the fold of a cartridge is its position mod `count`.',
      ),
    cartridges: count.describe(
      'Distinct cartridges of the training and validation rows, the ones dealt.',
    ),
    each: z
      .array(
        z.object({
          fold: count.describe('From 0.'),
          cartridges: z.array(z.string()).describe('Its cartridge ids, sorted.'),
          fit: fitSummary.describe(
            'The fit on the training and validation rows of the other folds; a powder only this fold names has no fit row and counts as `noUsableRow`.',
          ),
          interval: interval.describe(
            'The half width of the fit, on the training and validation rows of the other folds.',
          ),
          overall: metrics.describe('The rows of the fold, scored by the fit without them.'),
        }),
      )
      .describe('Per fold, from 0.'),
    aggregate: z
      .object({
        draws: count.describe('Bootstrap draws.'),
        seed: count.describe('Seed of the draws.'),
        velocity: pooledQuantity,
        pressure: pooledQuantity,
        byBarrel: byBarrel(pooledQuantity, 'pooledByBarrel').optional(),
      })
      .describe(
        'The rows of every fold together, each scored by the fit without its fold, with the standard error of a bootstrap that draws whole cartridges with replacement; the rows of `estimatedCapacity` are left out.',
      ),
  })
  .optional()
  .describe(
    'With `--folds`: grouped cross-validation by cartridge over the training and validation splits; no row of the test split is read. In `verify`, the evaluation holds the rows of every fold together, each scored by the fit without its fold. In `fit`, the fit outside `folds` stays on the training rows.',
  )

/** The result of `verify`. */
export const verifyResult = z.object({
  ...common,
  split: z
    .enum([...splits, foldPool])
    .describe('The split scored; `training+validation` with `--folds`.'),
  command: z.literal('verify'),
  ...evaluation.shape,
  folds,
  rows: z
    .array(
      z.object({
        row: count.describe(
          'Position of the row among the rows read, from 0: two runs on the same rows pair by it.',
        ),
        cartridge: z.string(),
        velocity: signed,
        pressure: signed.optional().describe('Of a row that prints a pressure in bar.'),
        barrel: z
          .enum(barrelClasses)
          .optional()
          .describe(
            'Its barrel class, as `byBarrel` of the metrics; a result written before it has none.',
          ),
        capacity: z
          .literal('estimated')
          .optional()
          .describe('The capacity of its cartridge is an estimate: `compare` never pairs the row.'),
      }),
    )
    .optional()
    .describe(
      'With `--per-row`: the error of each used row of the split, for the paired change of `compare`, the rows of `estimatedCapacity` among them; with `--folds`, each scored by the fit without its fold.',
    ),
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

const pairedStat = z.object({
  baseline: fraction.describe('Of the baseline over the paired rows.'),
  candidate: fraction.describe('Of the candidate over the paired rows.'),
  change: z.number().describe('Candidate minus baseline.'),
  standardError: z.number().describe('Standard deviation of the change over the bootstrap draws.'),
})
const pairedQuantity = z
  .object({
    rows: count.describe(
      'Rows both sides gave a result for (for pressure: that print one in bar).',
    ),
    cartridges: count.describe('Their distinct cartridges, the units the bootstrap draws.'),
    median: pairedStat.describe('Of the median absolute relative error.'),
    p90: pairedStat.describe('Of the 90th percentile of the absolute relative error.'),
  })
  .nullable()
  .describe('Null without a row both sides ran that has the quantity.')

const compareResult = z.object({
  ...common,
  command: z.literal('compare'),
  baseline: evaluation,
  candidate: evaluation,
  paired: z
    .object({
      draws: count.describe('Bootstrap draws.'),
      seed: count.describe('Seed of the draws.'),
      velocity: pairedQuantity,
      pressure: pairedQuantity,
      byBarrel: byBarrel(pairedQuantity, 'pairedByBarrel'),
    })
    .optional()
    .describe(
      'When both sides have row errors (two models, or a baseline saved with `--per-row`): the change over the rows both sides ran, each with the standard error of a bootstrap that draws whole cartridges with replacement.',
    ),
  change: z.object({
    overall: change,
    byFamily: z.record(z.string(), change),
    grouped: z.record(z.string(), change).optional().describe('Per group of `--group-by`.'),
    estimatedCapacity: change
      .optional()
      .describe('Of the `estimatedCapacity` rows, when either side has them.'),
  }),
})

/** The result of `compare`. */
export type CompareResult = z.infer<typeof compareResult>

export const fitResult = z.object({
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
  splitSalt: salt,
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
                "The exponent of least sum of its powders' chi squares plus `shrinkage` times the mean over all powders that entered.",
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
  pressure: pressureFit,
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
            'Chi square of every row, data and the prior rows of the rifle and lot effects and of the energy, over all rows minus all parameters; null where that count is not above 0.',
          ),
        iterations: count.describe('Iterations of the solver.'),
        pressureExponent: z
          .number()
          .optional()
          .describe(
            'With `--exponent family`: the exponent of its family, the value fitted at it.',
          ),
        pressureRows: count
          .optional()
          .describe(
            'With `--pressure-sigma`: used training rows whose printed pressure the fit read, those of a key of `--pressure-factor` with a factor.',
          ),
        energy: z
          .object({
            value: z
              .number()
              .describe(
                "Specific energy laid over the record, J/kg: with `--energy prior` the prior impetus times the energy-level factor of `energy.factor`, over the record's `interior.gamma` minus 1; with `--energy family` the fitted energy.",
              ),
            prior: z
              .enum(['own', 'base', 'family', 'pooled'])
              .describe(
                "Where the prior impetus came from: `own`, the powder's thermochemistry; `base`, the median of the own impetus values of its propellant base; `family`, the center of its family in `energyFamily`; `pooled`, the median of all own impetus values, or with `--energy family` the center of all reference powders.",
              ),
          })
          .optional()
          .describe('With `--energy prior` or `--energy family`.'),
      }),
    )
    .describe('By powder id: each powder fitted on its own.'),
  notFitted: z
    .record(z.string(), z.enum(notFittedReasons))
    .describe(
      'By powder id, why a powder with interior parameters that the rows name got no value: the reason of the fit (with `--exponent family`, of the fit at the exponent of its family), or `noUsableRow` without a used training row.',
    ),
  energy: z
    .object({
      factor: z
        .number()
        .describe('The chosen energy-level factor, the grid value with the least objective.'),
      grid: z.array(z.number()).describe('The energy-level factors tried, one fit each.'),
      objective: z
        .array(z.number().nullable())
        .describe(
          'Per grid value, the median of |ln(model peak / printed pressure)| over the same rows at every value that takes part: the training rows that print a pressure in bar and have a model peak at every such value, so only rows of powders fitted at all of them. A value takes part when at least 90 % of the powders fitted at any value are fitted at it; null where it does not.',
        ),
      pressureRows: count.describe(
        'Rows of the objective, the same at every factor that takes part.',
      ),
      priors: z
        .object({ own: count, byBase: count, pooled: count })
        .describe(
          'How many powders took each kind of prior, of the powders the rows name that have interior parameters, fitted or not.',
        ),
    })
    .optional()
    .describe(
      "With `--energy prior`: each powder's energy is its prior impetus times one energy-level factor shared by all powders, over its `interior.gamma` minus 1, chosen on the training pressures; per powder only the burn coefficient is fitted.",
    ),
  energyFamily,
  folds,
})

/** The result of `fit`. */
export type FitResult = z.infer<typeof fitResult>

/** The JSON shape of every result. */
export const result = z.discriminatedUnion('command', [verifyResult, compareResult, fitResult])
