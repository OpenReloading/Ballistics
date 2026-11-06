import { z } from 'zod'
import type { Exact } from './exact.ts'
import { recordId } from './ids.ts'
import { provenance } from './provenance.ts'
import { pressureMethod } from './standards.ts'
import { type QuantitySchema, quantity } from './units.ts'

const firingSeriesParser = z
  .object({
    id: recordId,
    cartridge: recordId,
    /** The ammunition as the publication describes it. */
    ammunition: z.string().min(1),
    /** Bullet mass as the publication states it (nominal for factory ammunition). */
    bulletMass: quantity('mass').optional(),
    /** Firearm or test barrel as the publication describes it. */
    firearm: z.string().min(1).optional(),
    barrelLength: quantity('length').optional(),
    /** Number of rounds fired in the series; `velocity.shots`, when given, has this length. */
    roundCount: z.int().min(1),
    velocity: z
      .object({
        /** Where the velocity applies, as printed ("initial velocity", "at the level of the muzzle"). */
        point: z.string().min(1),
        instrument: z.string().min(1).optional(),
        /** Mean as published; absent when only single shots are published. */
        mean: quantity('velocity').optional(),
        /** Single-shot velocities in the order published. */
        shots: z.array(quantity('velocity')).min(1).optional(),
      })
      .refine((v) => v.mean !== undefined || v.shots !== undefined, {
        message: 'a mean or single shots',
      }),
    pressure: z
      .object({
        method: pressureMethod,
        instrument: z.string().min(1).optional(),
        /** Gauge position as printed. */
        position: z.string().min(1),
        /** Mean of the peak pressure of each round. */
        meanPeak: quantity('pressure'),
      })
      .optional(),
    note: z.string().min(1).optional(),
    provenance: provenance.refine(
      (p) => p.kind === 'measured' && p.sources.every((s) => s.url && s.license),
      { message: 'published measurements are measured, and each source names its URL and license' },
    ),
  })
  .refine((f) => !f.velocity.shots || f.velocity.shots.length === f.roundCount, {
    message: 'one velocity per round',
    path: ['velocity', 'shots'],
  })

/**
 * Rounds of one ammunition fired from one barrel, measured and published by others (a paper, a
 * report). Fields hold what the publication states; descriptions are worded as printed, and what it
 * does not state is left out, never filled in from elsewhere.
 * Inferred type: {@link FiringSeries}.
 */
export const firingSeries: z.ZodObject<{
  id: typeof recordId
  cartridge: typeof recordId
  ammunition: z.ZodString
  bulletMass: z.ZodOptional<QuantitySchema>
  firearm: z.ZodOptional<z.ZodString>
  barrelLength: z.ZodOptional<QuantitySchema>
  roundCount: z.ZodInt
  velocity: z.ZodObject<{
    point: z.ZodString
    instrument: z.ZodOptional<z.ZodString>
    mean: z.ZodOptional<QuantitySchema>
    shots: z.ZodOptional<z.ZodArray<QuantitySchema>>
  }>
  pressure: z.ZodOptional<
    z.ZodObject<{
      method: typeof pressureMethod
      instrument: z.ZodOptional<z.ZodString>
      position: z.ZodString
      meanPeak: QuantitySchema
    }>
  >
  note: z.ZodOptional<z.ZodString>
  provenance: typeof provenance
}> = firingSeriesParser satisfies Exact<typeof firingSeries, typeof firingSeriesParser>

/** A record of rounds fired and measured by others, as a publication reports them. */
export interface FiringSeries extends z.infer<typeof firingSeries> {}
