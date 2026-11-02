import { z } from 'zod'
import { recordId } from './ids.ts'
import { provenance } from './provenance.ts'
import { countryCode, positiveLength, sha256 } from './shared.ts'
import { quantity, units } from './units.ts'

/**
 * Kind of discipline an event belongs to. One face serves several: the ISSF 25 m face carries
 * pistol, service pistol and rifle events.
 */
export const disciplineCategory = z.enum([
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
 * A shooting sport federation as its rule books name it, with the rule books its disciplines and
 * target faces are read from. Model: `apps/docs/docs/data/federations.md`.
 * Inferred type: {@link Federation}.
 */
export const federation = z.strictObject({
  id: recordId,
  /** Full name as the rule book prints it. */
  name: z.string().min(1),
  /** Short name as the rule books and faces print it ("ISSF", "DSB"). */
  abbreviation: z.string().min(1),
  /** ISO 3166-1 alpha-2 code of the federation's country, `international` for a world body. */
  country: z.union([z.literal('international'), countryCode]),
  /** Id of the international federation the rule book names this one a member of. */
  internationalFederation: recordId.optional(),
  /** An https URL of the federation's own homepage: pages render it as a link. */
  website: z.url({ protocol: /^https$/ }).optional(),
  /** The federation's rule books that the records cite. */
  ruleBooks: z
    .array(
      z.strictObject({
        title: z.string().min(1),
        /** Edition, print or date as the document states it. */
        edition: z.string().min(1),
        /** An https URL: pages render it as a link. */
        url: z.url({ protocol: /^https$/ }),
        sha256,
      }),
    )
    .min(1),
  provenance,
})

/** A shooting sport federation record with its rule books. */
export interface Federation extends z.infer<typeof federation> {}

/** Number of sighting shots a rule book allows: a count, or `unlimited` where it states any number. */
const sighters = z.union([z.int().nonnegative(), z.literal('unlimited')])

/**
 * A time the rule book allows and what it covers. `includesSighters`: the time also covers the
 * sighting shots; absent: not stated.
 */
const timeLimit = z.strictObject({
  duration: quantity('time', z.number().positive()),
  covers: z.enum(['discipline', 'stage', 'series', 'shot']),
  includesSighters: z.boolean().optional(),
})

/**
 * The course of fire facts a rule book states for a whole discipline or for one stage of it. A
 * stage value replaces the discipline's.
 */
const courseOfFire = {
  /** Sighting shots before the shots for score. */
  sighters: sighters.optional(),
  /** Shots of one series, where the score is split into series. */
  seriesShots: z.int().positive().optional(),
  timeLimits: z.array(timeLimit).min(1).optional(),
}

/**
 * What a discipline's rule book states about firearm, position, sights, course of fire and
 * ammunition. Every field is optional and absent means the rule book does not state it. Each
 * field is cited with its own source and page in the provenance (`fields`: `rules.<name>`).
 * Inferred type: {@link DisciplineRules}.
 */
export const disciplineRules = z.strictObject({
  /** Short guns are handguns, long guns are shoulder-fired. */
  firearm: z.enum(['short-gun', 'long-gun']).optional(),
  /** Actions the discipline allows. */
  actions: z
    .array(z.enum(['single-shot', 'repeater', 'semi-automatic', 'revolver', 'lever-action']))
    .min(1)
    .optional(),
  /** Positions the shooter may take. */
  positions: z
    .array(z.enum(['standing', 'kneeling', 'sitting', 'prone']))
    .min(1)
    .optional(),
  /** How the firearm may be supported: by hand only, with a sling, on a rest. */
  supports: z
    .array(z.enum(['freehand', 'sling', 'rest']))
    .min(1)
    .optional(),
  /** Sights the discipline allows; `original`: those the firearm was issued with. */
  sights: z
    .array(z.enum(['original', 'open', 'aperture', 'optical', 'reflex']))
    .min(1)
    .optional(),
  /** Greatest magnification of an optical sight. */
  maxMagnification: quantity('dimensionless', z.number().positive()).optional(),
  /** Least trigger pull weight at release, as a mass. */
  minTriggerWeight: quantity('mass', z.number().positive()).optional(),
  maxBarrelLength: positiveLength().optional(),
  /** Greatest mass of the firearm as shot. */
  maxFirearmMass: quantity('mass', z.number().positive()).optional(),
  ammunition: z
    .strictObject({
      /** Whether handloaded (reloaded) ammunition is allowed. */
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

/** The rule facts of a discipline. */
export interface DisciplineRules extends z.infer<typeof disciplineRules> {}

/**
 * The unit a rule book states a discipline's distance in: metres, yards, or both
 * ("50 Meter/Yards"), where the same number applies to each.
 */
export const distanceUnit = z.enum(['m', 'yd', 'm/yd'])

/**
 * A discipline (match, course of fire) of one federation as its rule book defines it.
 * Inferred type: {@link Discipline}.
 */
export const discipline = z.strictObject({
  id: recordId,
  /** Id of the federation whose rule book defines the discipline. */
  federation: recordId,
  /** Name as the rule book prints it. */
  name: z.string().min(1),
  /** Discipline number or code where the rule book prints one ("2113", "SG 1"). */
  number: z.string().min(1).optional(),
  /** Section of the rule book that defines the discipline. */
  section: z.string().min(1),
  /** Page of that section (printed page, PDF page). */
  page: z.string().min(1),
  /**
   * Distance in mm. `unit` is the unit the rule book states: the number is as printed, so `m/yd`
   * keeps the metric reading in `value` and a yards-only record holds the yards converted.
   */
  distance: positiveLength().extend({ unit: distanceUnit }).meta({ unit: units.length }),
  /** Kind of firearm, where the rule book states it. */
  category: disciplineCategory.optional(),
  /**
   * The caliber classes the discipline allows, by id of a `CaliberClass` record. `stated`: the
   * rule book names them; `derived`: our expansion of a stated range or gauge to the classes whose
   * diameter lies in it.
   */
  caliberClasses: z
    .strictObject({
      ids: z.array(recordId).min(1),
      basis: z.enum(['stated', 'derived']),
    })
    .optional(),
  /** Id of the discipline of the international federation the rule book names as equivalent. */
  internationalDiscipline: recordId.optional(),
  /** Rule facts per the rule book; a stage's own are on its target mapping. */
  rules: disciplineRules.optional(),
  provenance,
})

/** A discipline record of one federation, distance in mm. */
export interface Discipline extends z.infer<typeof discipline> {}

/**
 * A discipline shot on a target face: the face, the face event that scores it, and where the rule
 * book states them, the stage, the gauge and the number of shots.
 * Inferred type: {@link TargetMapping}.
 */
export const targetMapping = z.strictObject({
  id: recordId,
  /** Id of the `Discipline` record that this face event scores. */
  discipline: recordId,
  /** Id of the target face record. */
  face: recordId,
  /** Id of the face's event (`events[].id` of the face record) that scores the discipline on this face. */
  event: recordId,
  /** Part of the discipline shot on this face ("precision stage"); absent: the whole discipline. */
  stage: z.string().min(1).optional(),
  /** Diameter of the hole as scored, where the rule book fixes one for the discipline. */
  gauge: positiveLength().optional(),
  /** Shots that count on this face in the discipline (or stage), where the rule book states it. */
  shotCount: z.int().positive().optional(),
  ...courseOfFire,
  provenance,
})

/** A record placing one discipline on one event of one target face. */
export interface TargetMapping extends z.infer<typeof targetMapping> {}
