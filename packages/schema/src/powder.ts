import { z } from 'zod'
import { needsCountrySource } from './country-source.ts'
import type { Exact } from './exact.ts'
import { needsProvenance } from './field-classes.ts'
import { countryCode } from './fields.ts'
import { recordId } from './ids.ts'
import { type Provenance, provenance, type Source } from './provenance.ts'
import { type QuantityKind, type QuantitySchema, quantity, units } from './units.ts'

/** A computed value with the extremes over the input ranges, in the unit of its quantity. */
function computedRange(kind: QuantityKind) {
  return z
    .object({ value: z.number(), min: z.number(), max: z.number() })
    .meta({ unit: units[kind] })
    .refine((r) => r.min <= r.value && r.value <= r.max, { message: 'needs min <= value <= max' })
}

/** A fitted value with its standard uncertainty, both in the unit of its quantity. */
function estimate(kind: QuantityKind) {
  return z
    .object({ value: z.number(), standardUncertainty: z.number().nonnegative().optional() })
    .meta({ unit: units[kind] })
}

/** As the safety data sheet prints them, in mass %; several printed classes of one ingredient are stored as their union, "<x" closed at x. */
const powderComposition = z
  .array(
    z
      .object({
        name: z.string().min(1),
        cas: z
          .string()
          .regex(/^\d{2,7}-\d{2}-\d$/)
          .optional(),
        min: z.number().min(0).max(100),
        max: z.number().min(0).max(100),
        raw: z.string().min(1).optional(),
      })
      .meta({ unit: units.massFraction })
      .refine((c) => c.min <= c.max, { message: 'needs min <= max' }),
  )
  .min(1)

/** Constant-volume burning at `loadingDensity`: the value at the mean composition, min and max over the composition ranges; the specific energy of M3 is impetus / (gamma - 1). */
const powderThermochemistry = z.object({
  loadingDensity: quantity('density'),
  flameTemperature: computedRange('absoluteTemperature'),
  impetus: computedRange('specificEnergy'),
  gamma: computedRange('dimensionless'),
  molarMass: computedRange('molarMass'),
  covolume: computedRange('specificVolume'),
})

/** Fitted to load tables, with the fixed inputs of the fit (`apps/docs/docs/models/interior-m3.md`, vivacity law with a two-stage form); effective values of the model version, not load data. */
const powderInterior = z.object({
  model: z.literal('m3'),
  fitted: z.array(z.enum(['vivacity', 'energy', 'form.a'])).min(1),
  vivacity: estimate('burnRate'),
  energy: estimate('specificEnergy'),
  gamma: z.number().gt(1),
  covolume: quantity('specificVolume', z.number().nonnegative()),
  density: quantity('density', z.number().positive()),
  pressureExponent: z.number().positive(),
  referencePressure: quantity('pressure', z.number().positive()),
  ignitionPressure: quantity('pressure', z.number().positive()),
  startPressure: quantity('pressure', z.number().nonnegative()).optional(),
  propellantTemperature: quantity('temperature'),
  burnForm: z
    .object({
      kind: z.literal('twoStage'),
      a: estimate('dimensionless'),
      m: z.number(),
      q: z.number().min(0),
      z1: z.number().gt(0).max(1),
    })
    .refine((f) => 1 + f.a.value * f.z1 > 0 && (f.z1 === 1 || f.q < 1), {
      message: 'needs 1 + a z1 > 0, and q < 1 when z1 < 1',
    }),
  resistance: z
    .object({
      stress: quantity('pressure', z.number().nonnegative()),
      oversize: z.number().nonnegative(),
      engraving: z.number().nonnegative(),
    })
    .optional(),
  trainingRows: z.number().int().positive().optional(),
  trainingCartridges: z.number().int().positive().optional(),
})

/** The burn rate scales by exp(sensitivity (T - reference)), with `cold` below the reference temperature and `hot` at and above it (`apps/docs/docs/models/interior-m3.md`, "Temperature of the propellant"). */
const powderTemperatureSensitivity = z.object({
  reference: quantity('absoluteTemperature', z.number().positive()),
  cold: quantity('inverseTemperature'),
  hot: quantity('inverseTemperature'),
})

/** Whether a source of the provenance passes `test`, given the source's own kind or the record's; none without provenance. */
const anySource = (
  p: Provenance | undefined,
  test: (s: Source, kind: Provenance['kind']) => boolean,
): boolean => p?.sources.some((s) => test(s, s.kind ?? p.kind)) ?? false

const powderParser = z
  .object({
    id: recordId,
    manufacturer: recordId,
    name: z.string().min(1),
    aliases: z.array(z.string().min(1)).min(1).optional(),
    country: countryCode.optional(),
    grainForm: z.enum(['ball', 'extruded', 'flake', 'other']).optional(),
    propellantBase: z.enum(['single', 'double', 'triple']).optional(),
    bulkDensity: quantity('density').optional(),
    composition: powderComposition.optional(),
    thermochemistry: powderThermochemistry.optional(),
    interior: powderInterior.optional(),
    temperatureSensitivity: powderTemperatureSensitivity.optional(),
    listedCartridges: z.array(recordId).min(1).optional(),
    note: z.string().min(1).optional(),
    provenance: provenance.optional(),
  })
  .superRefine((p, ctx) => {
    needsCountrySource(p, ctx)
    needsProvenance('powder', p, ctx)
    if (
      p.interior &&
      !anySource(
        p.provenance,
        (s, kind) => kind === 'fitted' && (!s.fields || s.fields.includes('interior')),
      )
    )
      ctx.addIssue({ code: 'custom', path: ['interior'], message: 'needs a fitted source' })
    if (
      p.listedCartridges &&
      !anySource(p.provenance, (s) => s.fields?.includes('listedCartridges') === true)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['listedCartridges'],
        message: 'needs a source with fields listedCartridges',
      })
    if (p.thermochemistry && !p.composition)
      ctx.addIssue({ code: 'custom', path: ['thermochemistry'], message: 'needs a composition' })
    if (p.composition) {
      const sum = (k: 'min' | 'max') => p.composition?.reduce((s, c) => s + c[k], 0) ?? 0
      if (sum('min') > 100 + 1e-9 || sum('max') < 100 - 1e-9)
        ctx.addIssue({
          code: 'custom',
          path: ['composition'],
          message: 'the ranges admit no composition summing to 100 %',
        })
    }
  })

/**
 * A propellant as its manufacturer sells it, with M3 interior parameters where fitted.
 * Inferred type: {@link Powder}.
 */
export const powder: z.ZodObject<{
  id: typeof recordId
  /** Id of the manufacturer record. */
  manufacturer: typeof recordId
  name: z.ZodString
  /** Other names the same powder is sold under, each as brand and name, stated by a manufacturer. */
  aliases: z.ZodOptional<z.ZodArray<z.ZodString>>
  country: z.ZodOptional<z.ZodString>
  /** Grain form: spherical and flattened spherical grains are `ball`; tubes, cylinders and sticks `extruded`. */
  grainForm: z.ZodOptional<z.ZodEnum<z.core.util.ToEnum<'ball' | 'extruded' | 'flake' | 'other'>>>
  propellantBase: z.ZodOptional<z.ZodEnum<z.core.util.ToEnum<'single' | 'double' | 'triple'>>>
  /**
   * Bulk density: mass per volume of uncompressed powder, voids between grains included. It depends
   * on how the volume was filled (thrown by a powder measure, poured, tapped); the source note says
   * how, when the source states it.
   */
  bulkDensity: z.ZodOptional<QuantitySchema>
  composition: z.ZodOptional<
    z.ZodArray<
      z.ZodObject<{
        name: z.ZodString
        cas: z.ZodOptional<z.ZodString>
        min: z.ZodNumber
        max: z.ZodNumber
        raw: z.ZodOptional<z.ZodString>
      }>
    >
  >
  thermochemistry: z.ZodOptional<
    z.ZodObject<{
      loadingDensity: QuantitySchema
      flameTemperature: z.ZodObject<{ value: z.ZodNumber; min: z.ZodNumber; max: z.ZodNumber }>
      impetus: z.ZodObject<{ value: z.ZodNumber; min: z.ZodNumber; max: z.ZodNumber }>
      /** Frozen ratio of specific heats at the flame temperature. */
      gamma: z.ZodObject<{ value: z.ZodNumber; min: z.ZodNumber; max: z.ZodNumber }>
      molarMass: z.ZodObject<{ value: z.ZodNumber; min: z.ZodNumber; max: z.ZodNumber }>
      covolume: z.ZodObject<{ value: z.ZodNumber; min: z.ZodNumber; max: z.ZodNumber }>
    }>
  >
  interior: z.ZodOptional<
    z.ZodObject<{
      model: z.ZodLiteral<'m3'>
      /** The parameters the fit moved; the others are fixed inputs. */
      fitted: z.ZodArray<z.ZodEnum<z.core.util.ToEnum<'vivacity' | 'energy' | 'form.a'>>>
      vivacity: z.ZodObject<{ value: z.ZodNumber; standardUncertainty: z.ZodOptional<z.ZodNumber> }>
      /** Specific energy at constant volume. */
      energy: z.ZodObject<{ value: z.ZodNumber; standardUncertainty: z.ZodOptional<z.ZodNumber> }>
      gamma: z.ZodNumber
      covolume: QuantitySchema
      /** Solid density of the grains. */
      density: QuantitySchema
      pressureExponent: z.ZodNumber
      referencePressure: QuantitySchema
      ignitionPressure: QuantitySchema
      /** Absent: each load had the default of `defaultStartPressure` in core. */
      startPressure: z.ZodOptional<QuantitySchema>
      /** Propellant temperature of the fit. */
      propellantTemperature: QuantitySchema
      burnForm: z.ZodObject<{
        kind: z.ZodLiteral<'twoStage'>
        a: z.ZodObject<{ value: z.ZodNumber; standardUncertainty: z.ZodOptional<z.ZodNumber> }>
        m: z.ZodNumber
        q: z.ZodNumber
        z1: z.ZodNumber
      }>
      /**
       * Bore-resistance constants of the fit (`apps/docs/docs/models/interior-m3.md`, "Bore resistance"): friction
       * stress on the bullet side area, oversize coefficient per percent, engraving fraction of
       * the start pressure. The record's energy and vivacity hold only with this law applied.
       */
      resistance: z.ZodOptional<
        z.ZodObject<{ stress: QuantitySchema; oversize: z.ZodNumber; engraving: z.ZodNumber }>
      >
      /** Training rows and cartridges of the fit; absent without a load-table fit. */
      trainingRows: z.ZodOptional<z.ZodNumber>
      trainingCartridges: z.ZodOptional<z.ZodNumber>
    }>
  >
  /** Burn-rate sensitivity to the propellant temperature; absent: the burn rate does not depend on it. */
  temperatureSensitivity: z.ZodOptional<
    z.ZodObject<{ reference: QuantitySchema; cold: QuantitySchema; hot: QuantitySchema }>
  >
  /**
   * Ids of the cartridge records the manufacturer lists the powder for, as its product page or data
   * sheet does: what the manufacturer says, not a recommendation. Absent: not recorded, never none.
   */
  listedCartridges: z.ZodOptional<z.ZodArray<typeof recordId>>
  note: z.ZodOptional<z.ZodString>
  /**
   * Where the values of the record come from: a kind and at least one source. Absent: the record
   * holds basic fields only ({@link powderBasicFields}).
   */
  provenance: z.ZodOptional<typeof provenance>
}> = powderParser satisfies Exact<typeof powder, typeof powderParser>

/** A powder record: grain form, composition, thermochemistry and M3 interior parameters. */
export interface Powder extends z.infer<typeof powder> {}
