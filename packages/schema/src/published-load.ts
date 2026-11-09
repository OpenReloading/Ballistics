import { z } from 'zod'
import type { Exact } from './exact.ts'
import { catalogueRef, recordId } from './ids.ts'
import { primerSizes } from './primer.ts'
import { provenance } from './provenance.ts'
import { pressureMethod } from './standards.ts'
import { type QuantityKind, units } from './units.ts'

/** `raw` is the printed token with its unit (`55 gr`, `13,600 PSI`, `3,30 g / 50 grs`), always present; `value` the printed number in the stored unit of `kind` by the exact factor, to 7 significant digits, never rounded to a nicer figure and never read from another table. */
const printedValue = (kind: QuantityKind, value: z.ZodNumber = z.number()) =>
  z.strictObject({
    value: value.describe(`In ${units[kind]}.`),
    raw: z.string().min(1).describe('The printed value with its unit, as printed.'),
    assumedUnit: z
      .string()
      .min(1)
      .describe('Unit the value was read in where the source prints none; `value` rests on it.')
      .optional(),
  })

/** Like {@link printedValue}, for a printed figure that has no value in the stored unit (`Flush`, CUP). */
const printedText = (kind: QuantityKind, value: z.ZodNumber = z.number()) =>
  printedValue(kind, value).partial({ value: true })

/** Units a pressure is printed in. `CUP` and `LUP` are crusher units, not converted to bar. */
const pressureUnits = z.enum(['bar', 'psi', 'CUP', 'LUP'])

const publishedMarksParser = z.enum([
  'compressed',
  'do-not-reduce',
  'subsonic',
  'reduced-recoil',
  'proof-tested',
])

/**
 * Marks a table prints with a stated meaning. `proof-tested`: tested by a proof house.
 * Inferred type: {@link PublishedMark}.
 */
export const publishedMarks: z.ZodEnum<
  z.core.util.ToEnum<
    'compressed' | 'do-not-reduce' | 'subsonic' | 'reduced-recoil' | 'proof-tested'
  >
> = publishedMarksParser satisfies Exact<typeof publishedMarks, typeof publishedMarksParser>

/** A mark of {@link publishedMarks}. */
export type PublishedMark = z.infer<typeof publishedMarks>

/** Peak pressure of one charge, in the unit the table prints. */
const pressure = z
  .strictObject({
    unit: pressureUnits.describe('Unit the table prints.'),
    peak: printedText('pressure', z.number().positive()),
    method: pressureMethod.describe('Measuring method.').optional(),
    methodBasis: z
      .enum(['stated', 'from-unit'])
      .describe('`stated`: the source names the method. `from-unit`: read from the unit.')
      .optional(),
  })
  .superRefine((p, ctx) => {
    const converts = p.unit === 'bar' || p.unit === 'psi'
    const issue = (path: string[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message })
    if (converts !== (p.peak.value !== undefined))
      issue(['peak', 'value'], 'a value in bar for bar and psi, none for CUP and LUP')
    if ((p.method === undefined) !== (p.methodBasis === undefined))
      issue(['methodBasis'], 'a method and its basis go together')
    if (p.method === 'crusher' && converts) issue(['method'], 'a crusher method prints CUP or LUP')
  })

const velocity = z.strictObject({
  ...printedValue('velocity', z.number().positive()).shape,
  point: z
    .strictObject({
      label: z.string().min(1).describe('The symbol the table prints (`v3`, `V5`, `V0`).'),
      distance: printedValue('length', z.number().nonnegative())
        .describe('Muzzle to the measuring point, where the source defines the symbol.')
        .optional(),
    })
    .describe('Where the velocity applies. Absent where the table says nothing.')
    .optional(),
})

/** One printed charge of a load with the velocity and pressure printed for it. */
const publishedCharge = z.strictObject({
  kind: z
    .enum(['start', 'max', 'single', 'recommended'])
    .describe(
      'The lower and the upper figure of a table, a single load, a load of a reduced table.',
    ),
  charge: printedValue('mass', z.number().positive()),
  velocity: velocity.optional(),
  pressure: pressure.optional(),
  marks: z
    .array(publishedMarks)
    .min(1)
    .describe('Marks the table states a meaning for.')
    .optional(),
  printedMarks: z
    .array(z.string().min(1))
    .min(1)
    .describe('Marks printed without a stated meaning (`F`, `A`, `*`), as printed.')
    .optional(),
})

const publishedPrimerParser = z.strictObject({
  printed: z.string().min(1).describe('The primer as printed, `Demo 101 und 102` whole.'),
  records: z
    .array(catalogueRef('primer'))
    .min(1)
    .describe('Catalogue primers the printed text is an alias of.')
    .optional(),
  size: primerSizes.describe('Size class the printed text states.').optional(),
  magnum: z.boolean().describe('Whether the printed text states a magnum primer.').optional(),
})

/**
 * The primer of a load as the table prints it. `records` is set only through an explicit alias, never
 * by matching; `size` and `magnum` only where the printed text states a size class, never from a
 * model number.
 * Inferred type: {@link PublishedPrimer}.
 */
export const publishedPrimer: z.ZodObject<
  {
    printed: z.ZodString
    records: z.ZodOptional<z.ZodArray<z.ZodString>>
    size: z.ZodOptional<typeof primerSizes>
    magnum: z.ZodOptional<z.ZodBoolean>
  },
  z.core.$strict
> = publishedPrimerParser satisfies Exact<typeof publishedPrimer, typeof publishedPrimerParser>

/** A primer as printed, with the catalogue primers it is an alias of. */
export interface PublishedPrimer extends z.infer<typeof publishedPrimer> {}

const publishedLoadParser = z
  .strictObject({
    id: recordId.describe('Key of the load in its file, without edition or page.'),
    bullet: z.strictObject({
      printed: z.string().min(1).describe('Bullet text as printed: make, type, number.'),
      mass: printedValue('mass', z.number().positive()),
      diameter: printedValue('length', z.number().positive())
        .describe('Diameter where the table prints one.')
        .optional(),
      record: catalogueRef('bullet').optional(),
    }),
    powder: z.strictObject({
      printed: z.string().min(1).describe('Powder name as printed.'),
      record: catalogueRef('powder').optional(),
    }),
    primer: publishedPrimer.optional(),
    case: z.string().min(1).describe('Case as printed.').optional(),
    coal: printedText('length', z.number().positive())
      .extend({ limit: z.enum(['min', 'max']).describe('Printed as a limit.').optional() })
      .optional(),
    barrel: z
      .strictObject({
        length: printedValue('length', z.number().positive()).optional(),
        twist: printedValue('length', z.number().positive())
          .describe('Length of one turn: `1:12"` is 304.8 mm.')
          .optional(),
      })
      .optional(),
    charges: z.array(publishedCharge).min(1).max(4),
    source: z
      .int()
      .min(0)
      .describe(
        'Position in `provenance.sources` of the source that printed this load. Absent: the first.',
      )
      .optional(),
    page: z.string().min(1).describe('Page, anchor or row of the source as printed or linked.'),
    url: z
      .url({ protocol: /^https?$/ })
      .describe('Deep link to the page or row, where it differs from the source URL.')
      .optional(),
  })
  .superRefine((l, ctx) => {
    const kinds = l.charges.map((c) => c.kind)
    const issue = (message: string) => ctx.addIssue({ code: 'custom', path: ['charges'], message })
    if (new Set(kinds).size !== kinds.length) issue('one charge of each kind')
    if (kinds.includes('single') && kinds.length > 1) issue('a single load stands alone')
    // a start charge above the max charge is a plausibility warning of data:validate, kept as printed
  })

/**
 * One load of a table: the recipe printed once, with its charges. The `id` is unique in the file and
 * the loads are sorted by it, so a re-import edits loads in place.
 * Inferred type: {@link PublishedLoad}.
 */
export const publishedLoad: z.ZodObject<
  {
    id: typeof recordId
    bullet: z.ZodObject<
      {
        printed: z.ZodString
        mass: z.ZodObject<
          { value: z.ZodNumber; raw: z.ZodString; assumedUnit: z.ZodOptional<z.ZodString> },
          z.core.$strict
        >
        diameter: z.ZodOptional<
          z.ZodObject<
            { value: z.ZodNumber; raw: z.ZodString; assumedUnit: z.ZodOptional<z.ZodString> },
            z.core.$strict
          >
        >
        record: z.ZodOptional<z.ZodString>
      },
      z.core.$strict
    >
    powder: z.ZodObject<
      { printed: z.ZodString; record: z.ZodOptional<z.ZodString> },
      z.core.$strict
    >
    primer: z.ZodOptional<typeof publishedPrimer>
    case: z.ZodOptional<z.ZodString>
    coal: z.ZodOptional<
      z.ZodObject<
        {
          value: z.ZodOptional<z.ZodNumber>
          raw: z.ZodString
          assumedUnit: z.ZodOptional<z.ZodString>
          limit: z.ZodOptional<z.ZodEnum<z.core.util.ToEnum<'min' | 'max'>>>
        },
        z.core.$strict
      >
    >
    barrel: z.ZodOptional<
      z.ZodObject<
        {
          length: z.ZodOptional<
            z.ZodObject<
              { value: z.ZodNumber; raw: z.ZodString; assumedUnit: z.ZodOptional<z.ZodString> },
              z.core.$strict
            >
          >
          twist: z.ZodOptional<
            z.ZodObject<
              { value: z.ZodNumber; raw: z.ZodString; assumedUnit: z.ZodOptional<z.ZodString> },
              z.core.$strict
            >
          >
        },
        z.core.$strict
      >
    >
    charges: z.ZodArray<
      z.ZodObject<
        {
          kind: z.ZodEnum<z.core.util.ToEnum<'start' | 'max' | 'single' | 'recommended'>>
          charge: z.ZodObject<
            { value: z.ZodNumber; raw: z.ZodString; assumedUnit: z.ZodOptional<z.ZodString> },
            z.core.$strict
          >
          velocity: z.ZodOptional<
            z.ZodObject<
              {
                value: z.ZodNumber
                raw: z.ZodString
                assumedUnit: z.ZodOptional<z.ZodString>
                point: z.ZodOptional<
                  z.ZodObject<
                    {
                      label: z.ZodString
                      distance: z.ZodOptional<
                        z.ZodObject<
                          {
                            value: z.ZodNumber
                            raw: z.ZodString
                            assumedUnit: z.ZodOptional<z.ZodString>
                          },
                          z.core.$strict
                        >
                      >
                    },
                    z.core.$strict
                  >
                >
              },
              z.core.$strict
            >
          >
          pressure: z.ZodOptional<
            z.ZodObject<
              {
                unit: z.ZodEnum<z.core.util.ToEnum<'bar' | 'psi' | 'CUP' | 'LUP'>>
                peak: z.ZodObject<
                  {
                    value: z.ZodOptional<z.ZodNumber>
                    raw: z.ZodString
                    assumedUnit: z.ZodOptional<z.ZodString>
                  },
                  z.core.$strict
                >
                method: z.ZodOptional<typeof pressureMethod>
                methodBasis: z.ZodOptional<z.ZodEnum<z.core.util.ToEnum<'stated' | 'from-unit'>>>
              },
              z.core.$strict
            >
          >
          marks: z.ZodOptional<z.ZodArray<typeof publishedMarks>>
          printedMarks: z.ZodOptional<z.ZodArray<z.ZodString>>
        },
        z.core.$strict
      >
    >
    source: z.ZodOptional<z.ZodInt>
    page: z.ZodString
    url: z.ZodOptional<z.ZodURL>
  },
  z.core.$strict
> = publishedLoadParser satisfies Exact<typeof publishedLoad, typeof publishedLoadParser>

const publishedLoadsParser = z
  .strictObject({
    id: recordId,
    maker: recordId.describe('Manufacturer record that publishes the table.'),
    producedBy: z
      .enum(['maker', 'customer'])
      .describe('Who produced the loads: the maker, or customers who sent them in.'),
    cartridgeName: z.string().min(1).describe('The cartridge as the table prints it.'),
    cartridge: catalogueRef('cartridge'),
    loads: z.array(publishedLoad).min(1),
    provenance: provenance.superRefine((p, ctx) => {
      const issue = (path: (string | number)[], message: string) =>
        ctx.addIssue({ code: 'custom', path, message })
      if (p.kind !== 'published') issue(['kind'], 'a table is published')
      p.sources.forEach((s, i) => {
        for (const k of ['publisher', 'url', 'retrieved', 'origin'] as const)
          if (s[k] === undefined) issue(['sources', i, k], `a table source names its ${k}`)
        if (s.origin === 'manufacturer' && s.license !== undefined) {
          if (!s.license.startsWith('LicenseRef-') || s.terms === undefined)
            issue(
              ['sources', i, 'license'],
              "maker data has no project licence: only the maker's own terms, as LicenseRef-<name> with terms",
            )
        }
      })
    }),
  })
  .superRefine((f, ctx) => {
    f.loads.forEach((l, i) => {
      if (l.source !== undefined && l.source >= f.provenance.sources.length)
        ctx.addIssue({
          code: 'custom',
          path: ['loads', i, 'source'],
          message: 'no such source in provenance.sources',
        })
    })
  })

/**
 * The load rows of one table for one cartridge: `records/loads/<cartridge id>/<id>.json`. A maker's
 * own table has the maker's id as `id`, a table of loads its customers sent `<maker>-customer`.
 * Maker data carries no project licence: a source states the maker as `publisher`, and the maker's
 * terms where it states any.
 * Inferred type: {@link PublishedLoads}.
 */
export const publishedLoads: z.ZodObject<
  {
    id: typeof recordId
    maker: typeof recordId
    producedBy: z.ZodEnum<z.core.util.ToEnum<'maker' | 'customer'>>
    cartridgeName: z.ZodString
    cartridge: z.ZodString
    loads: z.ZodArray<typeof publishedLoad>
    provenance: typeof provenance
  },
  z.core.$strict
> = publishedLoadsParser satisfies Exact<typeof publishedLoads, typeof publishedLoadsParser>

/** One load of a table: bullet, powder, primer, case, COAL and barrel as printed, and its charges. */
export interface PublishedLoad extends z.infer<typeof publishedLoad> {}
/** The load rows of one table for one cartridge, one file of the catalogue. */
export interface PublishedLoads extends z.infer<typeof publishedLoads> {}
