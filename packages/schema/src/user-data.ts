import { z } from 'zod'
import { firearm } from './firearm.ts'
import { parseRef } from './ids.ts'
import { siValues, text } from './shared.ts'
import { specValue } from './standards.ts'
import { targetSheet } from './target-sheet.ts'
import { workbenchState } from './workbench.ts'

/** Value of `format` in every user data file, telling it apart from other JSON. */
export const userDataFormat = 'openreloading-user-data'
/** Current `version` of a user data file: a file of any other version is refused. */
export const userDataVersion = 1

/** The catalogue record a design started from. */
const parent = z
  .object({
    id: z.string().min(1).max(200).describe('Id of the catalogue record.'),
    title: text(200).describe('Title of the catalogue record as shown when the design was saved.'),
  })
  .describe('The catalogue record the design started from.')
  .optional()

/**
 * A saved bullet design of the designer: manufacturer name, product name, the choices of base type, ogive form and tip
 * type, and SI values per field key.
 * Inferred type: {@link BulletDesign}.
 */
export const bulletDesign = z.object({
  manufacturerName: text(200).describe('Manufacturer name of the design.'),
  name: text(200).describe('Product name of the design.'),
  choices: z
    .object({
      'base.type': text(64).describe(
        'Base type: `flat`, `boat-tail`, `rebated-boat-tail`, `conical-hollow-base` or `rounded-hollow-base`. Empty: not chosen.',
      ),
      'ogive.form': text(64).describe(
        'Ogive form: `tangent`, `secant`, `hybrid`, `round-nose` or `flat-nose`. Empty: not chosen.',
      ),
      'tip.type': text(64).describe(
        'Tip type: `hollow-point`, `polymer-tip`, `soft-point`, `full-metal-jacket` or `open-meplat`. Empty: not chosen.',
      ),
    })
    .describe('The choices of the designer.'),
  siValues: siValues.describe(
    'Designer field values in SI units by field key: lengths and diameters in m, mass in kg, ratios in 1.',
  ),
  parent,
})

/**
 * The spec values the cartridge drawing reads, in stored units.
 * Inferred type: {@link CartridgeDesign}.
 */
export const cartridgeDesign = z.object({
  table: z.string().min(1).max(8).describe('C.I.P. table of the cartridge (`I` to `XI`).'),
  values: z
    .array(specValue)
    .max(500)
    .describe('Spec values the drawing reads, each in the stored unit of its quantity.'),
  parent,
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

/**
 * One record of a user data file: its `kind`, id, name, save time and the `data` of that kind.
 * Inferred type: {@link UserRecord}.
 */
export const userRecord = z.discriminatedUnion('kind', [
  record('bulletDesign', 'A bullet design of the bullet designer.', bulletDesign),
  record('cartridgeDesign', 'A cartridge drawing of the cartridge designer.', cartridgeDesign),
  record('workbenchState', 'A load of the workbench.', workbenchState),
  record('firearm', 'A firearm of the library: lengths in m, mass in kg, angles in rad.', firearm),
  record('targetSheet', 'A target sheet with its calibration and shot groups.', targetSheet),
])

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
 * The references of `records` to user records that no record of `records` answers: a workbench
 * state's `firearm` and a target sheet's `load`. An old id and a `user:<id>` reference name a
 * record by its id, a `catalogue:` reference is not checked here. Reports only: nothing is dropped.
 */
export function checkUserRefs(records: UserRecords): DanglingRef[] {
  const kindOf = new Map(records.map((r) => [r.id, r.kind]))
  const dangling: DanglingRef[] = []
  const check = (
    r: UserRecord,
    field: string,
    target: string | undefined,
    kind: UserRecordKind,
  ) => {
    if (target === undefined) return
    const parsed = parseRef(target)
    if (parsed?.scope === 'catalogue') return
    if (kindOf.get(parsed?.id ?? target) !== kind)
      dangling.push({ record: r.id, kind: r.kind, field, target })
  }
  for (const r of records) {
    if (r.kind === 'workbenchState') check(r, 'firearm', r.data.firearm, 'firearm')
    else if (r.kind === 'targetSheet') check(r, 'load', r.data.load, 'workbenchState')
  }
  return dangling
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

/** A saved bullet design: choices and SI values per field key. */
export interface BulletDesign extends z.infer<typeof bulletDesign> {}
/** A saved cartridge drawing: table and spec values in stored units. */
export interface CartridgeDesign extends z.infer<typeof cartridgeDesign> {}
/** The user record of kind `targetSheet`. */
export type TargetSheetRecord = Extract<UserRecord, { kind: 'targetSheet' }>
/** One record of a user data file: `kind`, id, name, save time and `data`. */
export type UserRecord = z.infer<typeof userRecord>
/** Discriminator of a user record: `bulletDesign`, `cartridgeDesign`, `workbenchState`, `firearm` or `targetSheet`. */
export type UserRecordKind = UserRecord['kind']
/** A base64 photo stored in a user data file, referenced by id. */
export interface EmbeddedFile extends z.infer<typeof embeddedFile> {}
