import { z } from 'zod'
import { caseCapacity } from './case-capacity.ts'
import { firearm } from './firearm.ts'
import { catalogueRef, parseRef, ref } from './ids.ts'
import { load } from './load.ts'
import { bulletOverrides, cartridgeOverrides } from './overrides.ts'
import { text } from './shared.ts'
import { faceColour } from './target-face.ts'
import { targetSheet } from './target-sheet.ts'

/** Value of `format` in every user data file, telling it apart from other JSON. */
export const userDataFormat = 'openreloading-user-data'
/** Current `version` of a user data file: a file of any other version is refused. */
export const userDataVersion = 1

/** A reference to the catalogue record a user variant is based on. */
const basedOnRef = (kind: string) =>
  catalogueRef(kind).describe(
    `Reference \`catalogue:<record id>\` to the catalogue ${kind} the record is based on. Its fields not in \`overrides\` follow that record.`,
  )

/**
 * A bullet of the user: the catalogue bullet it is based on and the fields it overrides, or the
 * fields it gives alone. Lengths in mm, mass in g, angles in degrees.
 * Inferred type: {@link UserBullet}.
 */
export const userBullet = z.strictObject({
  origin: z.literal('user').describe('Where the record lives: `user`.'),
  manufacturer: ref('manufacturer').optional(),
  basedOn: basedOnRef('bullet').optional(),
  overrides: bulletOverrides
    .describe(
      'The fields that differ from the base record, or all fields without one. A `null` removes a field of the base.',
    )
    .optional(),
})

/**
 * A cartridge of the user: the catalogue cartridge it is based on and the fields and spec values
 * it overrides, or the ones it gives alone, in stored units.
 * Inferred type: {@link UserCartridge}.
 */
export const userCartridge = z.object({
  origin: z.literal('user').describe('Where the record lives: `user`.'),
  basedOn: basedOnRef('cartridge').optional(),
  overrides: cartridgeOverrides
    .describe(
      'The fields and spec values that differ from the base record, or all of them without one. A value with `null` removes the base value of its side, symbol and variant.',
    )
    .optional(),
})

/**
 * A manufacturer of the user: a company typed where no catalogue manufacturer matched. The name is
 * the record's `name`; bullets and firearms of the user name it by `user:<id>`.
 * Inferred type: {@link UserManufacturer}.
 */
export const userManufacturer = z.object({
  origin: z.literal('user').describe('Where the record lives: `user`.'),
})

const designLength = z.number().positive()

/**
 * A target face in the face designer: the face fields a rule book gives, without id, name and
 * provenance, and each of them optional (a draft). The face designer builds the face from it and
 * checks it against `TargetFace`. Lengths in mm.
 * Inferred type: {@link TargetFaceDesign}.
 */
export const targetFaceDesign = z.object({
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

const base = {
  id: z.string().min(1).max(64).describe('Id of the record in the browser library.'),
  name: z.string().min(1).max(200).describe('Name of the record. Save names the file after it.'),
  saved: z.iso.datetime().describe('Time of the last save, ISO 8601 in UTC.'),
}

const record = <K extends string, D extends z.ZodType>(kind: K, description: string, data: D) =>
  z.object({
    kind: z.literal(kind).describe(`Kind of the record: \`${kind}\`.`),
    ...base,
    data: data.describe(description),
  })

/** Why a record of kind `workbenchState`, the load of the format before kind `load`, is refused. */
export const legacyLoadProblem: string =
  'A record of kind "workbenchState" is a load in the format of an earlier version, which this app no longer reads. Kind "load" replaces it.'

/**
 * One record of a user data file: its `kind`, id, name, save time and the `data` of that kind.
 * Inferred type: {@link UserRecord}.
 */
export const userRecord = z.discriminatedUnion(
  'kind',
  [
    record('manufacturer', 'A manufacturer typed by the user.', userManufacturer),
    record('bullet', 'A bullet of the bullet designer.', userBullet),
    record('cartridge', 'A cartridge of the cartridge designer.', userCartridge),
    record('caseCapacity', 'A case capacity the user measured, in g.', caseCapacity),
    record('load', 'A load of the workbench, in stored units.', load),
    record('firearm', 'A firearm of the library, in stored units.', firearm),
    record('targetSheet', 'A target sheet with its calibration and shot groups.', targetSheet),
    record('targetFaceDesign', 'A target face of the face designer.', targetFaceDesign),
  ],
  {
    error: (issue) =>
      (issue.input as { kind?: unknown } | null)?.kind === 'workbenchState'
        ? legacyLoadProblem
        : undefined,
  },
)

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

/**
 * A user file a record points at (a target photo), base64 in the file.
 * Inferred type: {@link EmbeddedFile}.
 */
export const embeddedFile = z.object({
  id: z.string().min(1).max(64).describe('Id the target sheet names in `photo`.'),
  type: z.enum(photoTypes).describe('Media type of the photo.'),
  data: z.base64().describe('The photo, base64.'),
})

/**
 * One file holds one record (Save) or every record of the browser (Export all), with the photos of
 * its target sheets in the optional `files`.
 */
export const userDataFile = z.object({
  format: z.literal(userDataFormat).describe('Format of the file: `openreloading-user-data`.'),
  version: z.literal(userDataVersion).describe('Format version of the file.'),
  records: z
    .array(userRecord)
    .refine((rs) => new Set(rs.map((r) => r.id)).size === rs.length, 'Duplicate record id')
    .describe('The records of the file.'),
  files: z
    .array(embeddedFile)
    .refine((fs) => new Set(fs.map((f) => f.id)).size === fs.length, 'Duplicate file id')
    .describe('Photos of the target sheets, base64.')
    .optional(),
})

/** Records of a user data file, as {@link checkUserRefs} takes them. */
export type UserRecords = UserRecord[]

/** A reference of a user record that points at no record of the set given to {@link checkUserRefs}. */
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
 * `firearm`, `cartridge` and `bullet`, a bullet's and a firearm's `manufacturer`, a capacity's
 * `cartridge` and `caseManufacturer` (only as `user:<id>`) and a target sheet's `load`. A
 * `user:<id>` reference names a record by its id, a
 * `catalogue:` reference is not checked here. Reports only: nothing is dropped.
 */
export function checkUserRefs(records: UserRecords): DanglingRef[] {
  const kindOf = new Map(records.map((r) => [r.id, r.kind]))
  const dangling: DanglingRef[] = []
  for (const r of records) {
    for (const [field, target, kind, userOnly] of userRefsOf(r)) {
      if (target === undefined) continue
      const parsed = parseRef(target)
      if (parsed?.scope === 'catalogue' || (userOnly && parsed?.scope !== 'user')) continue
      if (kindOf.get(parsed?.id ?? target) !== kind)
        dangling.push({ record: r.id, kind: r.kind, field, target })
    }
  }
  return dangling
}

/**
 * The references of a record to other user records: the field, its text, the kind the record must
 * have and whether only a `user:` reference counts (a plain text names a catalogue record).
 */
function userRefsOf(r: UserRecord): [string, string | undefined, UserRecordKind, boolean][] {
  switch (r.kind) {
    case 'load':
      return [
        ['firearm', r.data.firearm, 'firearm', true],
        ['cartridge', r.data.cartridge, 'cartridge', true],
        ['bullet', typeof r.data.bullet === 'string' ? r.data.bullet : undefined, 'bullet', true],
      ]
    case 'caseCapacity':
      return [
        ['cartridge', r.data.cartridge, 'cartridge', true],
        ['caseManufacturer', r.data.caseManufacturer, 'manufacturer', true],
      ]
    case 'targetSheet':
      return [['load', r.data.load, 'load', false]]
    case 'bullet':
    case 'firearm':
      return [['manufacturer', r.data.manufacturer, 'manufacturer', true]]
    default:
      return []
  }
}

/**
 * Why a user data file of another format version is refused, naming the version this build reads;
 * undefined for a file of the current version or of another format.
 */
export function versionProblem(json: unknown): string | undefined {
  const f = json as { format?: unknown; version?: unknown } | null
  if (f?.format === userDataFormat && f.version !== userDataVersion)
    return `The file has format version ${JSON.stringify(f.version)}; this app reads version ${userDataVersion}.`
}

/** A user manufacturer: its `name` is the record's name. */
export interface UserManufacturer extends z.infer<typeof userManufacturer> {}
/** A user bullet: a variant of a catalogue bullet, or a bullet of its own. */
export interface UserBullet extends z.infer<typeof userBullet> {}
/** A user cartridge: a variant of a catalogue cartridge, or a cartridge of its own. */
export interface UserCartridge extends z.infer<typeof userCartridge> {}
/** The user record of kind `caseCapacity`: a case capacity the user measured. */
export type UserCaseCapacity = Extract<UserRecord, { kind: 'caseCapacity' }>
/** A target face of the face designer: rings, inner ten, black area and events, each optional. */
export interface TargetFaceDesign extends z.infer<typeof targetFaceDesign> {}
/** The user record of kind `targetSheet`. */
export type TargetSheetRecord = Extract<UserRecord, { kind: 'targetSheet' }>
/** One record of a user data file: `kind`, id, name, save time and `data`. */
export type UserRecord = z.infer<typeof userRecord>
/** Discriminator of a user record: `manufacturer`, `bullet`, `cartridge`, `caseCapacity`, `load`, `firearm`, `targetSheet` or `targetFaceDesign`. */
export type UserRecordKind = UserRecord['kind']
/** A base64 photo stored in a user data file, referenced by id. */
export interface EmbeddedFile extends z.infer<typeof embeddedFile> {}
