import { z } from 'zod'
import { recordId } from './ids.ts'
import { provenance } from './provenance.ts'
import { countryCode, needsCountrySource } from './shared.ts'
import { quantity } from './units.ts'

/**
 * A ballistic coefficient a manufacturer publishes for the G1 or G7 drag model: positive `value`, in the
 * unit of the `ballisticCoefficient` quantity (lb/in2), optionally for the velocity band from
 * `minVelocity`.
 * Inferred type: {@link BallisticCoefficient}.
 */
export const ballisticCoefficient = z.object({
  dragModel: z.enum(['G1', 'G7']),
  /** The coefficient in lb/in2. */
  value: z.number().positive(),
  /** Lower bound of the velocity band the value applies to, when the manufacturer publishes bands. */
  minVelocity: quantity('velocity').optional(),
  note: z.string().min(1).optional(),
})

/**
 * How a bullet is built, as structured fields next to the manufacturer's wording. Values are read from
 * that wording; a field is absent where the wording does not state it.
 * Inferred type: {@link ConstructionFields}.
 */
export const constructionFields = z
  .object({
    /** The manufacturer's wording as printed. */
    raw: z.string().min(1),
    structure: z
      .enum(['cup-and-core', 'bonded', 'partitioned', 'monolithic', 'cast', 'swaged', 'plated'])
      .optional(),
    core: z
      .object({ material: z.enum(['lead', 'lead-alloy', 'copper', 'copper-alloy']) })
      .optional(),
    /** Present when the bullet has a jacket; the material only where it is stated. */
    jacket: z
      .object({
        material: z
          .enum(['copper', 'gilding-metal', 'copper-clad-steel', 'copper-plated-steel'])
          .optional(),
      })
      .optional(),
    surface: z
      .array(z.enum(['moly', 'black-oxide']))
      .min(1)
      .optional(),
    /** Set when no structured field could be derived from `raw`; the wording stays as printed. */
    unmapped: z.literal(true).optional(),
  })
  .refine((c) => !c.unmapped || !(c.structure || c.core || c.jacket || c.surface), {
    message: 'unmapped excludes the structured fields',
  })

/** Bullet construction read from the manufacturer's wording, with `raw` kept as printed. */
export interface ConstructionFields extends z.infer<typeof constructionFields> {}

/** Base of a bullet: type, length, and for a boat tail the base face diameter and the tail angle. */
const bulletBase = z
  .object({
    type: z.enum(['flat', 'boat-tail', 'rebated-boat-tail']).optional(),
    length: quantity('length').optional(),
    /**
     * Diameter of the base face at the end of the boat tail (McCoy, ARBRL-TR-02293, 1981, PDF p. 21).
     * Only with a boat-tail base type.
     */
    diameter: quantity('length', z.number().positive()).optional(),
    /**
     * Boat-tail angle: half-angle of the conical boat tail, between its surface and the bullet axis
     * (McCoy, ARBRL-TR-02293, 1981, PDF p. 17). Only with a boat-tail base type.
     */
    angle: quantity('angle', z.number().gt(0).lt(90)).optional(),
  })
  .superRefine((base, ctx) => {
    const tail = base.type === 'boat-tail' || base.type === 'rebated-boat-tail'
    for (const key of ['diameter', 'angle'] as const) {
      if (base[key] && !tail)
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'only with a boat-tail base type',
        })
    }
  })

/** Ogive of a bullet: form, radius or Rt/R, at least one of them. */
const bulletOgive = z
  .object({
    /** Optional: a source may give the radius or Rt/R without naming the form. */
    form: z.enum(['tangent', 'secant', 'hybrid']).optional(),
    /** Ogive radius R: radius of the nose arc in an axial section (McCoy, ARBRL-TR-02293, 1981, PDF p. 13). */
    radius: quantity('length', z.number().positive()).optional(),
    /**
     * Head-shape parameter Rt/R: radius of a tangent ogive of the same nose length and diameter
     * over the actual ogive radius; 1 for a tangent ogive, 0 for a cone, between 0 and 1 for a
     * secant ogive (McCoy, ARBRL-TR-02293, 1981, PDF p. 13); 0 and 1 are included.
     */
    radiusRatio: quantity('dimensionless', z.number().min(0).max(1)).optional(),
  })
  .refine((o) => Boolean(o.form || o.radius || o.radiusRatio), {
    message: 'needs a form, a radius or Rt/R',
  })

/** Tip of a bullet: type, and the polymer tip length or the hollow-point mouth diameter. */
const bulletTip = z
  .object({
    type: z.enum(['hollow-point', 'polymer-tip', 'soft-point', 'full-metal-jacket', 'open-meplat']),
    /**
     * Polymer tip: axial length of the part forward of the jacket opening (the head), without the
     * shank seated in the jacket cavity. Mann 1997, p. 1, describes tips as a head and a shaft;
     * US 10,690,463 B2, summary, splits the tip into a main portion forward of the opening and a
     * retention portion in the cavity. Only with tip type `polymer-tip`.
     */
    length: quantity('length', z.number().positive()).optional(),
    /**
     * Hollow point: diameter of the front opening of the nose cavity, before impact (US 12,467,728 B2,
     * description: diameter of the front-side opening of the cavity, stated relative to the
     * caliber). Whether it is taken at the inner or the outer edge of the mouth is not stated there.
     * Only with tip type `hollow-point`: that definition covers a hollow point; no source defining
     * the opening of an `open-meplat` tip was found.
     */
    mouthDiameter: quantity('length', z.number().positive()).optional(),
  })
  .superRefine((tip, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message })
    if (tip.length && tip.type !== 'polymer-tip') issue('length', 'only for a polymer tip')
    if (tip.mouthDiameter && tip.type !== 'hollow-point')
      issue('mouthDiameter', 'only for a hollow point')
  })

/** A projectile as its manufacturer sells it. Inferred type: {@link Bullet}. */
export const bullet = z
  .object({
    id: recordId,
    /** Id of the manufacturer record. */
    manufacturer: recordId,
    /** Product number. */
    productNumber: z.string().min(1),
    name: z.string().min(1),
    country: countryCode.optional(),
    productLine: z.string().min(1).optional(),
    /** Caliber as the manufacturer writes it, for example `.308`. */
    caliber: z.string().min(1).optional(),
    diameter: quantity('length'),
    mass: quantity('mass'),
    length: quantity('length').optional(),
    base: bulletBase.optional(),
    ogive: bulletOgive.optional(),
    tip: bulletTip.optional(),
    /** Diameter of the flat at the nose (McCoy, ARBRL-TR-02293, 1981, PDF p. 14); 0 for a sharp point. */
    meplatDiameter: quantity('length', z.number().min(0)).optional(),
    noseLength: quantity('length').optional(),
    baseToOgive: quantity('length').optional(),
    bearingLength: quantity('length').optional(),
    construction: constructionFields.optional(),
    ballisticCoefficients: z.array(ballisticCoefficient).min(1).optional(),
    /** Twist the manufacturer recommends, length per turn. */
    recommendedTwist: quantity('length').optional(),
    /** Slowest twist the manufacturer allows ("1-10\" or faster"), length per turn. */
    slowestTwist: quantity('length').optional(),
    note: z.string().min(1).optional(),
    provenance,
  })
  .superRefine((b, ctx) => {
    needsCountrySource(b, ctx)
    const issue = (path: string[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message })
    const d = b.diameter.value
    const below = (
      path: string[],
      v: number | undefined,
      limit: number | undefined,
      what: string,
    ) => {
      if (v !== undefined && limit !== undefined && !(v < limit))
        issue(path, `must be smaller than ${what}`)
    }
    below(['meplatDiameter'], b.meplatDiameter?.value, d, 'the diameter')
    below(['base', 'diameter'], b.base?.diameter?.value, d, 'the diameter')
    // Only against the diameter: the cited definition relates the mouth to the caliber, not to the meplat.
    below(['tip', 'mouthDiameter'], b.tip?.mouthDiameter?.value, d, 'the diameter')
    below(['tip', 'length'], b.tip?.length?.value, b.length?.value, 'the length')
    below(['tip', 'length'], b.tip?.length?.value, b.noseLength?.value, 'the nose length')
  })

/** One published coefficient: G1 or G7, value in lb/in2, optional velocity band. */
export interface BallisticCoefficient extends z.infer<typeof ballisticCoefficient> {}
/** A bullet record: geometry in mm, mass in g, published coefficients. */
export interface Bullet extends z.infer<typeof bullet> {}
