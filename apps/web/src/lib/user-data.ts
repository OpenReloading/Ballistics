/** The user data file: its text, parsing and validation, and import planning against the browser store. */
import {
  checkUserRefs,
  type EmbeddedFile,
  parseRef,
  type UserRecord,
  userDataFile,
  userDataFormat,
  userDataVersion,
  userRecord,
  versionProblem,
} from '@open-reloading/schema'
import { z } from 'zod'
import type { Translator } from '../i18n/translate.ts'
import { translateMessage } from './core-messages.ts'

/** Files above this size are skipped on import: a sheet file carries its photo as base64. */
export const maxFileBytes = 40_000_000
export const tooLargeMessage = `The file is larger than ${maxFileBytes / 1e6} MB.`
const notJsonMessage = 'The file is not JSON.'

/** A `reason` of a file that was not read, in the language of `t`: the app's own two, else a message of the packages. */
export function reasonText(reason: string, t: Translator['t']) {
  if (reason === tooLargeMessage)
    return t('The file is larger than {size} MB.', { size: maxFileBytes / 1e6 })
  if (reason === notJsonMessage) return t('The file is not JSON.')
  return translateMessage(reason, t)
}

/** The size of `text` as a file, UTF-8 bytes, as Open and Import compare it with `maxFileBytes`. */
const fileBytes = (text: string) => new TextEncoder().encode(text).byteLength

/**
 * The text of a user data file holding `records` and the photos they point at (`files`). The
 * `invalid` records of the browser, as stored, are added under `invalid` (not part of the format
 * the schema reads: `parseUserDataFile` hands them on as they are).
 */
export const userDataText = (
  records: UserRecord[],
  files?: EmbeddedFile[] | undefined,
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
      files?: EmbeddedFile[] | undefined
      /** The `invalid` entries of an Export all file, as written: not checked, not part of the format. */
      invalid?: unknown[]
      /** Fields of the file mapped to no record field, as the format names them. */
      unmapped?: string[]
      warnings?: string[]
    }
  | { ok: false; reason: string }

/** One file, validated against `@open-reloading/schema` as a whole. */
export function parseUserDataFile(text: string): ParsedUserFile {
  if (fileBytes(text) > maxFileBytes) return { ok: false, reason: tooLargeMessage }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, reason: notJsonMessage }
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
  files?: EmbeddedFile[] | undefined,
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
  id?: string | undefined
  name?: string | undefined
  kind?: string | undefined
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

/** The id of the user manufacturer a bullet, firearm, case or case capacity `record` names; undefined for none. */
export function makerIdOf(record: UserRecord): string | undefined {
  const text =
    record.kind === 'bullet' || record.kind === 'firearm' || record.kind === 'case'
      ? record.data.manufacturer
      : record.kind === 'caseCapacity'
        ? record.data.caseManufacturer
        : undefined
  const ref = text ? parseRef(text) : undefined
  return ref?.scope === 'user' ? ref.id : undefined
}

/**
 * The user manufacturer of `pool` that `record` names: what a file or link of that one record
 * carries, so the maker does not dangle where it is opened. None for another kind, a catalogue
 * manufacturer or a maker `pool` lacks.
 */
export function makerRecordsOf(record: UserRecord, pool: readonly UserRecord[]): UserRecord[] {
  const id = makerIdOf(record)
  return id ? pool.filter((r) => r.kind === 'manufacturer' && r.id === id) : []
}

/**
 * The records of `pool` that `record` names by `user:<id>`, with the
 * user manufacturers they name: what a file of that record carries along, such as the cartridge,
 * bullet and powder of a load read from another program's load file.
 */
export function linkedRecordsOf(record: UserRecord, pool: readonly UserRecord[]): UserRecord[] {
  // alone, every user reference of `record` dangles, so the check lists them all
  const ids = new Set(checkUserRefs([record]).map((d) => parseRef(d.target)?.id))
  const linked = pool.filter((r) => r.id !== record.id && ids.has(r.id))
  // a maker the record names itself and one of its records names too is carried once
  return [...new Set([...linked, ...linked.flatMap((r) => makerRecordsOf(r, pool))])]
}

/**
 * The user manufacturer `record` names as a file or link carries it: the stored one, else the one
 * that came with the opened file or link (`carried`), which the store may lack or hold invalid.
 */
export function makersToCarry(
  record: UserRecord,
  stored: readonly UserRecord[],
  carried: readonly UserRecord[],
): UserRecord[] {
  const own = makerRecordsOf(record, stored)
  return own.length ? own : makerRecordsOf(record, carried)
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
export function refNote(opened: UserRecord[], stored: UserRecord[], t: Translator['t']): string {
  const ids = new Set(opened.map((r) => r.id))
  const name = new Map(opened.map((r) => [r.id, r.name]))
  const all = [...opened, ...stored.filter((r) => !ids.has(r.id))]
  const lines = checkUserRefs(all)
    .filter((d) => ids.has(d.record))
    .map((d) =>
      t('{name}: the {field} {target} is not in this browser', {
        name: name.get(d.record) ?? '',
        field: d.field,
        target: d.target,
      }),
    )
  return lines.length ? t('Not found: {list}.', { list: lines.join('; ') }) : ''
}
