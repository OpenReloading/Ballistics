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

/** Core materials of a bullet that contain lead. */
const leadCoreMaterials = ['lead', 'lead-alloy'] as const

/**
 * Core materials a record can name. `compressed-powder` is a consolidated metal powder whose metals
 * the wording does not state, so it says nothing about lead.
 */
const coreMaterials = z.enum([
  ...leadCoreMaterials,
  'copper',
  'copper-alloy',
  'tin',
  'tungsten',
  'steel',
  'compressed-powder',
])

/** Surface treatments that contain lead. */
const leadSurfaces = ['lead-wash'] as const

/**
 * How a bullet is built, as structured fields next to the manufacturer's wording. Values are read from
 * that wording; a field is absent where the wording does not state it. Lead-free is not stored:
 * {@link leadFree} derives it.
 * Inferred type: {@link ConstructionFields}.
 */
export const constructionFields = z
  .object({
    /** The manufacturer's wording as printed. */
    raw: z.string().min(1),
    structure: z
      .enum([
        'cup-and-core',
        'bonded',
        'partitioned',
        'monolithic',
        'cast',
        'swaged',
        'plated',
        'frangible',
      ])
      .optional(),
    core: z
      .object({
        material: coreMaterials,
        /** Brinell hardness number (HBW, ISO 6506-1) of a lead or lead alloy core, a cast bullet's alloy. */
        hardness: quantity('dimensionless', z.number().positive()).optional(),
      })
      .optional(),
    /** Present when the bullet has a jacket; the material and the wall only where they are stated. */
    jacket: z
      .object({
        material: z
          .enum(['copper', 'gilding-metal', 'copper-clad-steel', 'copper-plated-steel', 'steel'])
          .optional(),
        thickness: quantity('length', z.number().positive()).optional(),
      })
      .optional(),
    surface: z
      .array(
        z.enum([
          'moly',
          'black-oxide',
          'powder-coat',
          'polymer-coat',
          'paint',
          'wax-lube',
          'boron-nitride',
          'tungsten-disulfide',
          'copper-wash',
          ...leadSurfaces,
        ]),
      )
      .min(1)
      .optional(),
    /** A gas check, the cup on the base of a cast bullet; `false` for a plain base the wording states. */
    gasCheck: z.boolean().optional(),
    /** Number of driving bands of a monolithic bullet with relieved shanks. */
    drivingBands: z.int().positive().optional(),
    /** Set when no structured field could be derived from `raw`; the wording stays as printed. */
    unmapped: z.literal(true).optional(),
  })
  .superRefine((c, ctx) => {
    const issue = (path: string[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message })
    if (
      c.unmapped &&
      (c.structure || c.core || c.jacket || c.surface || c.gasCheck !== undefined || c.drivingBands)
    )
      issue([], 'unmapped excludes the structured fields')
    if (c.gasCheck !== undefined && c.structure !== 'cast')
      issue(['gasCheck'], 'only for a cast bullet')
    if (c.drivingBands && c.structure !== 'monolithic')
      issue(['drivingBands'], 'only for a monolithic bullet')
    if (c.core?.hardness && !(leadCoreMaterials as readonly string[]).includes(c.core.material))
      issue(['core', 'hardness'], 'only for a lead or lead alloy core')
  })

/** Bullet construction read from the manufacturer's wording, with `raw` kept as printed. */
export interface ConstructionFields extends z.infer<typeof constructionFields> {}

/**
 * Whether a bullet contains no lead, derived from the core, the jacket and the surface: `false` when
 * the core or the surface contains lead, `true` when the core is a named material without lead and
 * the surface has none, `undefined` when the wording does not settle it (no construction, wording
 * kept as printed, no core material, or a compressed powder whose metals are not stated).
 */
export function leadFree(c: ConstructionFields | undefined): boolean | undefined {
  if (!c || c.unmapped) return undefined
  const lead = (list: readonly string[], value: string | undefined) =>
    value !== undefined && list.includes(value)
  if (lead(leadCoreMaterials, c.core?.material) || c.surface?.some((s) => lead(leadSurfaces, s)))
    return false
  const material = c.core?.material
  return material && material !== 'compressed-powder' ? true : undefined
}

/**
 * Base types of a bullet. `conical-hollow-base` and `rounded-hollow-base`: a cavity open at the base,
 * a cone or a hemisphere whose depth follows from its diameter (`cavityDiameter`), on a flat base or
 * on the boat tail the other fields describe.
 */
export const baseTypes = z.enum([
  'flat',
  'boat-tail',
  'rebated-boat-tail',
  'conical-hollow-base',
  'rounded-hollow-base',
])

/**
 * Ogive forms of a bullet: `tangent`, `secant` and `hybrid` by the head-shape ratio Rt/R,
 * `round-nose` and `flat-nose` for a nose that is no ogive of revolution.
 */
export const ogiveForms = z.enum(['tangent', 'secant', 'hybrid', 'round-nose', 'flat-nose'])

/** Tip types of a bullet: the nose construction. */
export const tipTypes = z.enum([
  'hollow-point',
  'polymer-tip',
  'soft-point',
  'full-metal-jacket',
  'open-meplat',
])

/**
 * Base of a bullet: type, length, for a boat tail the base face diameter and the tail angle, and
 * for a hollow base the diameter of the cavity.
 */
const bulletBase = z
  .object({
    type: baseTypes.optional(),
    length: quantity('length').optional(),
    /**
     * Diameter of the base face at the end of the boat tail (McCoy, ARBRL-TR-02293, 1981, PDF p. 21).
     * Only with a boat-tail or hollow base type.
     */
    diameter: quantity('length', z.number().positive()).optional(),
    /**
     * Boat-tail angle: half-angle of the conical boat tail, between its surface and the bullet axis
     * (McCoy, ARBRL-TR-02293, 1981, PDF p. 17). Only with a boat-tail or hollow base type.
     */
    angle: quantity('angle', z.number().gt(0).lt(90)).optional(),
    /** Diameter of the cavity where it opens in the base face. Needed by, and only with, a hollow base type. */
    cavityDiameter: quantity('length', z.number().positive()).optional(),
  })
  .superRefine((base, ctx) => {
    const hollow = base.type === 'conical-hollow-base' || base.type === 'rounded-hollow-base'
    const tail = base.type === 'boat-tail' || base.type === 'rebated-boat-tail' || hollow
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message })
    for (const key of ['diameter', 'angle'] as const) {
      if (base[key] && !tail) issue(key, 'only with a boat-tail or hollow base type')
    }
    if (base.cavityDiameter && !hollow) issue('cavityDiameter', 'only with a hollow base type')
    if (hollow && !base.cavityDiameter) issue('cavityDiameter', 'needed by a hollow base type')
  })

/** Ogive of a bullet: form, radius or Rt/R, at least one of them. */
const bulletOgive = z
  .object({
    /** Optional: a source may give the radius or Rt/R without naming the form. */
    form: ogiveForms.optional(),
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

/** Slack of the cannelure checks, mm, for a groove that ends exactly on a shank end. */
const lengthTolerance = 1e-9

/**
 * Cannelure, a groove around the shank. `start` is the distance from the base of the bullet to the
 * groove's rear edge, the edge nearer the base: forensic work measures a cannelure's position as its
 * height above the base of the bullet, from the base of the bullet to the base of the groove
 * (Hudson, Proceedings of the American Academy of Forensic Sciences, 2018, abstract B129). The
 * bullet designer's cannelure start has the same datum and unit, so a record seeds it unchanged.
 * `width` is the axial extent of the groove and `depth` its radial depth where the source gives one.
 */
const bulletCannelure = z.object({
  start: quantity('length', z.number().positive()),
  width: quantity('length', z.number().positive()),
  depth: quantity('length', z.number().positive()).optional(),
})

/** Tip of a bullet: type, and the polymer tip length or the hollow-point mouth diameter. */
const bulletTip = z
  .object({
    type: tipTypes,
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

type Stored = { value: number } | undefined

/**
 * Refuses a cannelure that leaves the shank, as far as the record gives its ends: the shank ends
 * where the nose begins (the length less the nose length) and, behind a boat tail, begins where the
 * tail ends. The drawing checks the ends the record leaves out.
 */
function cannelureOnShank(
  b: {
    diameter?: { value: number } | undefined
    length?: Stored
    noseLength?: Stored
    base?: { type?: string | undefined; length?: Stored } | undefined
    cannelure?: { start: { value: number }; width: { value: number }; depth?: Stored } | undefined
  },
  issue: (path: string[], message: string) => void,
) {
  const groove = b.cannelure
  if (!groove) return
  const tail = b.base?.type === 'boat-tail' || b.base?.type === 'rebated-boat-tail'
  const rear = tail ? (b.base?.length?.value ?? 0) : 0
  if (groove.start.value < rear - lengthTolerance)
    issue(['cannelure', 'start'], 'must not lie on the boat tail')
  const end = b.length && b.length.value - (b.noseLength?.value ?? 0)
  if (end !== undefined && groove.start.value + groove.width.value > end + lengthTolerance)
    issue(
      ['cannelure', 'width'],
      b.noseLength ? 'must end before the nose begins' : 'must end within the length',
    )
  if (groove.depth && b.diameter && !(groove.depth.value < b.diameter.value / 2))
    issue(['cannelure', 'depth'], 'must be smaller than the radius')
}

/** A projectile as its manufacturer sells it. Inferred type: {@link Bullet}. */
export const bullet = z
  .object({
    id: recordId,
    /** Id of the manufacturer record. */
    manufacturer: recordId,
    /** Product number. Absent only with `nameOnly`. */
    productNumber: z.string().min(1).optional(),
    name: z.string().min(1),
    country: countryCode.optional(),
    productLine: z.string().min(1).optional(),
    /** Caliber as the manufacturer writes it, for example `.308`. */
    caliber: z.string().min(1).optional(),
    /** Diameter. Absent only with `nameOnly`; stored only where a source prints one. */
    diameter: quantity('length').optional(),
    mass: quantity('mass'),
    length: quantity('length').optional(),
    base: bulletBase.optional(),
    ogive: bulletOgive.optional(),
    cannelure: bulletCannelure.optional(),
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
    /**
     * Set on a record that only names a bullet a table prints: no product number and, unless the
     * table prints one, no diameter. Without it `productNumber` and `diameter` are required, so a
     * full record cannot lose them unnoticed.
     */
    nameOnly: z
      .literal(true)
      .describe('A record that only names the bullet: it has no product number.')
      .optional(),
    provenance,
  })
  .superRefine((b, ctx) => {
    needsCountrySource(b, ctx)
    const issue = (path: string[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message })
    if (b.nameOnly) {
      if (b.productNumber !== undefined)
        issue(['productNumber'], 'a name-only record has no product number')
    } else {
      if (b.productNumber === undefined)
        issue(['productNumber'], 'a full record needs a product number')
      if (b.diameter === undefined) issue(['diameter'], 'a full record needs a diameter')
    }
    const d = b.diameter?.value
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
    below(['base', 'length'], b.base?.length?.value, b.length?.value, 'the length')
    const cavity = b.base?.cavityDiameter?.value
    below(
      ['base', 'cavityDiameter'],
      cavity,
      b.base?.diameter?.value ?? d,
      b.base?.diameter ? 'the base diameter' : 'the diameter',
    )
    cannelureOnShank(b, issue)
    below(
      ['construction', 'jacket', 'thickness'],
      b.construction?.jacket?.thickness?.value,
      d === undefined ? undefined : d / 2,
      'the radius',
    )
    // The depth is not stored: it is half the opening (`bulletOutline`).
    if (cavity !== undefined && b.length && !(cavity / 2 < b.length.value))
      issue(
        ['base', 'cavityDiameter'],
        'half of it, the cavity depth, must be smaller than the length',
      )
  })

/** One published coefficient: G1 or G7, value in lb/in2, optional velocity band. */
export interface BallisticCoefficient extends z.infer<typeof ballisticCoefficient> {}
/** A bullet record: geometry in mm, mass in g, published coefficients. */
export interface Bullet extends z.infer<typeof bullet> {}
