/** The user data file: its text, parsing and validation, and import planning against the browser store. */
import {
  checkUserRefs,
  type EmbeddedFile,
  type UserRecord,
  userDataFile,
  userDataFormat,
  userDataVersion,
  userRecord,
  versionProblem,
} from '@openreloading/schema'
import { z } from 'zod'

/** Files above this size are skipped on import: a sheet file carries its photo as base64. */
export const maxFileBytes = 40_000_000
export const tooLargeMessage = `The file is larger than ${maxFileBytes / 1e6} MB.`

/** The size of `text` as a file, UTF-8 bytes, as Open and Import compare it with `maxFileBytes`. */
const fileBytes = (text: string) => new TextEncoder().encode(text).byteLength

/**
 * The text of a user data file holding `records` and the photos they point at (`files`). The
 * `invalid` records of the browser, as stored, are added under `invalid` (not part of the format
 * the schema reads: `parseUserDataFile` hands them on as they are).
 */
export const userDataText = (
  records: UserRecord[],
  files?: EmbeddedFile[],
  invalid?: InvalidRecord[],
) =>
  `${JSON.stringify(
    {
      format: userDataFormat,
      version: userDataVersion,
      records,
      ...(files?.length && { files }),
      ...(invalid?.length && { invalid: invalid.map((i) => i.raw) }),
    },
    null,
    2,
  )}\n`

export type ParsedUserFile =
  | {
      ok: true
      records: UserRecord[]
      files?: EmbeddedFile[]
      /** The `invalid` entries of an Export all file, as written: not checked, not part of the format. */
      invalid?: unknown[]
      /** Fields of the file mapped to no record field, as the format names them. */
      unmapped?: string[]
      warnings?: string[]
    }
  | { ok: false; reason: string }

/** One file, validated against `@openreloading/schema` as a whole. */
export function parseUserDataFile(text: string): ParsedUserFile {
  if (fileBytes(text) > maxFileBytes) return { ok: false, reason: tooLargeMessage }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'The file is not JSON.' }
  }
  const problem = versionProblem(json)
  if (problem) return { ok: false, reason: problem }
  const r = userDataFile.safeParse(json)
  const invalid = (json as { invalid?: unknown }).invalid
  return r.success
    ? {
        ok: true,
        records: r.data.records,
        files: r.data.files,
        ...(Array.isArray(invalid) && invalid.length > 0 && { invalid }),
      }
    : { ok: false, reason: z.prettifyError(r.error) }
}

/** The text of `userDataText`, or why Open and Import would reject it (too large, invalid). */
export function checkedUserDataText(
  records: UserRecord[],
  files?: EmbeddedFile[],
  invalid?: InvalidRecord[],
): { ok: true; text: string } | { ok: false; reason: string } {
  const text = userDataText(records, files, invalid)
  const check = parseUserDataFile(text)
  return check.ok ? { ok: true, text } : check
}

/**
 * The text of an Export all file: `records` and the `invalid` ones with their photos in order
 * while the text stays under `maxFileBytes`, the ids of the photos left out (`left`), or why
 * Import would reject it.
 */
export function exportAllText(
  records: UserRecord[],
  files: EmbeddedFile[] = [],
  invalid: InvalidRecord[] = [],
): { ok: true; text: string; left: string[] } | { ok: false; reason: string } {
  const all = checkedUserDataText(records, files, invalid)
  if (all.ok || all.reason !== tooLargeMessage) return all.ok ? { ...all, left: [] } : all
  // a photo adds its entry and less than 64 characters of indentation and separators
  let room = maxFileBytes - fileBytes(userDataText(records, undefined, invalid)) - 64
  const kept: EmbeddedFile[] = []
  const left: string[] = []
  for (const f of files) {
    const size = fileBytes(JSON.stringify(f)) + 64
    if (size <= room) {
      kept.push(f)
      room -= size
    } else left.push(f.id)
  }
  const checked = checkedUserDataText(records, kept, invalid)
  return checked.ok ? { ...checked, left } : checked
}

/**
 * JSON with sorted keys and without empty texts, so equal data compares equal whatever its key
 * order and whether an empty text is given or left out.
 */
export function canonicalJson(x: unknown): string {
  return JSON.stringify(x, function (_, v) {
    if (v === '' && !Array.isArray(this)) return
    return v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v
  })
}

/** The key a page compares to see unsaved changes when the record's name counts as well. */
export const namedKey = (data: unknown, name: string) => canonicalJson([name, data])

/** `key` of `namedKey` with another name: the saved copy renamed, its data as saved. */
export const renamedKey = (key: string, name: string) =>
  canonicalJson([name, (JSON.parse(key) as [string, unknown])[1]])

/** A record of the browser store that fails the schema, kept as stored. */
export interface InvalidRecord {
  /** The stored value. */
  raw: unknown
  /** Why the schema rejects it. */
  error: string
  /** Its `id`, `name` and `kind` where it has them as texts. */
  id?: string
  name?: string
  kind?: string
}

/** The records of the browser store that pass the schema, and those that do not, as stored. */
export function validRecords(raw: unknown[]) {
  const records: UserRecord[] = []
  const invalid: InvalidRecord[] = []
  for (const r of raw) {
    const p = userRecord.safeParse(r)
    if (p.success) records.push(p.data)
    else {
      const text = (k: string) => {
        const v = (r as Record<string, unknown> | null)?.[k]
        return typeof v === 'string' ? v : undefined
      }
      invalid.push({
        raw: r,
        error: z.prettifyError(p.error),
        id: text('id'),
        name: text('name'),
        kind: text('kind'),
      })
    }
  }
  return { records, invalid }
}

const content = (r: UserRecord) => canonicalJson({ kind: r.kind, name: r.name, data: r.data })

/** Sorts incoming records against the stored ones by `id`: new, equal content, other content. */
export function planImport(incoming: UserRecord[], stored: UserRecord[]) {
  const byId = new Map(stored.map((r) => [r.id, r]))
  const added: UserRecord[] = []
  const equal: UserRecord[] = []
  const conflicts: { incoming: UserRecord; stored: UserRecord }[] = []
  for (const r of incoming) {
    const s = byId.get(r.id)
    if (!s) added.push(r)
    else if (content(s) === content(r)) equal.push(r)
    else conflicts.push({ incoming: r, stored: s })
  }
  return { added, equal, conflicts }
}

/**
 * The references of `opened` that point at no record of `opened` and `stored` (browser records
 * with another id), as one sentence; empty when all resolve.
 */
export function refNote(opened: UserRecord[], stored: UserRecord[]): string {
  const ids = new Set(opened.map((r) => r.id))
  const name = new Map(opened.map((r) => [r.id, r.name]))
  const all = [...opened, ...stored.filter((r) => !ids.has(r.id))]
  const lines = checkUserRefs(all)
    .filter((d) => ids.has(d.record))
    .map((d) => `${name.get(d.record)}: the ${d.field} ${d.target} is not in this browser`)
  return lines.length ? `Not found: ${lines.join('; ')}.` : ''
}
