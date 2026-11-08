import type { Diagnostic } from '@open-reloading/statistics'
import type { z } from 'zod'
import { isPlain } from './shared.ts'
import {
  type EmbeddedFile,
  type SkippedKind,
  type UserRecords,
  userDataFile,
  userDataFormat,
  userDataVersion,
  withoutUnknownKinds,
} from './user-data.ts'

/** Files above this size are refused unread: a sheet file carries its photo as base64. */
export const maxUserDataBytes = 40_000_000

/** Problems an `invalidRecords` diagnostic carries: a file of many invalid records would otherwise list every one. */
const shownProblems = 3

/** Why a text is no user data file this version reads. */
export type UserDataDiagnostic =
  | Diagnostic<'tooLarge', { maxBytes: number }>
  | Diagnostic<'notJson'>
  | Diagnostic<'notDataFile'>
  | Diagnostic<'otherVersion', { version: unknown; readVersion: number }>
  /** The first issues of the records the schema refuses, and how many more there are. */
  | Diagnostic<'invalidRecords', { issues: z.core.$ZodIssue[]; more: number }>

/** A user data file read: its records and photos, or why it was refused. */
export type UserDataRead =
  | {
      ok: true
      records: UserRecords
      files?: EmbeddedFile[] | undefined
      /** The `invalid` entries of an Export all file, as written: not checked, not part of the format. */
      invalid?: unknown[]
      /** Records of a kind this version does not know, left out of `records`. */
      skipped?: SkippedKind[]
    }
  | { ok: false; diagnostic: UserDataDiagnostic }

/** The size of `text` as a file, in UTF-8 bytes. */
const fileBytes = (text: string) => new TextEncoder().encode(text).byteLength

/**
 * The text of a user data file holding `records` and the photos they point at (`files`), and the
 * `invalid` entries as given (not part of the format the schema reads: {@link readUserDataFile}
 * hands them on as they are).
 */
export const userDataFileText = (
  records: UserRecords,
  files?: EmbeddedFile[],
  invalid?: unknown[],
): string =>
  `${JSON.stringify(
    {
      format: userDataFormat,
      version: userDataVersion,
      records,
      ...(files?.length && { files }),
      ...(invalid?.length && { invalid }),
    },
    null,
    2,
  )}\n`

/** `error` with each record index of `known` turned back into the index in `json`, which holds the skipped records too. */
function atFileIndex(error: z.ZodError, json: unknown, known: unknown) {
  const kept = isPlain(known) && Array.isArray(known['records']) ? known['records'] : []
  const all = isPlain(json) && Array.isArray(json['records']) ? json['records'] : []
  // `kept` is `records` in order without the skipped records, which are objects
  const index: number[] = []
  all.forEach((r: unknown, i) => {
    if (r === kept[index.length]) index.push(i)
  })
  return error.issues.map((i) => {
    const [field, at, ...rest] = i.path
    return field === 'records' && typeof at === 'number'
      ? { ...i, path: [field, index[at] ?? at, ...rest] }
      : i
  })
}

/** The diagnostic of a parsed text that is no user data file of this version, if any. */
function formatProblem(json: unknown): UserDataDiagnostic | undefined {
  const format = isPlain(json) ? json['format'] : undefined
  if (format === userDataFormat && isPlain(json) && json['version'] !== userDataVersion)
    return {
      code: 'otherVersion',
      params: { version: json['version'], readVersion: userDataVersion },
    }
  if (format !== userDataFormat) return { code: 'notDataFile', params: {} }
  return undefined
}

/** One file, validated against the schema as a whole but for records of a kind it does not know. */
export function readUserDataFile(text: string): UserDataRead {
  if (fileBytes(text) > maxUserDataBytes)
    return { ok: false, diagnostic: { code: 'tooLarge', params: { maxBytes: maxUserDataBytes } } }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, diagnostic: { code: 'notJson', params: {} } }
  }
  const problem = formatProblem(json)
  if (problem) return { ok: false, diagnostic: problem }
  const { json: known, skipped } = withoutUnknownKinds(json)
  const r = userDataFile.safeParse(known)
  if (!r.success) {
    const issues = skipped.length ? atFileIndex(r.error, json, known) : r.error.issues
    const more = Math.max(0, issues.length - shownProblems)
    const shown = issues.slice(0, shownProblems)
    return { ok: false, diagnostic: { code: 'invalidRecords', params: { issues: shown, more } } }
  }
  const invalid = isPlain(json) ? json['invalid'] : undefined
  return {
    ok: true,
    records: r.data.records,
    files: r.data.files,
    ...(Array.isArray(invalid) && invalid.length > 0 && { invalid }),
    ...(skipped.length > 0 && { skipped }),
  }
}

/** The text of {@link userDataFileText}, or why {@link readUserDataFile} would refuse it. */
export function checkedUserDataFileText(
  records: UserRecords,
  files?: EmbeddedFile[],
  invalid?: unknown[],
): { ok: true; text: string } | { ok: false; diagnostic: UserDataDiagnostic } {
  const text = userDataFileText(records, files, invalid)
  const check = readUserDataFile(text)
  return check.ok ? { ok: true, text } : check
}

/** The photos of `files` in order while they fit in `room` bytes, and the ids of those left out. */
function photosThatFit(files: EmbeddedFile[], room: number) {
  let left = room
  const kept: EmbeddedFile[] = []
  const out: string[] = []
  for (const f of files) {
    // a photo adds its entry and less than 64 characters of indentation and separators
    const size = fileBytes(JSON.stringify(f)) + 64
    if (size <= left) {
      kept.push(f)
      left -= size
    } else out.push(f.id)
  }
  return { kept, left: out }
}

/**
 * The text of an Export all file: `records` and the `invalid` ones with their photos in order
 * while the text stays under {@link maxUserDataBytes}, the ids of the photos left out (`left`), or
 * why {@link readUserDataFile} would refuse it.
 */
export function exportAllFileText(
  records: UserRecords,
  files: EmbeddedFile[] = [],
  invalid: unknown[] = [],
): { ok: true; text: string; left: string[] } | { ok: false; diagnostic: UserDataDiagnostic } {
  const all = checkedUserDataFileText(records, files, invalid)
  if (all.ok) return { ...all, left: [] }
  if (all.diagnostic.code !== 'tooLarge') return all
  const room = maxUserDataBytes - fileBytes(userDataFileText(records, undefined, invalid)) - 64
  const { kept, left } = photosThatFit(files, room)
  const checked = checkedUserDataFileText(records, kept, invalid)
  return checked.ok ? { ...checked, left } : checked
}
