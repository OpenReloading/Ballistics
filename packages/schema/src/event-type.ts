import { z } from 'zod'
import { recordId } from './ids.ts'
import { provenance } from './provenance.ts'
import { positiveLength, sha256 } from './shared.ts'

/**
 * Points of one scoring hit in each zone, for one power factor: the paper zones A, C and D and a
 * scoring metal target (popper or plate).
 */
const zonePoints = z.strictObject({
  A: z.int().nonnegative(),
  C: z.int().nonnegative(),
  D: z.int().nonnegative(),
  metal: z.int().nonnegative(),
})

/**
 * The least power factor of one division for a score to count (`minor`) and to be scored as
 * major (`major`; absent where the division has no major rating).
 */
const powerFactorFloor = z
  .strictObject({
    /** Division as the rule book names it ("Production Optics"). */
    division: z.string().min(1),
    minor: z.int().positive(),
    major: z.int().positive().optional(),
  })
  .refine((p) => p.major === undefined || p.major > p.minor, {
    message: 'the major floor must lie above the minor floor',
    path: ['major'],
  })

/**
 * Hit-factor scoring (IPSC, USPSA): the points of the hits less the penalties, divided by the
 * time, give the hit factor of a stage; the stage points follow from the best hit factor.
 */
export const hitFactorScoring = z.strictObject({
  method: z.literal('hit-factor'),
  /** Points of one hit per zone, for each power factor. */
  points: z.strictObject({ major: zonePoints, minor: zonePoints }),
  /** Points deducted for each penalty. */
  penalties: z.strictObject({
    miss: z.int().positive(),
    noShoot: z.int().positive(),
    procedural: z.int().positive(),
  }),
  /** Most hits on one no-shoot that are penalized; absent: the rule book sets no limit. */
  noShootMaxHits: z.int().positive().optional(),
  /** Power factor floors per division. */
  powerFactors: z.array(powerFactorFloor).min(1),
})

/**
 * Ring scoring (DSB, ISSF style): rings per shot, summed per series and for the event. The ring
 * values come from the target face of the discipline (its target mapping).
 */
export const ringScoring = z.strictObject({
  method: z.literal('rings'),
  /** Id of the one discipline the event type is shot in; absent: the event names its discipline. */
  discipline: recordId.optional(),
  /** Shots of one series; absent: the discipline's `rules.seriesShots`. */
  seriesShots: z.int().positive().optional(),
})

/** How an event type scores: `hit-factor` or `rings`. */
export const eventScoring = z.discriminatedUnion('method', [hitFactorScoring, ringScoring])

/**
 * A magazine limit of one division: the most rounds in a magazine (from the start signal on, as
 * the rule book times it: IPSC at the signal, USPSA after it), the greatest magazine length, or
 * both. `powerFactor`: the limit applies to that power factor only.
 */
const magazineLimit = z
  .strictObject({
    division: z.string().min(1),
    powerFactor: z.enum(['major', 'minor']).optional(),
    maxRounds: z.int().positive().optional(),
    maxLength: positiveLength().optional(),
    /** A condition of the limit in our own words ("170 mm in single stack handguns"). */
    note: z.string().min(1).optional(),
  })
  .refine((m) => m.maxRounds !== undefined || m.maxLength !== undefined, {
    message: 'a magazine limit needs maxRounds or maxLength',
  })

/**
 * A kind of competition event of one federation as its rule book defines it: the scoring, the
 * levels and the limits that matter for scoring and stage checks. Every fact is cited per field
 * in the provenance (`fields`). Model: `apps/docs/docs/data/event-types.md`.
 * Inferred type: {@link EventType}.
 */
export const eventType = z.strictObject({
  id: recordId,
  /** Name of the event type ("IPSC Handgun"). */
  name: z.string().min(1),
  /** Id of the federation whose rule book defines it. */
  federation: recordId,
  /**
   * The rule book the facts are read from. In a record file: the id of its source record, which
   * reading resolves to title, edition, publisher, URL and SHA-256.
   */
  ruleBook: z.strictObject({
    title: z.string().min(1),
    /** Edition, print or date as the document states it. */
    edition: z.string().min(1),
    publisher: z.string().min(1),
    /** An https URL: pages render it as a link. */
    url: z.url({ protocol: /^https$/ }),
    sha256,
  }),
  scoring: eventScoring,
  /** Level names as the rule book prints them, lowest first. */
  levels: z
    .array(z.string().min(1))
    .min(1)
    .refine((l) => new Set(l).size === l.length, { message: 'a level is listed twice' }),
  /** Magazine limits per division; absent: not recorded. */
  magazine: z.array(magazineLimit).min(1).optional(),
  /** Whether the rule book allows moving targets; absent: it does not say. */
  movingTargets: z.boolean().optional(),
  provenance,
})

/** An event type record: federation, rule book, scoring, levels and limits. */
export interface EventType extends z.infer<typeof eventType> {}
/** Hit-factor scoring of an event type: points per zone and power factor, penalties, floors. */
export type HitFactorScoring = z.infer<typeof hitFactorScoring>
/** Ring scoring of an event type: discipline and series length, where fixed. */
export type RingScoring = z.infer<typeof ringScoring>
