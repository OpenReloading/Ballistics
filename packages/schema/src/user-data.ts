import { z } from 'zod'
import { cartridgeCase } from './case.ts'
import { caseCapacity } from './case-capacity.ts'
import { chronoSession } from './chrono-session.ts'
import type { Exact } from './exact.ts'
import { text } from './fields.ts'
import { firearm } from './firearm.ts'
import { catalogueRef, parseRef, ref, userIdRegex } from './ids.ts'
import { load } from './load.ts'
import { bulletOverrides, cartridgeOverrides, powderDraft } from './overrides.ts'
import { isPlain } from './plain.ts'
import { provenanceKind } from './provenance.ts'
import { faceColour } from './target-face.ts'
import { targetSheet } from './target-sheet.ts'
import { type QuantitySchema, quantity } from './units.ts'

/** Value of `format` in every user data file. */
export const userDataFormat = 'openreloading-user-data'
/** Current `version` of a user data file: a file of any other version is refused. */
export const userDataVersion = 1

/** A reference to the catalogue record a user variant is based on. */
const basedOnRef = (kind: string) =>
  catalogueRef(kind).describe(
    `Reference \`catalogue:<record id>\` to the catalogue ${kind} the record is based on. Its fields not in \`overrides\` follow that record.`,
  )

/** The revision of the base record when a variant was saved, to tell later that the base changed. */
const basedOnRevision = z
  .string()
  .min(1)
  .max(64)
  .describe(
    'The `revision` of the base record when saved. A different revision on opening means the base changed.',
  )

const userBulletParser = z.strictObject({
  origin: z.literal('user').describe('Where the record lives: `user`.'),
  manufacturer: ref('manufacturer').optional(),
  basedOn: basedOnRef('bullet').optional(),
  basedOnRevision: basedOnRevision.optional(),
  overrides: bulletOverrides
    .describe(
      'The fields that differ from the base record, or all fields without one. A `null` removes a field of the base.',
    )
    .optional(),
})

/**
 * A bullet of the user: the catalogue bullet it is based on and the fields it overrides, or the
 * fields it gives alone. Lengths in mm, mass in g, angles in degrees.
 * Inferred type: {@link UserBullet}.
 */
export const userBullet: z.ZodObject<
  {
    origin: z.ZodLiteral<'user'>
    manufacturer: z.ZodOptional<z.ZodString>
    basedOn: z.ZodOptional<z.ZodString>
    basedOnRevision: z.ZodOptional<z.ZodString>
    overrides: z.ZodOptional<typeof bulletOverrides>
  },
  z.core.$strict
> = userBulletParser satisfies Exact<typeof userBullet, typeof userBulletParser>

const userCartridgeParser = z.object({
  origin: z.literal('user').describe('Where the record lives: `user`.'),
  basedOn: basedOnRef('cartridge').optional(),
  basedOnRevision: basedOnRevision.optional(),
  overrides: cartridgeOverrides
    .describe(
      'The fields and spec values that differ from the base record, or all of them without one. A value with `null` removes the base value of its side, symbol and variant.',
    )
    .optional(),
})

/**
 * A cartridge of the user: the catalogue cartridge it is based on and the fields and spec values
 * it overrides, or the ones it gives alone, in stored units.
 * Inferred type: {@link UserCartridge}.
 */
export const userCartridge: z.ZodObject<{
  origin: z.ZodLiteral<'user'>
  basedOn: z.ZodOptional<z.ZodString>
  basedOnRevision: z.ZodOptional<z.ZodString>
  overrides: z.ZodOptional<typeof cartridgeOverrides>
}> = userCartridgeParser satisfies Exact<typeof userCartridge, typeof userCartridgeParser>

/** A reference `user:<UUID>` to a record of the user's library. */
const userRef = (kind: string) =>
  ref(kind)
    .regex(/^user:/, `Not a user ${kind}`)
    .describe(`Reference \`user:<UUID>\` to a ${kind} of the user.`)

/** The parameters a powder fit can free, as the fit of the interior model names them. */
const fitParameter = z.enum([
  'burnRate',
  'startPressure',
  'volumeFactor',
  'energy',
  'temperatureFactor',
])

const fitPoint = z.strictObject({
  charge: quantity('mass', z.number().positive()).describe('Powder charge, g.'),
  muzzleVelocity: quantity('velocity', z.number().positive()).describe(
    'Mean muzzle velocity of the string, m/s.',
  ),
  shots: z.int().positive().describe('Number of shots of the string.'),
  barrelLength: quantity('length', z.number().positive()).describe('Barrel length, mm.'),
  temperature: quantity('temperature').describe('Powder temperature, degC.'),
  caseCapacity: quantity('volume', z.number().positive()).describe(
    'Water capacity of the case, cm3.',
  ),
  bulletMass: quantity('mass', z.number().positive()).describe('Bullet mass, g.'),
})

const userPowderFitParser = z.strictObject({
  input: z.array(fitPoint).min(1).max(40).describe('The points of the fit, at most 40.'),
  parameters: z
    .array(fitParameter)
    .min(1)
    .refine((ps) => new Set(ps).size === ps.length, 'Duplicate parameter')
    .describe('The parameters the fit freed. The others kept the values of the input.'),
  options: z
    .strictObject({
      prior: z
        .partialRecord(
          fitParameter,
          z.strictObject({
            value: z
              .number()
              .positive()
              .describe(
                'Centre, in the stored unit of the parameter: burn coefficient 1/s, start pressure bar, energy J/kg, factors 1.',
              ),
            sigma: z.number().positive().describe('Standard deviation of the log parameter, 1.'),
          }),
        )
        .describe('Gaussian prior per freed parameter. Absent: no prior.')
        .optional(),
      loss: z
        .discriminatedUnion('kind', [
          z.strictObject({ kind: z.literal('quadratic').describe('Quadratic loss.') }),
          z.strictObject({
            kind: z.literal('huber').describe('Huber loss.'),
            threshold: z.number().positive().describe('Threshold in sigmas of the rows, 1.'),
          }),
        ])
        .describe('Loss of the fit.'),
    })
    .describe('Prior and loss of the fit.'),
  date: z.iso.datetime().describe('Time of the fit, ISO 8601 in UTC.'),
  model: z.string().min(1).max(64).describe('Interior model of the fit, such as `m3`.'),
  modelVersion: z.string().min(1).max(64).describe('Version of the model code that fitted.'),
  confidence: z
    .enum(['tight', 'moderate', 'loose'])
    .describe(
      'Width class of the peak-pressure range: relative half-width up to 10 %, up to 25 %, or above.',
    ),
  reasons: z
    .array(z.string().min(1).max(64))
    .max(20)
    .describe('Why the confidence is not better, or what the fit rests on, as the fit named them.'),
  sessions: z
    .array(userRef('session'))
    .max(50)
    .describe('The sessions the points came from, for information only: never resolved.'),
  previous: userRef('powder')
    .describe('The powder record this one refits. Never resolved.')
    .optional(),
})

/**
 * What a fitted user powder was fitted to and how: a copy of the points, so that deleting or
 * editing a session never changes it. Stored units of `units.ts`.
 * Inferred type: {@link UserPowderFit}.
 */
export const userPowderFit: z.ZodObject<
  {
    input: z.ZodArray<
      z.ZodObject<
        {
          charge: QuantitySchema
          muzzleVelocity: QuantitySchema
          shots: z.ZodInt
          barrelLength: QuantitySchema
          temperature: QuantitySchema
          caseCapacity: QuantitySchema
          bulletMass: QuantitySchema
        },
        z.core.$strict
      >
    >
    parameters: z.ZodArray<
      z.ZodEnum<
        z.core.util.ToEnum<
          'burnRate' | 'startPressure' | 'volumeFactor' | 'energy' | 'temperatureFactor'
        >
      >
    >
    options: z.ZodObject<
      {
        prior: z.ZodOptional<
          z.ZodRecord<
            z.ZodEnum<
              z.core.util.ToEnum<
                'burnRate' | 'startPressure' | 'volumeFactor' | 'energy' | 'temperatureFactor'
              >
            > &
              z.core.$partial,
            z.ZodObject<{ value: z.ZodNumber; sigma: z.ZodNumber }, z.core.$strict>
          >
        >
        loss: z.ZodDiscriminatedUnion<
          [
            z.ZodObject<{ kind: z.ZodLiteral<'quadratic'> }, z.core.$strict>,
            z.ZodObject<{ kind: z.ZodLiteral<'huber'>; threshold: z.ZodNumber }, z.core.$strict>,
          ],
          'kind'
        >
      },
      z.core.$strict
    >
    date: z.ZodISODateTime
    model: z.ZodString
    modelVersion: z.ZodString
    confidence: z.ZodEnum<z.core.util.ToEnum<'tight' | 'moderate' | 'loose'>>
    reasons: z.ZodArray<z.ZodString>
    sessions: z.ZodArray<z.ZodString>
    previous: z.ZodOptional<z.ZodString>
  },
  z.core.$strict
> = userPowderFitParser satisfies Exact<typeof userPowderFit, typeof userPowderFitParser>

const userPowderParser = z.object({
  origin: z.literal('user').describe('Where the record lives: `user`.'),
  provenanceKind: provenanceKind
    .describe(
      'How the values came about: the kind of the provenance the designer builds. Burn-law parameters need `fitted`.',
    )
    .optional(),
  draft: powderDraft.describe('The powder fields entered so far, in stored units.').optional(),
  fit: userPowderFit
    .describe('What a fitted powder was fitted to and how, kept with the powder.')
    .optional(),
})

/**
 * A powder of the user in the powder designer: the powder fields entered so far in stored units,
 * each optional while the draft is unfinished, and the provenance kind the designer builds the
 * record's provenance with. The record's `name` is the powder's name.
 * Inferred type: {@link UserPowder}.
 */
export const userPowder: z.ZodObject<{
  origin: z.ZodLiteral<'user'>
  provenanceKind: z.ZodOptional<typeof provenanceKind>
  draft: z.ZodOptional<typeof powderDraft>
  fit: z.ZodOptional<typeof userPowderFit>
}> = userPowderParser satisfies Exact<typeof userPowder, typeof userPowderParser>

const userManufacturerParser = z.object({
  origin: z.literal('user').describe('Where the record lives: `user`.'),
})

/**
 * A manufacturer of the user: a company typed where no catalogue manufacturer matched. The name is
 * the record's `name`; bullets and firearms of the user name it by `user:<id>`.
 * Inferred type: {@link UserManufacturer}.
 */
export const userManufacturer: z.ZodObject<{ origin: z.ZodLiteral<'user'> }> =
  userManufacturerParser satisfies Exact<typeof userManufacturer, typeof userManufacturerParser>

const designLength = z.number().positive()

const targetFaceDesignParser = z.object({
  rings: z
    .array(
      z.object({
        value: z.int().positive().optional().describe('Ring value.'),
        diameter: designLength.optional().describe('Width of the ring, mm.'),
        height: designLength.optional().describe('Height of an oval ring, mm.'),
        fill: faceColour.optional().describe('Colour of the zone the ring line bounds outside.'),
        line: faceColour.optional().describe('Colour of the ring line.'),
      }),
    )
    .max(40)
    .describe('Rings from outer to inner.'),
  innerTen: z
    .object({
      diameter: designLength.optional().describe('Width of the inner ten, mm.'),
      height: designLength.optional().describe('Height of an oval inner ten, mm.'),
      rule: z
        .enum(['touch', 'cover'])
        .optional()
        .describe('Whether a touch or only a cover counts.'),
    })
    .describe('The inner ten.')
    .optional(),
  blackDiameter: designLength.optional().describe('Width of the black aiming area, mm.'),
  blackHeight: designLength.optional().describe('Height of an oval black aiming area, mm.'),
  decimal: z.boolean().optional().describe('Decimal (tenth-ring) scoring.'),
  events: z
    .array(
      z.object({
        name: text(200).describe('Name of the event. Empty: not named yet.'),
        distance: designLength.optional().describe('Shooting distance, mm.'),
        gauge: designLength.optional().describe('Diameter of the scored hole, mm.'),
      }),
    )
    .max(40)
    .describe('Events shot on the face.'),
})

/**
 * A target face in the face designer: the face fields a rule book gives, without id, name and
 * provenance, and each of them optional (a draft). The face designer builds the face from it and
 * checks it against `TargetFace`. Lengths in mm.
 * Inferred type: {@link TargetFaceDesign}.
 */
export const targetFaceDesign: z.ZodObject<{
  rings: z.ZodArray<
    z.ZodObject<{
      value: z.ZodOptional<z.ZodInt>
      diameter: z.ZodOptional<z.ZodNumber>
      height: z.ZodOptional<z.ZodNumber>
      fill: z.ZodOptional<typeof faceColour>
      line: z.ZodOptional<typeof faceColour>
    }>
  >
  innerTen: z.ZodOptional<
    z.ZodObject<{
      diameter: z.ZodOptional<z.ZodNumber>
      height: z.ZodOptional<z.ZodNumber>
      rule: z.ZodOptional<z.ZodEnum<z.core.util.ToEnum<'touch' | 'cover'>>>
    }>
  >
  blackDiameter: z.ZodOptional<z.ZodNumber>
  blackHeight: z.ZodOptional<z.ZodNumber>
  decimal: z.ZodOptional<z.ZodBoolean>
  events: z.ZodArray<
    z.ZodObject<{
      name: z.ZodString
      distance: z.ZodOptional<z.ZodNumber>
      gauge: z.ZodOptional<z.ZodNumber>
    }>
  >
}> = targetFaceDesignParser satisfies Exact<typeof targetFaceDesign, typeof targetFaceDesignParser>

const hitCount = z.int().nonnegative().max(10000).describe('A count from the score sheet.')

/** A practical stage from the score sheet: hits per zone, penalties, time (s), power factor. */
const practicalStage = z.strictObject({
  name: z.string().min(1).max(200).describe('Stage name.'),
  hits: z
    .strictObject({ A: hitCount, C: hitCount, D: hitCount, metal: hitCount.optional() })
    .describe('Scoring hits per zone.'),
  misses: hitCount,
  noShoots: hitCount,
  procedurals: hitCount,
  time: z.number().positive().max(3600).describe('Stage time, s.'),
  powerFactor: z.enum(['major', 'minor']).describe('Power factor.'),
  stagePoints: z.number().nonnegative().describe('Stage points of the official result.').optional(),
})

/** Whether `v` is a whole number of tenths, within the rounding of a decimal number. */
const inTenths = (v: number) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-6

/** The ring value of each shot (whole rings or tenths), or its total, or both when they agree, and the target sheet it was scored on. */
const ringSeries = z
  .strictObject({
    shots: z
      .array(z.number().nonnegative().max(10.9))
      .min(1)
      .max(100)
      .describe('Ring value per shot.')
      .optional(),
    total: z.number().nonnegative().max(1090).describe('Series total.').optional(),
    targetSheet: userRef('target sheet').optional(),
  })
  .refine(
    ({ shots, total }) =>
      (shots ?? total) !== undefined &&
      [...(shots ?? []), total ?? 0].every(inTenths) &&
      (shots === undefined ||
        total === undefined ||
        Math.round(shots.reduce((sum, v) => sum + v * 10, 0)) === Math.round(total * 10)),
    'A series needs its shots or its total, in tenths at most, agreeing when both are given.',
  )

const method = 'Scoring method of the event type.'

const competitionEventParser = z.strictObject({
  date: z.iso.date().describe('Day, ISO 8601.'),
  place: text(200).describe('Place.').optional(),
  eventType: catalogueRef('event type'),
  level: z.string().min(1).max(200).describe("One of the event type's levels."),
  discipline: catalogueRef('discipline').optional(),
  division: z.string().min(1).max(200).describe("One of the event type's divisions.").optional(),
  firearm: userRef('firearm').optional(),
  load: userRef('load').optional(),
  rounds: z
    .int()
    .nonnegative()
    .max(100000)
    .describe('Rounds fired, for the round count.')
    .optional(),
  notes: text(10000).describe('Notes, plain text.').optional(),
  state: z
    .enum(['completed', 'did-not-finish', 'disqualified'])
    .describe('How the event ended: a disqualified event has no total.'),
  results: z
    .discriminatedUnion('method', [
      z.strictObject({
        method: z.literal('rings').describe(method),
        series: z.array(ringSeries).max(100).describe('Series in the order shot.'),
      }),
      z.strictObject({
        method: z.literal('hit-factor').describe(method),
        stages: z.array(practicalStage).max(100).describe('Stages in the order shot.'),
      }),
    ])
    .describe('Results, by the scoring method of the event type.'),
})

/**
 * A competition event the person shot, with their own results: ring series or practical stages,
 * by the scoring method of its event type. Never an official result.
 * Inferred type: {@link CompetitionEvent}.
 */
export const competitionEvent: z.ZodObject<
  {
    date: z.ZodISODate
    place: z.ZodOptional<z.ZodString>
    eventType: z.ZodString
    level: z.ZodString
    discipline: z.ZodOptional<z.ZodString>
    division: z.ZodOptional<z.ZodString>
    firearm: z.ZodOptional<z.ZodString>
    load: z.ZodOptional<z.ZodString>
    rounds: z.ZodOptional<z.ZodInt>
    notes: z.ZodOptional<z.ZodString>
    state: z.ZodEnum<z.core.util.ToEnum<'completed' | 'did-not-finish' | 'disqualified'>>
    results: z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            method: z.ZodLiteral<'rings'>
            series: z.ZodArray<
              z.ZodObject<
                {
                  shots: z.ZodOptional<z.ZodArray<z.ZodNumber>>
                  total: z.ZodOptional<z.ZodNumber>
                  targetSheet: z.ZodOptional<z.ZodString>
                },
                z.core.$strict
              >
            >
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            method: z.ZodLiteral<'hit-factor'>
            stages: z.ZodArray<
              z.ZodObject<
                {
                  name: z.ZodString
                  hits: z.ZodObject<
                    { A: z.ZodInt; C: z.ZodInt; D: z.ZodInt; metal: z.ZodOptional<z.ZodInt> },
                    z.core.$strict
                  >
                  misses: z.ZodInt
                  noShoots: z.ZodInt
                  procedurals: z.ZodInt
                  time: z.ZodNumber
                  powerFactor: z.ZodEnum<z.core.util.ToEnum<'major' | 'minor'>>
                  stagePoints: z.ZodOptional<z.ZodNumber>
                },
                z.core.$strict
              >
            >
          },
          z.core.$strict
        >,
      ],
      'method'
    >
  },
  z.core.$strict
> = competitionEventParser satisfies Exact<typeof competitionEvent, typeof competitionEventParser>

/** A competition event of the user with their own results. */
export interface CompetitionEvent extends z.infer<typeof competitionEvent> {}

const shootingLogEntryParser = z
  .strictObject({
    date: z.iso.date().describe('Day, ISO 8601.'),
    place: text(200).describe('Place, such as the range or club.').optional(),
    discipline: catalogueRef('discipline').optional(),
    firearm: userRef('firearm').optional(),
    load: userRef('load').optional(),
    ammunition: z
      .string()
      .min(1)
      .max(200)
      .describe('Factory ammunition as the person names it, in place of a `load`.')
      .optional(),
    rounds: z.int().nonnegative().max(100000).describe('Rounds fired, for the round count.'),
    result: text(200).describe('Result as the person writes it, plain text.').optional(),
    event: ref('event')
      .regex(/^user:/, 'Not a user event')
      .describe('Reference `user:<UUID>` to the competition event of the entry.')
      .optional(),
    notes: text(10000).describe('Notes, plain text.').optional(),
    confirmation: z
      .strictObject({
        by: z.string().min(1).max(200).describe('Who confirmed the entry, as text.'),
        date: z.iso.date().describe('Day of the confirmation, ISO 8601.').optional(),
      })
      .describe('Who confirmed the entry and when, as the person typed it.')
      .optional(),
  })
  .refine(
    (e) => e.load === undefined || e.ammunition === undefined,
    'Give a load or factory ammunition, not both.',
  )

/**
 * One entry of the shooting log (Schiessbuch): a range day of the person, as their own record.
 * Whether a club or an authority accepts it is up to them; the record claims no such standing.
 * Inferred type: {@link ShootingLogEntry}.
 */
export const shootingLogEntry: z.ZodObject<
  {
    date: z.ZodISODate
    place: z.ZodOptional<z.ZodString>
    discipline: z.ZodOptional<z.ZodString>
    firearm: z.ZodOptional<z.ZodString>
    load: z.ZodOptional<z.ZodString>
    ammunition: z.ZodOptional<z.ZodString>
    rounds: z.ZodInt
    result: z.ZodOptional<z.ZodString>
    event: z.ZodOptional<z.ZodString>
    notes: z.ZodOptional<z.ZodString>
    confirmation: z.ZodOptional<
      z.ZodObject<{ by: z.ZodString; date: z.ZodOptional<z.ZodISODate> }, z.core.$strict>
    >
  },
  z.core.$strict
> = shootingLogEntryParser satisfies Exact<typeof shootingLogEntry, typeof shootingLogEntryParser>

/** Why a user record id that is no UUID is refused: other records refer to it by `user:<UUID>`. */
export const userIdProblem: string =
  'The id of a user record must be a UUID, so that other records can refer to it.'

const base = {
  id: z
    .string()
    .regex(userIdRegex, userIdProblem)
    .describe('Id of the record in the browser library: a UUID.'),
  name: z.string().min(1).max(200).describe('Name of the record. Save names the file after it.'),
  saved: z.iso.datetime().describe('Time of the last save, ISO 8601 in UTC.'),
  imported: z
    .object({
      source: z
        .string()
        .min(1)
        .max(500)
        .describe('Where the imported values come from, as the user named it.'),
      file: z.string().max(200).describe('Name of the file the record was imported from.'),
      day: z.iso.date().describe('Day of the import, ISO 8601.'),
    })
    .describe('The import the record came from. Not compared when a file is imported again.')
    .optional(),
}

/** The schema of a user record of `kind` K whose `data` has the schema D: one member of {@link userRecord}. */
export type UserRecordSchema<K extends string, D extends z.ZodType> = z.ZodObject<{
  name: z.ZodString
  saved: z.ZodISODateTime
  imported: z.ZodOptional<
    z.ZodObject<{ source: z.ZodString; file: z.ZodString; day: z.ZodISODate }>
  >
  kind: z.ZodLiteral<K>
  id: z.ZodString
  data: D
}>

const record = <K extends string, D extends z.ZodType>(kind: K, description: string, data: D) =>
  z.object({
    kind: z.literal(kind).describe('Kind of the record.'),
    ...base,
    data: data.describe(description),
  })

const userRecordParser = z.discriminatedUnion('kind', [
  record('manufacturer', 'A manufacturer typed by the user.', userManufacturer),
  record('bullet', 'A bullet of the bullet designer.', userBullet),
  record('cartridge', 'A cartridge of the cartridge designer.', userCartridge),
  record('powder', 'A powder of the powder designer.', userPowder),
  record('caseCapacity', 'A case capacity the user measured, in g.', caseCapacity),
  record('load', 'A load of the workbench, in stored units.', load),
  record('firearm', 'A firearm of the library, in stored units.', firearm),
  record('session', 'A chronograph session, in stored units.', chronoSession),
  record('targetSheet', 'A target sheet with its calibration and shot groups.', targetSheet),
  record('targetFaceDesign', 'A target face of the face designer.', targetFaceDesign),
  record('case', 'A group of cases of the user with their measured values.', cartridgeCase),
  record('event', 'A competition event; never an official result.', competitionEvent),
  record(
    'shootingLogEntry',
    "An entry of the shooting log, the person's own record.",
    shootingLogEntry,
  ),
])

/**
 * One record of a user data file: its `kind`, id, name, save time and the `data` of that kind.
 * Inferred type: {@link UserRecord}.
 */
export const userRecord: z.ZodDiscriminatedUnion<
  [
    UserRecordSchema<'manufacturer', typeof userManufacturer>,
    UserRecordSchema<'bullet', typeof userBullet>,
    UserRecordSchema<'cartridge', typeof userCartridge>,
    UserRecordSchema<'powder', typeof userPowder>,
    UserRecordSchema<'caseCapacity', typeof caseCapacity>,
    UserRecordSchema<'load', typeof load>,
    UserRecordSchema<'firearm', typeof firearm>,
    UserRecordSchema<'session', typeof chronoSession>,
    UserRecordSchema<'targetSheet', typeof targetSheet>,
    UserRecordSchema<'targetFaceDesign', typeof targetFaceDesign>,
    UserRecordSchema<'case', typeof cartridgeCase>,
    UserRecordSchema<'event', typeof competitionEvent>,
    UserRecordSchema<'shootingLogEntry', typeof shootingLogEntry>,
  ],
  'kind'
> = userRecordParser satisfies Exact<typeof userRecord, typeof userRecordParser>

/** The record kinds this version reads. */
const knownKinds: ReadonlySet<string> = new Set(userRecord.options.map((o) => o.shape.kind.value))

/** A record kind of a user data file that this version does not know, and how many records had it. */
export interface SkippedKind {
  /** The `kind` as the file gives it. */
  kind: string
  /** Records of that kind in the file. */
  count: number
}

/**
 * `json` without its records of a kind this version does not know, and those kinds with their
 * counts, so that a file of a later version that adds kinds still opens. A record without a text
 * `kind` stays, for the schema to refuse.
 */
export function withoutUnknownKinds(json: unknown): { json: unknown; skipped: SkippedKind[] } {
  if (!isPlain(json) || !Array.isArray(json['records'])) return { json, skipped: [] }
  const counts = new Map<string, number>()
  const kept = json['records'].filter((r) => {
    const kind = isPlain(r) ? r['kind'] : undefined
    if (typeof kind !== 'string' || knownKinds.has(kind)) return true
    counts.set(kind, (counts.get(kind) ?? 0) + 1)
    return false
  })
  if (!counts.size) return { json, skipped: [] }
  const skipped = [...counts].map(([kind, count]) => ({ kind, count }))
  return { json: { ...json, records: kept }, skipped }
}

/** Media type of a stored photo: a raster image (an SVG can carry script). */
export type PhotoType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif'
  | 'image/avif'
  | 'image/heic'
  | 'image/bmp'

/** Media types of a stored photo: raster images only (an SVG can carry script). */
export const photoTypes: readonly PhotoType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/bmp',
]

const embeddedFileParser = z.object({
  id: z.string().min(1).max(64).describe('Id the target sheet names in `photo`.'),
  type: z.enum(photoTypes).describe('Media type of the photo.'),
  data: z.base64().describe('The photo, base64.'),
})

/**
 * A user file a record points at (a target photo), base64 in the file.
 * Inferred type: {@link EmbeddedFile}.
 */
export const embeddedFile: z.ZodObject<{
  id: z.ZodString
  type: z.ZodEnum<z.core.util.ToEnum<PhotoType>>
  data: z.ZodBase64
}> = embeddedFileParser satisfies Exact<typeof embeddedFile, typeof embeddedFileParser>

const userDataFileParser = z.object({
  format: z.literal(userDataFormat).describe('Format of the file.'),
  version: z.literal(userDataVersion).describe('Format version of the file.'),
  records: z
    .array(userRecord)
    .refine((rs) => new Set(rs.map((r) => r.id)).size === rs.length, 'Duplicate record id')
    .describe(
      'The records of the file. The app skips a record of a kind not listed here and reports the kind with its count; it does not keep the skipped records.',
    ),
  files: z
    .array(embeddedFile)
    .refine((fs) => new Set(fs.map((f) => f.id)).size === fs.length, 'Duplicate file id')
    .describe('Photos of the target sheets, base64.')
    .optional(),
})

/**
 * One file holds one record (Save) or every record of the browser (Export all), with the photos of
 * its target sheets in the optional `files`.
 */
export const userDataFile: z.ZodObject<{
  format: z.ZodLiteral<typeof userDataFormat>
  version: z.ZodLiteral<typeof userDataVersion>
  records: z.ZodArray<typeof userRecord>
  files: z.ZodOptional<z.ZodArray<typeof embeddedFile>>
}> = userDataFileParser satisfies Exact<typeof userDataFile, typeof userDataFileParser>

/** Records of a user data file. */
export type UserRecords = UserRecord[]

/** A reference that points at no record of the set given to {@link checkUserRefs}. */
export interface DanglingRef {
  /** Id of the record that holds the reference. */
  record: string
  /** Kind of that record. */
  kind: UserRecordKind
  /** The field of its `data` that holds the reference. */
  field: string
  /** The reference as stored. */
  target: string
}

/**
 * The references of `records` to user records that no record of `records` answers: a load's
 * `firearm`, `cartridge`, `bullet`, `powder`, `capacity`, `case.record`, `case.manufacturer` and
 * `sessions`, a bullet's and a firearm's `manufacturer`, a firearm's `landsBullet`, a capacity's
 * `cartridge` and `caseManufacturer`, a case's `cartridge`, `manufacturer` and `capacity`, a session's
 * device `manufacturer` and the `load` of its strings, a target sheet's `load` and the `session` of
 * its group shots, an event's `firearm`, `load` and the `targetSheet` of its ring series, and a
 * shooting log entry's `firearm`, `load` and `event`. A `user:<id>` reference names a record by its
 * id; a `catalogue:` reference is not checked. Reports only: nothing is dropped.
 */
export function checkUserRefs(records: UserRecords): DanglingRef[] {
  const kindOf = new Map(records.map((r) => [r.id, r.kind]))
  const dangling: DanglingRef[] = []
  for (const r of records) {
    for (const [field, target, kind, userOnly] of userRefsOf(r)) {
      if (target === undefined) continue
      const id = userRecordId(target, userOnly)
      if (id !== undefined && kindOf.get(id) !== kind)
        dangling.push({ record: r.id, kind: r.kind, field, target })
    }
  }
  return dangling
}

/** The id of the user record a reference names; undefined for a catalogue record. */
function userRecordId(target: string, userOnly: boolean): string | undefined {
  const parsed = parseRef(target)
  if (parsed?.scope === 'catalogue' || (userOnly && parsed?.scope !== 'user')) return undefined
  return parsed?.id ?? target
}

/** A user record as {@link userRefFields} reads it. */
export interface RecordOfUser {
  kind: UserRecordKind
  data: unknown
}

/**
 * The fields of `r` whose reference names a record of the user (`user:<id>`): what another
 * browser would not have. A `catalogue:` reference and a plain catalogue id are not listed.
 */
export function userRefFields(r: RecordOfUser): string[] {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- reads only the reference fields the kind has
  return userRefsOf(r as UserRecord).flatMap(([field, target]) =>
    target !== undefined && parseRef(target)?.scope === 'user' ? [field] : [],
  )
}

/** The field, its text, the kind the target record must have and whether only a `user:` reference counts (a plain text names a catalogue record). */
type UserRef = [field: string, target: string | undefined, kind: UserRecordKind, userOnly: boolean]

/** The references of a record to other user records. */
function userRefsOf(r: UserRecord): UserRef[] {
  switch (r.kind) {
    case 'load':
      return loadRefs(r.data)
    case 'caseCapacity':
      return [
        ['cartridge', r.data.cartridge, 'cartridge', true],
        ['caseManufacturer', r.data.caseManufacturer, 'manufacturer', true],
      ]
    case 'case':
      return [
        ['cartridge', r.data.cartridge, 'cartridge', true],
        ['manufacturer', r.data.manufacturer, 'manufacturer', true],
        ['capacity', r.data.capacity, 'caseCapacity', true],
      ]
    case 'targetSheet':
      return targetSheetRefs(r.data)
    case 'session':
      return sessionRefs(r.data)
    case 'bullet':
      return [['manufacturer', r.data.manufacturer, 'manufacturer', true]]
    case 'firearm':
      return [
        ['manufacturer', r.data.manufacturer, 'manufacturer', true],
        ['landsBullet', r.data.landsBullet, 'bullet', true],
      ]
    case 'event':
      return eventRefs(r.data)
    case 'shootingLogEntry':
      return [
        ['firearm', r.data.firearm, 'firearm', true],
        ['load', r.data.load, 'load', true],
        ['event', r.data.event, 'event', true],
      ]
    default:
      return []
  }
}

/** The records a load names: its firearm, cartridge, components, case and sessions. */
function loadRefs(l: z.infer<typeof load>): UserRef[] {
  return [
    ['firearm', l.firearm, 'firearm', true],
    ['cartridge', l.cartridge, 'cartridge', true],
    ['bullet', typeof l.bullet === 'string' ? l.bullet : undefined, 'bullet', true],
    ['powder', typeof l.powder === 'string' ? l.powder : undefined, 'powder', true],
    ['capacity', l.capacity, 'caseCapacity', true],
    ['case.record', l.case?.record, 'case', true],
    ['case.manufacturer', l.case?.manufacturer, 'manufacturer', true],
    ...(l.sessions ?? []).map((s, i): UserRef => [`sessions.${i}`, s, 'session', true]),
  ]
}

/** The load a target sheet names and the session of each chronographed shot. */
function targetSheetRefs(t: z.infer<typeof targetSheet>): UserRef[] {
  return [
    ['load', t.load, 'load', false],
    ...t.groups.flatMap((g, gi) =>
      g.shots.map(
        (shot, si): UserRef => [
          `groups.${gi}.shots.${si}.chrono.session`,
          shot.chrono?.session,
          'session',
          true,
        ],
      ),
    ),
  ]
}

/** The maker of a session's device and the load of each string. */
function sessionRefs(s: z.infer<typeof chronoSession>): UserRef[] {
  return [
    ['device.manufacturer', s.device.manufacturer, 'manufacturer', true],
    ...s.strings.map((str, i): UserRef => [`strings.${i}.load`, str.load, 'load', true]),
  ]
}

/** The firearm and load of an event and the target sheet of each ring series. */
function eventRefs(e: z.infer<typeof competitionEvent>): UserRef[] {
  return [
    ['firearm', e.firearm, 'firearm', true],
    ['load', e.load, 'load', true],
    ...(e.results.method === 'rings' ? e.results.series : []).map(
      (s, i): UserRef => [`results.series.${i}.targetSheet`, s.targetSheet, 'targetSheet', true],
    ),
  ]
}

/**
 * Why a user data file of another format version is refused, naming the version this build reads;
 * undefined for a file of the current version or of another format.
 */
export function versionProblem(json: unknown): string | undefined {
  if (isPlain(json) && json['format'] === userDataFormat && json['version'] !== userDataVersion)
    return `The file has format version ${JSON.stringify(json['version'])}; this app reads version ${userDataVersion}.`
  return undefined
}

/** A user manufacturer. */
export interface UserManufacturer extends z.infer<typeof userManufacturer> {}
/** A user powder: the designer's fields, a draft until the record is valid. */
export interface UserPowder extends z.infer<typeof userPowder> {}
/** What a fitted user powder was fitted to. */
export interface UserPowderFit extends z.infer<typeof userPowderFit> {}
/** A user bullet: a variant of a catalogue bullet, or a bullet of its own. */
export interface UserBullet extends z.infer<typeof userBullet> {}
/** A user cartridge: a variant of a catalogue cartridge, or a cartridge of its own. */
export interface UserCartridge extends z.infer<typeof userCartridge> {}
/** The user record of kind `caseCapacity`. */
export type UserCaseCapacity = Extract<UserRecord, { kind: 'caseCapacity' }>
/** The user record of kind `case`. */
export type UserCaseRecord = Extract<UserRecord, { kind: 'case' }>
/** A target face of the face designer, each field optional. */
export interface TargetFaceDesign extends z.infer<typeof targetFaceDesign> {}
/** An entry of the shooting log. */
export interface ShootingLogEntry extends z.infer<typeof shootingLogEntry> {}
/** The user record of kind `shootingLogEntry`. */
export type ShootingLogRecord = Extract<UserRecord, { kind: 'shootingLogEntry' }>
/** The user record of kind `session`. */
export type SessionRecord = Extract<UserRecord, { kind: 'session' }>
/** The user record of kind `targetSheet`. */
export type TargetSheetRecord = Extract<UserRecord, { kind: 'targetSheet' }>
/** One record of a user data file. */
export type UserRecord = z.infer<typeof userRecord>
/** Discriminator of a user record. */
export type UserRecordKind = UserRecord['kind']
/** A base64 photo of a user data file, referenced by id. */
export interface EmbeddedFile extends z.infer<typeof embeddedFile> {}
