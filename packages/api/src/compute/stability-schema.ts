import { z } from 'zod'
import { recordId } from './schemas.ts'

/** A decimal number in a query string; Number() alone would read '' and ' ' as 0 and '0x10' as 16. */
const queryNumber = (n: z.ZodNumber) =>
  z
    .string()
    .regex(/^[+-]?(\d+(?:\.\d*)?|\.\d+)(e[+-]?\d+)?$/i)
    .transform(Number)
    .pipe(n)
/**
 * Closed intervals of the stability query, SI; they keep Miller's factor finite and above 0.
 * Record values are checked against them too.
 */
export interface StabilityBounds {
  mass: readonly [1e-4, 0.2]
  diameter: readonly [1e-3, 0.04]
  length: readonly [1e-3, 0.2]
  twist: readonly [0.01, 10]
  muzzleVelocity: readonly [1, 3000]
  temperature: readonly [150, 400]
  pressure: readonly [1e3, 2e5]
}

/** The values of {@link StabilityBounds}. */
export const stabilityBounds: Readonly<StabilityBounds> = {
  mass: [1e-4, 0.2],
  diameter: [1e-3, 0.04],
  length: [1e-3, 0.2],
  twist: [0.01, 10],
  muzzleVelocity: [1, 3000],
  temperature: [150, 400],
  pressure: [1e3, 2e5],
}
const bounded = (key: keyof typeof stabilityBounds) =>
  queryNumber(z.number().min(stabilityBounds[key][0]).max(stabilityBounds[key][1]))
/** Query of `GET /exterior/stability`: SI, bounds in `stabilityBounds`. */
export const stabilityQuery = z
  .strictObject({
    bullet: recordId.optional().meta({
      description:
        'Id of the bullet record that supplies mass, diameter and length where they are absent.',
      examples: ['demo-bullet-168'],
    }),
    mass: bounded('mass')
      .optional()
      .meta({
        description: 'Bullet mass, kg. Required without bullet.',
        examples: [0.010886],
      }),
    diameter: bounded('diameter')
      .optional()
      .meta({
        description: 'Bullet diameter, m. Required without bullet.',
        examples: [0.007823],
      }),
    length: bounded('length')
      .optional()
      .meta({
        description:
          "Bullet length, m. Required without bullet. With bullet it defaults to the record's length.",
        examples: [0.0305],
      }),
    twist: bounded('twist').meta({ description: 'Twist length per turn, m.', examples: [0.254] }),
    muzzleVelocity: bounded('muzzleVelocity').meta({
      description: 'Muzzle velocity, m/s.',
      examples: [800],
    }),
    temperature: bounded('temperature')
      .optional()
      .meta({
        description: 'Air temperature at the muzzle, K, default 288.15.',
        examples: [288.15],
      }),
    pressure: bounded('pressure')
      .optional()
      .meta({
        description: 'Absolute station pressure at the muzzle, Pa, default 101325.',
        examples: [101325],
      }),
  })
  .refine(
    (q) =>
      q.bullet !== undefined ||
      (q.mass !== undefined && q.diameter !== undefined && q.length !== undefined),
    { message: 'mass, diameter and length are required without bullet' },
  )
  .describe('Projectile, twist, muzzle velocity and air of the stability factor. Units SI.')

/** A parsed `GET /exterior/stability` query. */
export interface StabilityQuery extends z.infer<typeof stabilityQuery> {}
