import type { z } from 'zod'

/**
 * Dot paths of the bullet fields a record may hold without provenance: the plain facts a maker prints
 * (name, product number, diameter, weight, length, coefficients, twists, the printed construction
 * wording and the enums mapped from it) and our own `note`. Every other field is detailed and needs
 * provenance. A `note` is our own text and basic in every kind that has one, as in the identity set of
 * the kinds without field classes (`packages/catalog/src/coverage.ts`).
 */
export const bulletBasicFields: readonly string[] = [
  'id',
  'manufacturer',
  'productNumber',
  'name',
  'productLine',
  'caliber',
  'diameter',
  'mass',
  'length',
  'nameOnly',
  'ballisticCoefficients',
  'recommendedTwist',
  'slowestTwist',
  'tip.type',
  'base.type',
  'construction',
  'note',
]

/**
 * Dot paths of the powder fields a record may hold without provenance: name, maker, grain form, base
 * and our own `note` (basic in every kind that has one, see {@link bulletBasicFields}). Every other field is
 * detailed and needs provenance.
 */
export const powderBasicFields: readonly string[] = [
  'id',
  'manufacturer',
  'name',
  'grainForm',
  'propellantBase',
  'note',
]

/**
 * Dot paths of the detailed fields a maker's published source (site, table, catalogue, safety data
 * sheet) may cover: the bullet geometry and the powder composition. A path covers the fields below it.
 * Model values, thermochemistry, listed cartridges and load data never come from a maker source.
 */
export const makerSourceFields: {
  readonly bullet: readonly string[]
  readonly powder: readonly string[]
} = {
  bullet: [
    'base.length',
    'base.diameter',
    'base.angle',
    'base.cavityDiameter',
    'base.cavityDepth',
    'ogive',
    'cannelure',
    'tip.length',
    'tip.mouthDiameter',
    'meplatDiameter',
    'noseLength',
    'baseToOgive',
    'bearingLength',
    'construction.jacket.thickness',
  ],
  powder: ['composition'],
}

/** Detailed paths below a basic one; the longest matching path decides a field's class. */
const detailedBelowBasic = {
  bullet: ['construction.jacket.thickness'],
  powder: [],
} as const satisfies Record<'bullet' | 'powder', readonly string[]>

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * The dot paths of the detailed fields a bullet or powder record holds: every field outside the basic
 * fields of its kind ({@link bulletBasicFields}, {@link powderBasicFields}), where the longest listed
 * path that matches a field decides its class. `provenance` itself is not a field here.
 */
export function detailedFields(kind: 'bullet' | 'powder', record: object): string[] {
  const basic = kind === 'bullet' ? bulletBasicFields : powderBasicFields
  const detailed: readonly string[] = detailedBelowBasic[kind]
  const listed = [...basic, ...detailed]
  const found: string[] = []
  const walk = (value: object, prefix: string, inherited: boolean) => {
    for (const [key, v] of Object.entries(value)) {
      const path = prefix + key
      if (v === undefined || path === 'provenance') continue
      const isBasic = basic.includes(path) || (inherited && !detailed.includes(path))
      if (isPlainObject(v) && listed.some((p) => p.startsWith(`${path}.`)))
        walk(v, `${path}.`, isBasic)
      else if (!isBasic) found.push(path)
    }
  }
  walk(record, '', false)
  return found
}

/** Refuses each detailed field of a record without provenance; basic fields need no source. */
export function needsProvenance(
  kind: 'bullet' | 'powder',
  record: { provenance?: unknown },
  ctx: z.RefinementCtx,
): void {
  if (record.provenance !== undefined) return
  for (const field of detailedFields(kind, record))
    ctx.addIssue({
      code: 'custom',
      path: field.split('.'),
      message: `${field} is a detailed field: needs provenance`,
    })
}
