import { z } from 'zod'
import { recordId } from './ids.ts'
import { provenance } from './provenance.ts'
import { countryCode, needsCountrySource } from './shared.ts'
import { type QuantityKind, quantity, units } from './units.ts'

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

/**
 * Ingredients as the safety data sheet prints them, in mass %. Several printed classes of one
 * ingredient are stored as their union; "<x" is closed at x.
 */
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

/**
 * Constant-volume burning at `loadingDensity` from the composition: value at
 * the mean composition, min and max over the composition ranges. The specific energy of the M3
 * interior model is impetus / (gamma - 1).
 */
const powderThermochemistry = z.object({
  loadingDensity: quantity('density'),
  flameTemperature: computedRange('absoluteTemperature'),
  impetus: computedRange('specificEnergy'),
  /** Frozen ratio of specific heats at the flame temperature. */
  gamma: computedRange('dimensionless'),
  molarMass: computedRange('molarMass'),
  covolume: computedRange('specificVolume'),
})

/**
 * M3 interior parameters (`apps/docs/docs/models/interior-m3.md`, vivacity law with a two-stage form)
 * fitted to load tables, with the fixed inputs of the fit.
 * Effective values of the model version: not load data.
 */
const powderInterior = z.object({
  model: z.literal('m3'),
  /** The parameters the fit moved; the others are fixed inputs. */
  fitted: z.array(z.enum(['vivacity', 'energy', 'form.a'])).min(1),
  vivacity: estimate('burnRate'),
  /** Specific energy at constant volume. */
  energy: estimate('specificEnergy'),
  gamma: z.number().gt(1),
  covolume: quantity('specificVolume', z.number().nonnegative()),
  /** Solid density of the grains. */
  density: quantity('density', z.number().positive()),
  pressureExponent: z.number().positive(),
  referencePressure: quantity('pressure', z.number().positive()),
  ignitionPressure: quantity('pressure', z.number().positive()),
  /** Absent: each load had the default of `defaultStartPressure` in core. */
  startPressure: quantity('pressure', z.number().nonnegative()).optional(),
  /** Propellant temperature of the fit. */
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
  /**
   * Bore-resistance constants of the fit (`apps/docs/docs/models/interior-m3.md`, "Bore resistance"): friction
   * stress on the bullet side area, oversize coefficient per percent, engraving fraction of
   * the start pressure. The record's energy and vivacity hold only with this law applied.
   */
  resistance: z
    .object({
      stress: quantity('pressure', z.number().nonnegative()),
      oversize: z.number().nonnegative(),
      engraving: z.number().nonnegative(),
    })
    .optional(),
  /** Training rows and cartridges of the fit; absent without a load-table fit. */
  trainingRows: z.number().int().positive().optional(),
  trainingCartridges: z.number().int().positive().optional(),
})

/**
 * A propellant as its manufacturer sells it, with M3 interior parameters where fitted.
 * Inferred type: {@link Powder}.
 */
export const powder = z
  .object({
    id: recordId,
    /** Id of the manufacturer record. */
    manufacturer: recordId,
    name: z.string().min(1),
    /** Other names the same powder is sold under, each as brand and name, stated by a manufacturer. */
    aliases: z.array(z.string().min(1)).min(1).optional(),
    country: countryCode.optional(),
    /** Grain form: spherical and flattened spherical grains are `ball`; tubes, cylinders and sticks `extruded`. */
    grainForm: z.enum(['ball', 'extruded', 'flake', 'other']).optional(),
    propellantBase: z.enum(['single', 'double', 'triple']).optional(),
    /**
     * Bulk density: mass per volume of uncompressed powder, voids between grains included. It depends
     * on how the volume was filled (thrown by a powder measure, poured, tapped); the source note says
     * how, when the source states it.
     */
    bulkDensity: quantity('density').optional(),
    composition: powderComposition.optional(),
    thermochemistry: powderThermochemistry.optional(),
    interior: powderInterior.optional(),
    note: z.string().min(1).optional(),
    provenance,
  })
  .superRefine((p, ctx) => {
    needsCountrySource(p, ctx)
    if (
      p.interior &&
      !p.provenance.sources.some(
        (s) =>
          (s.kind ?? p.provenance.kind) === 'fitted' &&
          (!s.fields || s.fields.includes('interior')),
      )
    )
      ctx.addIssue({ code: 'custom', path: ['interior'], message: 'needs a fitted source' })
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

/** A powder record: grain form, composition, thermochemistry and M3 interior parameters. */
export interface Powder extends z.infer<typeof powder> {}
