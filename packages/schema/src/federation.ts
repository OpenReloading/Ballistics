import { z } from 'zod'
import type { Exact } from './exact.ts'
import { countryCode, positiveLength, sha256 } from './fields.ts'
import { recordId } from './ids.ts'
import { provenance } from './provenance.ts'
import { type QuantitySchema, quantity, units } from './units.ts'

const disciplineCategoryParser = z.enum([
  'air-rifle',
  'air-pistol',
  'rifle',
  'precision-rifle',
  'service-rifle',
  'lever-action',
  'carbine',
  'pistol',
  'service-pistol',
  'revolver',
  'muzzle-loader',
])

/**
 * Kind of discipline an event belongs to. One face serves several: the ISSF 25 m face carries
 * pistol, service pistol and rifle events.
 */
export const disciplineCategory: z.ZodEnum<
  z.core.util.ToEnum<
    | 'air-rifle'
    | 'air-pistol'
    | 'rifle'
    | 'precision-rifle'
    | 'service-rifle'
    | 'lever-action'
    | 'carbine'
    | 'pistol'
    | 'service-pistol'
    | 'revolver'
    | 'muzzle-loader'
  >
> = disciplineCategoryParser satisfies Exact<
  typeof disciplineCategory,
  typeof disciplineCategoryParser
>

const federationParser = z.strictObject({
  id: recordId,
  name: z.string().min(1),
  abbreviation: z.string().min(1),
  country: z.union([z.literal('international'), countryCode]),
  internationalFederation: recordId.optional(),
  website: z.url({ protocol: /^https$/ }).optional(),
  ruleBooks: z
    .array(
      z.strictObject({
        title: z.string().min(1),
        edition: z.string().min(1),
        url: z.url({ protocol: /^https$/ }),
        sha256,
      }),
    )
    .min(1),
  provenance: provenance.optional(),
})

/**
 * A shooting sport federation as its rule books name it, with the rule books its disciplines and
 * target faces are read from. Model: `apps/docs/docs/data/federations.md`.
 * Inferred type: {@link Federation}.
 */
export const federation: z.ZodObject<
  {
    id: typeof recordId
    /** Full name as the rule book prints it. */
    name: z.ZodString
    /** Short name as the rule books and faces print it ("ISSF", "DSB"). */
    abbreviation: z.ZodString
    /** ISO 3166-1 alpha-2 code of the federation's country, `international` for a world body. */
    country: z.ZodUnion<readonly [z.ZodLiteral<'international'>, z.ZodString]>
    /** Id of the international federation the rule book names this one a member of. */
    internationalFederation: z.ZodOptional<typeof recordId>
    /** An https URL of the federation's own homepage: pages render it as a link. */
    website: z.ZodOptional<z.ZodURL>
    /** The federation's rule books that the records cite. */
    ruleBooks: z.ZodArray<
      z.ZodObject<
        {
          title: z.ZodString
          /** Edition, print or date as the document states it. */
          edition: z.ZodString
          /** An https URL: pages render it as a link. */
          url: z.ZodURL
          /** SHA-256 of a file: 64 lowercase hex digits. */
          sha256: z.ZodString
        },
        z.core.$strict
      >
    >
    /** Where the values of the record come from, wherever the record has a source: a kind and at least one source. */
    provenance: z.ZodOptional<typeof provenance>
  },
  z.core.$strict
> = federationParser satisfies Exact<typeof federation, typeof federationParser>

/** A shooting sport federation record with its rule books. */
export interface Federation extends z.infer<typeof federation> {}

/** Number of sighting shots a rule book allows: a count, or `unlimited` where it states any number. */
const sighters = z.union([z.int().nonnegative(), z.literal('unlimited')])

/** `includesSighters`: the time also covers the sighting shots; absent: not stated. */
const timeLimit = z.strictObject({
  duration: quantity('time', z.number().positive()),
  covers: z.enum(['discipline', 'stage', 'series', 'shot']),
  includesSighters: z.boolean().optional(),
})

/** For a whole discipline or for one stage of it; a stage value replaces the discipline's. */
const courseOfFire = {
  sighters: sighters.optional(),
  seriesShots: z.int().positive().optional(),
  timeLimits: z.array(timeLimit).min(1).optional(),
}

const disciplineRulesParser = z.strictObject({
  firearm: z.enum(['short-gun', 'long-gun']).optional(),
  actions: z
    .array(z.enum(['single-shot', 'repeater', 'semi-automatic', 'revolver', 'lever-action']))
    .min(1)
    .optional(),
  positions: z
    .array(z.enum(['standing', 'kneeling', 'sitting', 'prone']))
    .min(1)
    .optional(),
  supports: z
    .array(z.enum(['freehand', 'sling', 'rest']))
    .min(1)
    .optional(),
  sights: z
    .array(z.enum(['original', 'open', 'aperture', 'optical', 'reflex']))
    .min(1)
    .optional(),
  maxMagnification: quantity('dimensionless', z.number().positive()).optional(),
  minTriggerWeight: quantity('mass', z.number().positive()).optional(),
  maxBarrelLength: positiveLength().optional(),
  maxFirearmMass: quantity('mass', z.number().positive()).optional(),
  ammunition: z
    .strictObject({
      handloads: z.boolean().optional(),
      minMuzzleEnergy: quantity('energy', z.number().positive()).optional(),
      minBulletMass: quantity('mass', z.number().positive()).optional(),
      maxBulletMass: quantity('mass', z.number().positive()).optional(),
      bulletTypes: z
        .array(z.enum(['lead', 'jacketed', 'full-metal-jacket', 'hollow-point', 'wadcutter']))
        .min(1)
        .optional(),
    })
    .optional(),
  ...courseOfFire,
})

/**
 * What a discipline's rule book states about firearm, position, sights, course of fire and
 * ammunition. Every field is optional and absent means the rule book does not state it. Each
 * field is cited with its own source and page in the provenance (`fields`: `rules.<name>`).
 * Inferred type: {@link DisciplineRules}.
 */
export const disciplineRules: z.ZodObject<
  {
    /** Short guns are handguns, long guns are shoulder-fired. */
    firearm: z.ZodOptional<z.ZodEnum<z.core.util.ToEnum<'short-gun' | 'long-gun'>>>
    /** Actions the discipline allows. */
    actions: z.ZodOptional<
      z.ZodArray<
        z.ZodEnum<
          z.core.util.ToEnum<
            'single-shot' | 'repeater' | 'semi-automatic' | 'revolver' | 'lever-action'
          >
        >
      >
    >
    /** Positions the shooter may take. */
    positions: z.ZodOptional<
      z.ZodArray<z.ZodEnum<z.core.util.ToEnum<'standing' | 'kneeling' | 'sitting' | 'prone'>>>
    >
    /** How the firearm may be supported: by hand only, with a sling, on a rest. */
    supports: z.ZodOptional<
      z.ZodArray<z.ZodEnum<z.core.util.ToEnum<'freehand' | 'sling' | 'rest'>>>
    >
    /** Sights the discipline allows; `original`: those the firearm was issued with. */
    sights: z.ZodOptional<
      z.ZodArray<
        z.ZodEnum<z.core.util.ToEnum<'original' | 'open' | 'aperture' | 'optical' | 'reflex'>>
      >
    >
    /** Greatest magnification of an optical sight. */
    maxMagnification: z.ZodOptional<QuantitySchema>
    /** Least trigger pull weight at release, as a mass. */
    minTriggerWeight: z.ZodOptional<QuantitySchema>
    maxBarrelLength: z.ZodOptional<QuantitySchema>
    /** Greatest mass of the firearm as shot. */
    maxFirearmMass: z.ZodOptional<QuantitySchema>
    ammunition: z.ZodOptional<
      z.ZodObject<
        {
          /** Whether handloaded (reloaded) ammunition is allowed. */
          handloads: z.ZodOptional<z.ZodBoolean>
          minMuzzleEnergy: z.ZodOptional<QuantitySchema>
          minBulletMass: z.ZodOptional<QuantitySchema>
          maxBulletMass: z.ZodOptional<QuantitySchema>
          bulletTypes: z.ZodOptional<
            z.ZodArray<
              z.ZodEnum<
                z.core.util.ToEnum<
                  'lead' | 'jacketed' | 'full-metal-jacket' | 'hollow-point' | 'wadcutter'
                >
              >
            >
          >
        },
        z.core.$strict
      >
    >
    /** Sighting shots before the shots for score. */
    sighters: z.ZodOptional<z.ZodUnion<readonly [z.ZodInt, z.ZodLiteral<'unlimited'>]>>
    /** Shots of one series, where the score is split into series. */
    seriesShots: z.ZodOptional<z.ZodInt>
    timeLimits: z.ZodOptional<
      z.ZodArray<
        z.ZodObject<
          {
            duration: QuantitySchema
            covers: z.ZodEnum<z.core.util.ToEnum<'discipline' | 'stage' | 'series' | 'shot'>>
            includesSighters: z.ZodOptional<z.ZodBoolean>
          },
          z.core.$strict
        >
      >
    >
  },
  z.core.$strict
> = disciplineRulesParser satisfies Exact<typeof disciplineRules, typeof disciplineRulesParser>

/** The rule facts of a discipline. */
export interface DisciplineRules extends z.infer<typeof disciplineRules> {}

const distanceUnitParser = z.enum(['m', 'yd', 'm/yd'])

/**
 * The unit a rule book states a discipline's distance in: meters, yards, or both
 * ("50 Meter/Yards"), where the same number applies to each.
 */
export const distanceUnit: z.ZodEnum<z.core.util.ToEnum<'m' | 'yd' | 'm/yd'>> =
  distanceUnitParser satisfies Exact<typeof distanceUnit, typeof distanceUnitParser>

const disciplineParser = z.strictObject({
  id: recordId,
  federation: recordId,
  name: z.string().min(1),
  number: z.string().min(1).optional(),
  section: z.string().min(1),
  page: z.string().min(1),
  distance: positiveLength().extend({ unit: distanceUnit }).meta({ unit: units.length }),
  category: disciplineCategory.optional(),
  caliberClasses: z
    .strictObject({
      ids: z.array(recordId).min(1),
      basis: z.enum(['stated', 'derived']),
    })
    .optional(),
  internationalDiscipline: recordId.optional(),
  rules: disciplineRules.optional(),
  provenance: provenance.optional(),
})

/**
 * A discipline (match, course of fire) of one federation as its rule book defines it.
 * Inferred type: {@link Discipline}.
 */
export const discipline: z.ZodObject<
  {
    id: typeof recordId
    /** Id of the federation whose rule book defines the discipline. */
    federation: typeof recordId
    /** Name as the rule book prints it. */
    name: z.ZodString
    /** Discipline number or code where the rule book prints one ("2113", "SG 1"). */
    number: z.ZodOptional<z.ZodString>
    /** Section of the rule book that defines the discipline. */
    section: z.ZodString
    /** Page of that section (printed page, PDF page). */
    page: z.ZodString
    /**
     * Distance in mm. `unit` is the unit the rule book states: the number is as printed, so `m/yd`
     * keeps the metric reading in `value` and a yards-only record holds the yards converted.
     */
    distance: z.ZodObject<{
      value: z.ZodNumber
      raw: z.ZodOptional<z.ZodString>
      unit: typeof distanceUnit
    }>
    /** Kind of firearm, where the rule book states it. */
    category: z.ZodOptional<typeof disciplineCategory>
    /**
     * The caliber classes the discipline allows, by id of a `CaliberClass` record. `stated`: the
     * rule book names them; `derived`: our expansion of a stated range or gauge to the classes whose
     * diameter lies in it.
     */
    caliberClasses: z.ZodOptional<
      z.ZodObject<
        {
          ids: z.ZodArray<typeof recordId>
          basis: z.ZodEnum<z.core.util.ToEnum<'stated' | 'derived'>>
        },
        z.core.$strict
      >
    >
    /** Id of the discipline of the international federation the rule book names as equivalent. */
    internationalDiscipline: z.ZodOptional<typeof recordId>
    /** Rule facts per the rule book; a stage's own are on its target mapping. */
    rules: z.ZodOptional<typeof disciplineRules>
    /** Where the values of the record come from, wherever the record has a source: a kind and at least one source. */
    provenance: z.ZodOptional<typeof provenance>
  },
  z.core.$strict
> = disciplineParser satisfies Exact<typeof discipline, typeof disciplineParser>

/** A discipline record of one federation, distance in mm. */
export interface Discipline extends z.infer<typeof discipline> {}

const targetMappingParser = z.strictObject({
  id: recordId,
  discipline: recordId,
  face: recordId,
  event: recordId,
  stage: z.string().min(1).optional(),
  gauge: positiveLength().optional(),
  shotCount: z.int().positive().optional(),
  ...courseOfFire,
  provenance: provenance.optional(),
})

/**
 * A discipline shot on a target face: the face, the face event that scores it, and where the rule
 * book states them, the stage, the gauge and the number of shots.
 * Inferred type: {@link TargetMapping}.
 */
export const targetMapping: z.ZodObject<
  {
    id: typeof recordId
    /** Id of the `Discipline` record that this face event scores. */
    discipline: typeof recordId
    /** Id of the target face record. */
    face: typeof recordId
    /** Id of the face's event (`events[].id` of the face record) that scores the discipline on this face. */
    event: typeof recordId
    /** Part of the discipline shot on this face ("precision stage"); absent: the whole discipline. */
    stage: z.ZodOptional<z.ZodString>
    /** Diameter of the hole as scored, where the rule book fixes one for the discipline. */
    gauge: z.ZodOptional<QuantitySchema>
    /** Shots that count on this face in the discipline (or stage), where the rule book states it. */
    shotCount: z.ZodOptional<z.ZodInt>
    /** Sighting shots before the shots for score. */
    sighters: z.ZodOptional<z.ZodUnion<readonly [z.ZodInt, z.ZodLiteral<'unlimited'>]>>
    /** Shots of one series, where the score is split into series. */
    seriesShots: z.ZodOptional<z.ZodInt>
    timeLimits: z.ZodOptional<
      z.ZodArray<
        z.ZodObject<
          {
            duration: QuantitySchema
            covers: z.ZodEnum<z.core.util.ToEnum<'discipline' | 'stage' | 'series' | 'shot'>>
            includesSighters: z.ZodOptional<z.ZodBoolean>
          },
          z.core.$strict
        >
      >
    >
    /** Where the values of the record come from, wherever the record has a source: a kind and at least one source. */
    provenance: z.ZodOptional<typeof provenance>
  },
  z.core.$strict
> = targetMappingParser satisfies Exact<typeof targetMapping, typeof targetMappingParser>

/** A record placing one discipline on one event of one target face. */
export interface TargetMapping extends z.infer<typeof targetMapping> {}
