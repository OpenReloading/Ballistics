/**
 * Point of impact per charge in a ladder: the height of each charge's shots with the effect of
 * their velocity removed, and a test of whether the remaining heights differ between charges
 * (`tools/research/ladder-impact-per-charge.ts`). SI throughout: charge kg, height m, velocity m/s.
 */
import { need } from '../errors.ts'
import { chiSquareQuantile } from '../groups/chi-square.ts'
import type { LadderStep } from './velocity-ladder.ts'

/** The shots of one charge: height of impact above the aim point and the velocity of each shot. */
export interface ImpactStep {
  charge: number
  heights: readonly number[]
  velocities: readonly number[]
}

/** Result of {@link ladderImpactResiduals}. */
export interface LadderImpact {
  /**
   * Per charge: the mean height after the velocity correction (`mean`) and the sample standard
   * deviation of the corrected heights, ascending in charge. The shape of {@link LadderStep}, so
   * `ladderFlatSpots` finds the flat runs of the residual.
   */
  steps: LadderStep[]
  /** Between-charge sum of squares over the pooled variance of one corrected height. */
  statistic: number
  /** Degrees of freedom of the chi-square reference: charges minus one. */
  degrees: number
  /** The statistic exceeds the chi-square quantile at `level`: the residual is not flat in charge. */
  varies: boolean
}

/**
 * The height of impact of each shot minus `slope` times its velocity less the mean velocity of the
 * ladder, averaged per charge, and a heterogeneity test across charges at `level` (default 0.99).
 * `slope` is the change of height per velocity, m per m/s, from two flown trajectories. The
 * chi-square reference is approximate when the pooled variance has few degrees of freedom; at 5
 * shots per charge and 9 charges the false-alarm rate is about the level (see the research entry).
 * It needs three or more charges with at least two shots each.
 */
export function ladderImpactResiduals(
  charges: readonly ImpactStep[],
  slope: number,
  level = 0.99,
): LadderImpact {
  need(charges.length >= 3, 'a ladder needs at least three charges')
  need(Number.isFinite(slope), 'slope must be finite')
  need(level > 0 && level < 1, 'level must lie in (0, 1)')
  const sorted = [...charges].sort((a, b) => a.charge - b.charge)
  for (const c of sorted) {
    need(Number.isFinite(c.charge) && c.charge > 0, 'charge must be positive')
    need(c.heights.length >= 2, 'each charge needs at least two shots')
    need(c.heights.length === c.velocities.length, 'each shot needs a height and a velocity')
    need(
      [...c.heights, ...c.velocities].every((v) => Number.isFinite(v)),
      'heights and velocities must be finite',
    )
  }
  const all = sorted.flatMap((c) => c.velocities)
  const meanVelocity = all.reduce((a, b) => a + b, 0) / all.length
  const steps = sorted.map((c): LadderStep => {
    const z = c.heights.map((h, i) => h - slope * ((c.velocities[i] as number) - meanVelocity))
    const mean = z.reduce((a, b) => a + b, 0) / z.length
    const variance = z.reduce((a, b) => a + (b - mean) ** 2, 0) / (z.length - 1)
    return { charge: c.charge, mean, standardDeviation: Math.sqrt(variance), count: z.length }
  })
  const shots = steps.reduce((a, s) => a + s.count, 0)
  const grand = steps.reduce((a, s) => a + s.count * s.mean, 0) / shots
  const within = steps.reduce((a, s) => a + (s.count - 1) * s.standardDeviation ** 2, 0)
  const between = steps.reduce((a, s) => a + s.count * (s.mean - grand) ** 2, 0)
  const pooled = within / (shots - steps.length)
  const degrees = steps.length - 1
  // all shots on one height in every charge: nothing to test
  const statistic = pooled > 0 ? between / pooled : between > 0 ? Number.POSITIVE_INFINITY : 0
  return { steps, statistic, degrees, varies: statistic > chiSquareQuantile(level, degrees) }
}
