import { z } from 'zod'
import type { Exact } from './exact.ts'
import { recordId } from './ids.ts'
import { provenance } from './provenance.ts'
import { positiveLength, sha256 } from './shared.ts'
import type { QuantitySchema } from './units.ts'

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
    division: z.string().min(1),
    minor: z.int().positive(),
    major: z.int().positive().optional(),
  })
  .refine((p) => p.major === undefined || p.major > p.minor, {
    message: 'the major floor must lie above the minor floor',
    path: ['major'],
  })

const hitFactorScoringParser = z.strictObject({
  method: z.literal('hit-factor'),
  points: z.strictObject({ major: zonePoints, minor: zonePoints }),
  penalties: z.strictObject({
    miss: z.int().positive(),
    noShoot: z.int().positive(),
    procedural: z.int().positive(),
  }),
  noShootMaxHits: z.int().positive().optional(),
  powerFactors: z.array(powerFactorFloor).min(1),
})

/**
 * Hit-factor scoring (IPSC, USPSA): the points of the hits less the penalties, divided by the
 * time, give the hit factor of a stage; the stage points follow from the best hit factor.
 */
export const hitFactorScoring: z.ZodObject<
  {
    method: z.ZodLiteral<'hit-factor'>
    /** Points of one hit per zone, for each power factor. */
    points: z.ZodObject<
      {
        major: z.ZodObject<
          { A: z.ZodInt; C: z.ZodInt; D: z.ZodInt; metal: z.ZodInt },
          z.core.$strict
        >
        minor: z.ZodObject<
          { A: z.ZodInt; C: z.ZodInt; D: z.ZodInt; metal: z.ZodInt },
          z.core.$strict
        >
      },
      z.core.$strict
    >
    /** Points deducted for each penalty. */
    penalties: z.ZodObject<
      { miss: z.ZodInt; noShoot: z.ZodInt; procedural: z.ZodInt },
      z.core.$strict
    >
    /** Most hits on one no-shoot that are penalized; absent: the rule book sets no limit. */
    noShootMaxHits: z.ZodOptional<z.ZodInt>
    /** Power factor floors per division. */
    powerFactors: z.ZodArray<
      z.ZodObject<
        {
          /** Division as the rule book names it ("Production Optics"). */
          division: z.ZodString
          minor: z.ZodInt
          major: z.ZodOptional<z.ZodInt>
        },
        z.core.$strict
      >
    >
  },
  z.core.$strict
> = hitFactorScoringParser satisfies Exact<typeof hitFactorScoring, typeof hitFactorScoringParser>

const ringScoringParser = z.strictObject({
  method: z.literal('rings'),
  discipline: recordId.optional(),
  seriesShots: z.int().positive().optional(),
})

/**
 * Ring scoring (DSB, ISSF style): rings per shot, summed per series and for the event. The ring
 * values come from the target face of the discipline (its target mapping).
 */
export const ringScoring: z.ZodObject<
  {
    method: z.ZodLiteral<'rings'>
    /** Id of the one discipline the event type is shot in; absent: the event names its discipline. */
    discipline: z.ZodOptional<typeof recordId>
    /** Shots of one series; absent: the discipline's `rules.seriesShots`. */
    seriesShots: z.ZodOptional<z.ZodInt>
  },
  z.core.$strict
> = ringScoringParser satisfies Exact<typeof ringScoring, typeof ringScoringParser>

const eventScoringParser = z.discriminatedUnion('method', [hitFactorScoring, ringScoring])

/** How an event type scores: `hit-factor` or `rings`. */
export const eventScoring: z.ZodDiscriminatedUnion<
  [typeof hitFactorScoring, typeof ringScoring],
  'method'
> = eventScoringParser satisfies Exact<typeof eventScoring, typeof eventScoringParser>

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
    note: z.string().min(1).optional(),
  })
  .refine((m) => m.maxRounds !== undefined || m.maxLength !== undefined, {
    message: 'a magazine limit needs maxRounds or maxLength',
  })

const eventTypeParser = z.strictObject({
  id: recordId,
  name: z.string().min(1),
  federation: recordId,
  ruleBook: z.strictObject({
    title: z.string().min(1),
    edition: z.string().min(1),
    publisher: z.string().min(1),
    url: z.url({ protocol: /^https$/ }),
    sha256,
  }),
  scoring: eventScoring,
  levels: z
    .array(z.string().min(1))
    .min(1)
    .refine((l) => new Set(l).size === l.length, { message: 'a level is listed twice' }),
  magazine: z.array(magazineLimit).min(1).optional(),
  movingTargets: z.boolean().optional(),
  provenance,
})

/**
 * A kind of competition event of one federation as its rule book defines it: the scoring, the
 * levels and the limits that matter for scoring and stage checks. Every fact is cited per field
 * in the provenance (`fields`). Model: `apps/docs/docs/data/event-types.md`.
 * Inferred type: {@link EventType}.
 */
export const eventType: z.ZodObject<
  {
    id: typeof recordId
    /** Name of the event type ("IPSC Handgun"). */
    name: z.ZodString
    /** Id of the federation whose rule book defines it. */
    federation: typeof recordId
    /**
     * The rule book the facts are read from. In a record file: the id of its source record, which
     * reading resolves to title, edition, publisher, URL and SHA-256.
     */
    ruleBook: z.ZodObject<
      {
        title: z.ZodString
        /** Edition, print or date as the document states it. */
        edition: z.ZodString
        publisher: z.ZodString
        /** An https URL: pages render it as a link. */
        url: z.ZodURL
        /** SHA-256 of a file: 64 lowercase hex digits. */
        sha256: z.ZodString
      },
      z.core.$strict
    >
    scoring: typeof eventScoring
    /** Level names as the rule book prints them, lowest first. */
    levels: z.ZodArray<z.ZodString>
    /** Magazine limits per division; absent: not recorded. */
    magazine: z.ZodOptional<
      z.ZodArray<
        z.ZodObject<
          {
            division: z.ZodString
            powerFactor: z.ZodOptional<z.ZodEnum<z.core.util.ToEnum<'major' | 'minor'>>>
            maxRounds: z.ZodOptional<z.ZodInt>
            maxLength: z.ZodOptional<QuantitySchema>
            /** A condition of the limit in our own words ("170 mm in single stack handguns"). */
            note: z.ZodOptional<z.ZodString>
          },
          z.core.$strict
        >
      >
    >
    /** Whether the rule book allows moving targets; absent: it does not say. */
    movingTargets: z.ZodOptional<z.ZodBoolean>
    /** Where the values of the record come from: a kind and at least one source. */
    provenance: typeof provenance
  },
  z.core.$strict
> = eventTypeParser satisfies Exact<typeof eventType, typeof eventTypeParser>

/** An event type record. */
export interface EventType extends z.infer<typeof eventType> {}
/** Hit-factor scoring of an event type. */
export type HitFactorScoring = z.infer<typeof hitFactorScoring>
/** Ring scoring of an event type. */
export type RingScoring = z.infer<typeof ringScoring>
