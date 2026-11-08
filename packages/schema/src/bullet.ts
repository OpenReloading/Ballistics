import { z } from 'zod'
import { needsCountrySource } from './country-source.ts'
import type { Exact } from './exact.ts'
import { countryCode } from './fields.ts'
import { recordId } from './ids.ts'
import { provenance } from './provenance.ts'
import { type QuantitySchema, quantity } from './units.ts'

const ballisticCoefficientParser = z.object({
  dragModel: z.enum(['G1', 'G7']),
  value: z.number().positive(),
  minVelocity: quantity('velocity').optional(),
  note: z.string().min(1).optional(),
})

/**
 * A ballistic coefficient a manufacturer publishes for the G1 or G7 drag model: positive `value`, in the
 * unit of the `ballisticCoefficient` quantity (lb/in2), optionally for the velocity band from
 * `minVelocity`.
 * Inferred type: {@link BallisticCoefficient}.
 */
export const ballisticCoefficient: z.ZodObject<{
  dragModel: z.ZodEnum<z.core.util.ToEnum<'G1' | 'G7'>>
  /** The coefficient in lb/in2. */
  value: z.ZodNumber
  /** Lower bound of the velocity band the value applies to, when the manufacturer publishes bands. */
  minVelocity: z.ZodOptional<QuantitySchema>
  note: z.ZodOptional<z.ZodString>
}> = ballisticCoefficientParser satisfies Exact<
  typeof ballisticCoefficient,
  typeof ballisticCoefficientParser
>

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

const constructionFieldsParser = z
  .object({
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
        hardness: quantity('dimensionless', z.number().positive()).optional(),
      })
      .optional(),
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
    gasCheck: z.boolean().optional(),
    drivingBands: z.int().positive().optional(),
    unmapped: z.literal(true).optional(),
  })
  .superRefine((c, ctx) => {
    const issue = (path: string[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message })
    if (c.unmapped && hasStructuredField(c)) issue([], 'unmapped excludes the structured fields')
    if (c.gasCheck !== undefined && c.structure !== 'cast')
      issue(['gasCheck'], 'only for a cast bullet')
    if (c.drivingBands && c.structure !== 'monolithic')
      issue(['drivingBands'], 'only for a monolithic bullet')
    if (c.core?.hardness && !contains(leadCoreMaterials, c.core.material))
      issue(['core', 'hardness'], 'only for a lead or lead alloy core')
  })

/**
 * How a bullet is built, as structured fields next to the manufacturer's wording. Values are read from
 * that wording; a field is absent where the wording does not state it. Lead-free is not stored:
 * {@link leadFree} derives it.
 * Inferred type: {@link ConstructionFields}.
 */
export const constructionFields: z.ZodObject<{
  /** The manufacturer's wording as printed. */
  raw: z.ZodString
  structure: z.ZodOptional<
    z.ZodEnum<
      z.core.util.ToEnum<
        | 'cup-and-core'
        | 'bonded'
        | 'partitioned'
        | 'monolithic'
        | 'cast'
        | 'swaged'
        | 'plated'
        | 'frangible'
      >
    >
  >
  core: z.ZodOptional<
    z.ZodObject<{
      material: z.ZodEnum<
        z.core.util.ToEnum<
          | 'lead'
          | 'lead-alloy'
          | 'copper'
          | 'copper-alloy'
          | 'tin'
          | 'tungsten'
          | 'steel'
          | 'compressed-powder'
        >
      >
      /** Brinell hardness number (HBW, ISO 6506-1) of a lead or lead alloy core, a cast bullet's alloy. */
      hardness: z.ZodOptional<QuantitySchema>
    }>
  >
  /** Present when the bullet has a jacket; the material and the wall only where they are stated. */
  jacket: z.ZodOptional<
    z.ZodObject<{
      material: z.ZodOptional<
        z.ZodEnum<
          z.core.util.ToEnum<
            'copper' | 'gilding-metal' | 'copper-clad-steel' | 'copper-plated-steel' | 'steel'
          >
        >
      >
      thickness: z.ZodOptional<QuantitySchema>
    }>
  >
  surface: z.ZodOptional<
    z.ZodArray<
      z.ZodEnum<
        z.core.util.ToEnum<
          | 'moly'
          | 'black-oxide'
          | 'powder-coat'
          | 'polymer-coat'
          | 'paint'
          | 'wax-lube'
          | 'boron-nitride'
          | 'tungsten-disulfide'
          | 'copper-wash'
          | 'lead-wash'
        >
      >
    >
  >
  /** A gas check, the cup on the base of a cast bullet; `false` for a plain base the wording states. */
  gasCheck: z.ZodOptional<z.ZodBoolean>
  /** Number of driving bands of a monolithic bullet with relieved shanks. */
  drivingBands: z.ZodOptional<z.ZodInt>
  /** Set when no structured field could be derived from `raw`; the wording stays as printed. */
  unmapped: z.ZodOptional<z.ZodLiteral<true>>
}> = constructionFieldsParser satisfies Exact<
  typeof constructionFields,
  typeof constructionFieldsParser
>

/** Whether `value` is one of `list`. */
function contains(list: readonly string[], value: string | undefined): boolean {
  return value !== undefined && list.includes(value)
}

/** Whether the wording was read into any structured field. */
function hasStructuredField(c: {
  structure?: string | undefined
  core?: object | undefined
  jacket?: object | undefined
  surface?: string[] | undefined
  gasCheck?: boolean | undefined
  drivingBands?: number | undefined
}): boolean {
  return Boolean(
    c.structure || c.core || c.jacket || c.surface || c.gasCheck !== undefined || c.drivingBands,
  )
}

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
  if (
    contains(leadCoreMaterials, c.core?.material) ||
    c.surface?.some((s) => contains(leadSurfaces, s))
  )
    return false
  const material = c.core?.material
  return material && material !== 'compressed-powder' ? true : undefined
}

/** The fields of a bullet's list item that `bulletListFields` derives from the record. */
export interface BulletListFields {
  /** The first G1 coefficient, lb/in2; null without one. */
  ballisticCoefficientG1: number | null
  /** The first G7 coefficient, lb/in2; null without one. */
  ballisticCoefficientG7: number | null
  tipType: z.infer<typeof tipTypes> | undefined
  baseType: z.infer<typeof baseTypes> | undefined
  /** The structure, else `<material>-core`. */
  construction: string | undefined
  leadFree: boolean | undefined
}

/**
 * The fields a bullet record gives its list item (the API's catalogue rows and the browser's
 * designs): the first G1 and G7 coefficient, null without one (a banded sheet lists the top band
 * first), tip and base type, construction and `leadFree`; undefined where the record has none.
 */
export function bulletListFields(
  b: Pick<Bullet, 'tip' | 'base' | 'construction' | 'ballisticCoefficients'>,
): BulletListFields {
  const first = (model: 'G1' | 'G7') =>
    b.ballisticCoefficients?.find((c) => c.dragModel === model)?.value ?? null
  const material = b.construction?.core?.material
  return {
    ballisticCoefficientG1: first('G1'),
    ballisticCoefficientG7: first('G7'),
    tipType: b.tip?.type,
    baseType: b.base?.type,
    construction: b.construction?.structure ?? (material ? `${material}-core` : undefined),
    leadFree: leadFree(b.construction),
  }
}

const baseTypesParser = z.enum([
  'flat',
  'boat-tail',
  'rebated-boat-tail',
  'conical-hollow-base',
  'rounded-hollow-base',
])

/**
 * Base types of a bullet. `conical-hollow-base` and `rounded-hollow-base`: a cavity open at the base,
 * a cone or a hemisphere whose depth follows from `cavityDiameter` unless a measured `cavityDepth`
 * gives it, on a flat base or on the boat tail the other fields describe.
 */
export const baseTypes: z.ZodEnum<
  z.core.util.ToEnum<
    'flat' | 'boat-tail' | 'rebated-boat-tail' | 'conical-hollow-base' | 'rounded-hollow-base'
  >
> = baseTypesParser satisfies Exact<typeof baseTypes, typeof baseTypesParser>

const ogiveFormsParser = z.enum(['tangent', 'secant', 'hybrid', 'round-nose', 'flat-nose'])

/**
 * Ogive forms of a bullet: `tangent`, `secant` and `hybrid` by the head-shape ratio Rt/R,
 * `round-nose` and `flat-nose` for a nose that is no ogive of revolution.
 */
export const ogiveForms: z.ZodEnum<
  z.core.util.ToEnum<'tangent' | 'secant' | 'hybrid' | 'round-nose' | 'flat-nose'>
> = ogiveFormsParser satisfies Exact<typeof ogiveForms, typeof ogiveFormsParser>

const tipTypesParser = z.enum([
  'hollow-point',
  'polymer-tip',
  'soft-point',
  'full-metal-jacket',
  'open-meplat',
])

/** Tip types of a bullet: the nose construction. */
export const tipTypes: z.ZodEnum<
  z.core.util.ToEnum<
    'hollow-point' | 'polymer-tip' | 'soft-point' | 'full-metal-jacket' | 'open-meplat'
  >
> = tipTypesParser satisfies Exact<typeof tipTypes, typeof tipTypesParser>

/** Whether a base type has a cavity open at the base. */
function hollowBase(type: string | undefined): boolean {
  return type === 'conical-hollow-base' || type === 'rounded-hollow-base'
}

/** Whether a base type is a boat tail without a cavity. */
function boatTail(type: string | undefined): boolean {
  return type === 'boat-tail' || type === 'rebated-boat-tail'
}

/** Whether a base type ends in a base face narrower than the shank: a boat tail or a hollow base. */
function tailedBase(type: string | undefined): boolean {
  return boatTail(type) || hollowBase(type)
}

/** Base of a bullet: type, length, boat-tail base face diameter and angle, hollow-base cavity. */
const bulletBase = z
  .object({
    type: baseTypes.optional(),
    length: quantity('length').optional(),
    diameter: quantity('length', z.number().positive()).optional(),
    angle: quantity('angle', z.number().gt(0).lt(90)).optional(),
    cavityDiameter: quantity('length', z.number().positive()).optional(),
    cavityDepth: quantity('length', z.number().positive()).optional(),
  })
  .superRefine((base, ctx) => {
    const hollow = hollowBase(base.type)
    const tail = tailedBase(base.type)
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message })
    for (const key of ['diameter', 'angle'] as const) {
      if (base[key] && !tail) issue(key, 'only with a boat-tail or hollow base type')
    }
    if (base.cavityDiameter && !hollow) issue('cavityDiameter', 'only with a hollow base type')
    if (base.cavityDepth && !hollow) issue('cavityDepth', 'only with a hollow base type')
    if (hollow && !base.cavityDiameter) issue('cavityDiameter', 'needed by a hollow base type')
  })

/** Ogive of a bullet: at least one of form, radius and Rt/R. */
const bulletOgive = z
  .object({
    form: ogiveForms.optional(),
    radius: quantity('length', z.number().positive()).optional(),
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

/** Tip of a bullet: type, polymer tip length or hollow-point mouth diameter. */
const bulletTip = z
  .object({
    type: tipTypes,
    length: quantity('length', z.number().positive()).optional(),
    mouthDiameter: quantity('length', z.number().positive()).optional(),
  })
  .superRefine((tip, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message })
    if (tip.length && tip.type !== 'polymer-tip') issue('length', 'only for a polymer tip')
    if (tip.mouthDiameter && tip.type !== 'hollow-point')
      issue('mouthDiameter', 'only for a hollow point')
  })

/** The fields of a bullet before its checks across fields. */
const bulletFields = z.object({
  id: recordId,
  manufacturer: recordId,
  productNumber: z.string().min(1).optional(),
  name: z.string().min(1),
  country: countryCode.optional(),
  productLine: z.string().min(1).optional(),
  caliber: z.string().min(1).optional(),
  diameter: quantity('length').optional(),
  mass: quantity('mass'),
  length: quantity('length').optional(),
  base: bulletBase.optional(),
  ogive: bulletOgive.optional(),
  cannelure: bulletCannelure.optional(),
  tip: bulletTip.optional(),
  meplatDiameter: quantity('length', z.number().min(0)).optional(),
  noseLength: quantity('length').optional(),
  baseToOgive: quantity('length').optional(),
  bearingLength: quantity('length').optional(),
  construction: constructionFields.optional(),
  ballisticCoefficients: z.array(ballisticCoefficient).min(1).optional(),
  recommendedTwist: quantity('length').optional(),
  slowestTwist: quantity('length').optional(),
  note: z.string().min(1).optional(),
  nameOnly: z
    .literal(true)
    .describe('A record that only names the bullet: it has no product number.')
    .optional(),
  provenance,
})

type BulletFields = z.infer<typeof bulletFields>
type Issue = (path: string[], message: string) => void

/** A name-only record has no product number; a full one needs a product number and a diameter. */
function identityIssues(b: BulletFields, issue: Issue) {
  if (b.nameOnly) {
    if (b.productNumber !== undefined)
      issue(['productNumber'], 'a name-only record has no product number')
    return
  }
  if (b.productNumber === undefined)
    issue(['productNumber'], 'a full record needs a product number')
  if (b.diameter === undefined) issue(['diameter'], 'a full record needs a diameter')
}

/** Reports `path` when the size `q` is not smaller than `limit`; nothing while either is unknown. */
type Below = (
  path: string[],
  q: { value: number } | undefined,
  limit: number | undefined,
  what: string,
) => void

/** The meplat, base and tip within the diameter, the tip and base within the lengths. */
function sizeIssues(b: BulletFields, below: Below) {
  const d = b.diameter?.value
  const length = b.length?.value
  below(['meplatDiameter'], b.meplatDiameter, d, 'the diameter')
  below(['base', 'diameter'], b.base?.diameter, d, 'the diameter')
  // Only against the diameter: the cited definition relates the mouth to the caliber, not to the meplat.
  below(['tip', 'mouthDiameter'], b.tip?.mouthDiameter, d, 'the diameter')
  below(['tip', 'length'], b.tip?.length, length, 'the length')
  below(['tip', 'length'], b.tip?.length, b.noseLength?.value, 'the nose length')
  below(['base', 'length'], b.base?.length, length, 'the length')
}

/** The cavity within the base diameter, or the diameter where the record gives no base diameter. */
function cavityDiameterIssue(b: BulletFields, below: Below) {
  below(
    ['base', 'cavityDiameter'],
    b.base?.cavityDiameter,
    b.base?.diameter?.value ?? b.diameter?.value,
    b.base?.diameter ? 'the base diameter' : 'the diameter',
  )
}

/** The jacket within the radius. */
function jacketIssue(b: BulletFields, below: Below) {
  const d = b.diameter?.value
  below(
    ['construction', 'jacket', 'thickness'],
    b.construction?.jacket?.thickness,
    d === undefined ? undefined : d / 2,
    'the radius',
  )
}

/** The cavity depth within the length; without a stored depth it is half the opening (`bulletOutline`). */
function cavityDepthIssues(b: BulletFields, issue: Issue, below: Below) {
  below(['base', 'cavityDepth'], b.base?.cavityDepth, b.length?.value, 'the length')
  const cavity = b.base?.cavityDiameter?.value
  if (
    cavity !== undefined &&
    b.base?.cavityDepth === undefined &&
    b.length &&
    !(cavity / 2 < b.length.value)
  )
    issue(
      ['base', 'cavityDiameter'],
      'half of it, the cavity depth, must be smaller than the length',
    )
}

/** Where the shank begins: behind a boat tail where the tail ends, else at the base. */
function shankStart(b: BulletFields): number {
  return boatTail(b.base?.type) ? (b.base?.length?.value ?? 0) : 0
}

/** Where the shank ends: where the nose begins, the length less the nose length; unknown without a length. */
function shankEnd(b: BulletFields): number | undefined {
  return b.length && b.length.value - (b.noseLength?.value ?? 0)
}

/**
 * Refuses a cannelure that leaves the shank, as far as the record gives its ends. The drawing checks
 * the ends the record leaves out.
 */
function cannelureOnShank(b: BulletFields, issue: Issue) {
  const groove = b.cannelure
  if (!groove) return
  if (groove.start.value < shankStart(b) - lengthTolerance)
    issue(['cannelure', 'start'], 'must not lie on the boat tail')
  const end = shankEnd(b)
  if (end !== undefined && groove.start.value + groove.width.value > end + lengthTolerance)
    issue(
      ['cannelure', 'width'],
      b.noseLength ? 'must end before the nose begins' : 'must end within the length',
    )
  if (groove.depth && b.diameter && !(groove.depth.value < b.diameter.value / 2))
    issue(['cannelure', 'depth'], 'must be smaller than the radius')
}

const bulletParser = bulletFields.superRefine((b, ctx) => {
  needsCountrySource(b, ctx)
  const issue: Issue = (path, message) => ctx.addIssue({ code: 'custom', path, message })
  const below: Below = (path, q, limit, what) => {
    if (q && limit !== undefined && !(q.value < limit)) issue(path, `must be smaller than ${what}`)
  }
  identityIssues(b, issue)
  sizeIssues(b, below)
  cavityDiameterIssue(b, below)
  cannelureOnShank(b, issue)
  jacketIssue(b, below)
  cavityDepthIssues(b, issue, below)
})

/** A projectile as its manufacturer sells it. Inferred type: {@link Bullet}. */
export const bullet: z.ZodObject<{
  id: typeof recordId
  /** Id of the manufacturer record. */
  manufacturer: typeof recordId
  /** Product number. Absent only with `nameOnly`. */
  productNumber: z.ZodOptional<z.ZodString>
  name: z.ZodString
  country: z.ZodOptional<z.ZodString>
  productLine: z.ZodOptional<z.ZodString>
  /** Caliber as the manufacturer writes it, for example `.308`. */
  caliber: z.ZodOptional<z.ZodString>
  /** Diameter. Absent only with `nameOnly`; stored only where a source prints one. */
  diameter: z.ZodOptional<QuantitySchema>
  mass: QuantitySchema
  length: z.ZodOptional<QuantitySchema>
  base: z.ZodOptional<
    z.ZodObject<{
      type: z.ZodOptional<typeof baseTypes>
      length: z.ZodOptional<QuantitySchema>
      /**
       * Diameter of the base face at the end of the boat tail (McCoy, ARBRL-TR-02293, 1981, PDF p. 21).
       * Only with a boat-tail or hollow base type.
       */
      diameter: z.ZodOptional<QuantitySchema>
      /**
       * Boat-tail angle: half-angle of the conical boat tail, between its surface and the bullet axis
       * (McCoy, ARBRL-TR-02293, 1981, PDF p. 17). Only with a boat-tail or hollow base type.
       */
      angle: z.ZodOptional<QuantitySchema>
      /** Diameter of the cavity where it opens in the base face. Needed by, and only with, a hollow base type. */
      cavityDiameter: z.ZodOptional<QuantitySchema>
      /**
       * Depth of the cavity from the base face, where it is measured (a section, or the volume of a
       * water or wax fill converted by the shape). Only with a hollow base type; without it the depth
       * is the cavity's radius, an assumption.
       */
      cavityDepth: z.ZodOptional<QuantitySchema>
    }>
  >
  ogive: z.ZodOptional<
    z.ZodObject<{
      /** Optional: a source may give the radius or Rt/R without naming the form. */
      form: z.ZodOptional<typeof ogiveForms>
      /** Ogive radius R: radius of the nose arc in an axial section (McCoy, ARBRL-TR-02293, 1981, PDF p. 13). */
      radius: z.ZodOptional<QuantitySchema>
      /**
       * Head-shape parameter Rt/R: radius of a tangent ogive of the same nose length and diameter
       * over the actual ogive radius; 1 for a tangent ogive, 0 for a cone, between 0 and 1 for a
       * secant ogive (McCoy, ARBRL-TR-02293, 1981, PDF p. 13); 0 and 1 are included.
       */
      radiusRatio: z.ZodOptional<QuantitySchema>
    }>
  >
  cannelure: z.ZodOptional<
    z.ZodObject<{
      start: QuantitySchema
      width: QuantitySchema
      depth: z.ZodOptional<QuantitySchema>
    }>
  >
  tip: z.ZodOptional<
    z.ZodObject<{
      type: typeof tipTypes
      /**
       * Polymer tip: axial length of the part forward of the jacket opening (the head), without the
       * shank seated in the jacket cavity. Mann 1997, p. 1, describes tips as a head and a shaft;
       * US 10,690,463 B2, summary, splits the tip into a main portion forward of the opening and a
       * retention portion in the cavity. Only with tip type `polymer-tip`.
       */
      length: z.ZodOptional<QuantitySchema>
      /**
       * Hollow point: diameter of the front opening of the nose cavity, before impact (US 12,467,728 B2,
       * description: diameter of the front-side opening of the cavity, stated relative to the
       * caliber). Whether it is taken at the inner or the outer edge of the mouth is not stated there.
       * Only with tip type `hollow-point`: that definition covers a hollow point; no source defining
       * the opening of an `open-meplat` tip was found.
       */
      mouthDiameter: z.ZodOptional<QuantitySchema>
    }>
  >
  /** Diameter of the flat at the nose (McCoy, ARBRL-TR-02293, 1981, PDF p. 14); 0 for a sharp point. */
  meplatDiameter: z.ZodOptional<QuantitySchema>
  noseLength: z.ZodOptional<QuantitySchema>
  baseToOgive: z.ZodOptional<QuantitySchema>
  bearingLength: z.ZodOptional<QuantitySchema>
  construction: z.ZodOptional<typeof constructionFields>
  ballisticCoefficients: z.ZodOptional<z.ZodArray<typeof ballisticCoefficient>>
  /** Twist the manufacturer recommends, length per turn. */
  recommendedTwist: z.ZodOptional<QuantitySchema>
  /** Slowest twist the manufacturer allows ("1-10\" or faster"), length per turn. */
  slowestTwist: z.ZodOptional<QuantitySchema>
  note: z.ZodOptional<z.ZodString>
  /**
   * Set on a record that only names a bullet a table prints: no product number and, unless the
   * table prints one, no diameter. Without it `productNumber` and `diameter` are required, so a
   * full record cannot lose them unnoticed.
   */
  nameOnly: z.ZodOptional<z.ZodLiteral<true>>
  /** Where the values of the record come from: a kind and at least one source. */
  provenance: typeof provenance
}> = bulletParser satisfies Exact<typeof bullet, typeof bulletParser>

/** One published coefficient: G1 or G7, value in lb/in2, optional velocity band. */
export interface BallisticCoefficient extends z.infer<typeof ballisticCoefficient> {}
/** A bullet record: geometry in mm, mass in g, published coefficients. */
export interface Bullet extends z.infer<typeof bullet> {}
