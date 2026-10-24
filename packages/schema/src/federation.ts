import { z } from 'zod'
import { recordId } from './ids.ts'
import { provenance } from './provenance.ts'
import { countryCode, positiveLength, sha256 } from './shared.ts'

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
  distance: positiveLength(),
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
  provenance,
})

/** A discipline record of one federation: distance in mm, caliber classes, equivalent international discipline. */
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
  provenance,
})

/** A record placing one discipline on one event of one target face. */
export interface TargetMapping extends z.infer<typeof targetMapping> {}
