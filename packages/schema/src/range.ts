import { z } from 'zod'
import { recordId } from './ids.ts'
import { provenance } from './provenance.ts'
import { quantity } from './units.ts'

/**
 * Spark-range firings of one projectile as a report tabulates them: per round the Mach number, the
 * total angle of attack and the drag coefficient measured at that yaw, each with the printed text in
 * `raw`. A drag coefficient here is not the zero-yaw drag; deriving that is a computation of its own.
 * Inferred type: {@link RangeFirings}.
 */
export const rangeFirings = z
  .object({
    id: recordId,
    /** The projectile as the report names it. */
    projectile: z.string().min(1),
    /** Projectile diameter in mm that the drag coefficients refer to. */
    bulletDiameter: quantity('length'),
    bulletMass: quantity('mass'),
    rounds: z
      .array(
        z.object({
          /** Round number as printed. */
          label: z.string().min(1),
          mach: quantity('dimensionless'),
          /** Total angle of attack over the measured flight (alpha t). */
          totalYaw: quantity('angle'),
          /** Drag coefficient at that yaw. */
          dragCoefficient: quantity('dimensionless'),
        }),
      )
      .min(1),
    note: z.string().min(1).optional(),
    // One report per record: its rounds are numbered within that report.
    provenance: provenance.refine(
      (p) =>
        p.kind === 'measured' &&
        p.sources.length === 1 &&
        !!p.sources[0]?.url &&
        !!p.sources[0]?.sha256,
      { message: 'range firings are measured, from one report with its URL and sha256' },
    ),
  })
  .superRefine((r, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message })
    if (r.bulletDiameter.value <= 0) issue(['bulletDiameter'], 'must be positive')
    if (r.bulletMass.value <= 0) issue(['bulletMass'], 'must be positive')
    const seen = new Set<string>()
    r.rounds.forEach((round, k) => {
      if (seen.has(round.label)) issue(['rounds', k, 'label'], 'listed twice')
      seen.add(round.label)
      if (round.mach.value <= 0) issue(['rounds', k, 'mach'], 'must be positive')
      if (round.dragCoefficient.value <= 0)
        issue(['rounds', k, 'dragCoefficient'], 'must be positive')
      if (round.totalYaw.value < 0) issue(['rounds', k, 'totalYaw'], 'must not be negative')
    })
  })

/** A record of spark-range rounds of one projectile from one report. */
export interface RangeFirings extends z.infer<typeof rangeFirings> {}
