/** The user data file: its text, parsing and validation, and import planning against the browser store. */

import {
  checkedUserDataFileText,
  checkUserRefs,
  type EmbeddedFile,
  exportAllFileText,
  maxUserDataBytes,
  parseRef,
  readUserDataFile,
  type SkippedKind,
  type UserDataDiagnostic,
  type UserRecord,
  userDataFileText,
  userRecord,
} from '@open-reloading/schema'
import { z } from 'zod'
import type { Message, Translator } from '../i18n/translate.ts'
import { translateMessage } from './core-messages.ts'

/** Files above this size are skipped on import: a sheet file carries its photo as base64. */
export const maxFileBytes = maxUserDataBytes
export const tooLargeMessage = `The file is larger than ${maxFileBytes / 1e6} MB.`
const notJsonMessage = 'The file is not JSON.'
const notDataFileMessage = 'The file is not a RangeFoundry data file.'

/** A `reason` of a file that was not read, in the language of `t`: the app's own three, else a message of the packages. */
export function reasonText(reason: string, { t, tn }: Pick<Translator, 't' | 'tn'>) {
  if (reason === tooLargeMessage)
    return t('The file is larger than {size} MB.', { size: maxFileBytes / 1e6 })
  if (reason === notJsonMessage) return t('The file is not JSON.')
  if (reason === notDataFileMessage) return t('The file is not a RangeFoundry data file.')
  // zod's `✖` and `→ at` lines, then the problem count on the last line only: no `m` flag, since a key in the file may carry a line of its own into a message.
  if (!reason.startsWith('✖ ')) return translateMessage(reason, t)
  return reason
    .replace(/^✖ (.+)$/gm, (_, message: string) => `✖ ${translateMessage(message, t)}`)
    .replace(/^ {2}→ at (.+)$/gm, (_, path: string) => `  ${t('→ at {path}', { path })}`)
    .replace(
      /\nand (\d+) more problems?$/,
      (_, n: string) =>
        `\n${tn(Number(n), 'and {count} more problem', 'and {count} more problems')}`,
    )
}

/** Invalid records ride along under `invalid`, outside the format the schema reads. */
export const userDataText = (
  records: UserRecord[],
  files?: EmbeddedFile[] | undefined,
  invalid?: InvalidRecord[],
) =>
  userDataFileText(
    records,
    files,
    invalid?.map((i) => i.raw),
  )

/** A warning of a read file as its message and values, worded where it is shown. */
export interface WordedWarning {
  message: Message
  values: Record<string, string | number>
}

export type ParsedUserFile =
  | {
      ok: true
      records: UserRecord[]
      files?: EmbeddedFile[] | undefined
      /** The `invalid` entries of an Export all file, as written: not checked, not part of the format. */
      invalid?: unknown[]
      /** Fields of the file mapped to no record field, as the format names them. */
      unmapped?: string[]
      warnings?: WordedWarning[]
      /** Records of a kind this version does not know, left out of `records`. */
      skipped?: SkippedKind[]
    }
  | { ok: false; reason: string }

/** The first problems of the records the schema refuses, as zod words them, and how many more there are. */
function problemsText(issues: z.core.$ZodIssue[], more: number) {
  const text = z.prettifyError(new z.ZodError(issues))
  return more > 0 ? `${text}\nand ${more} more problem${more === 1 ? '' : 's'}` : text
}

/** The English reason of a diagnostic of the user data file, which `reasonText` words. */
export function reasonOf(d: UserDataDiagnostic): string {
  switch (d.code) {
    case 'tooLarge':
      return tooLargeMessage
    case 'notJson':
      return notJsonMessage
    case 'notDataFile':
      return notDataFileMessage
    case 'otherVersion':
      return `The file has format version ${JSON.stringify(d.params.version)}; this app reads version ${d.params.readVersion}.`
    case 'invalidRecords':
      return problemsText(d.params.issues, d.params.more)
  }
}

/** One file, validated against `@open-reloading/schema` as a whole but for records of a kind it does not know. */
export function parseUserDataFile(text: string): ParsedUserFile {
  const read = readUserDataFile(text)
  return read.ok ? read : { ok: false, reason: reasonOf(read.diagnostic) }
}

/** The text of `userDataText`, or why Open and Import would reject it (too large, invalid). */
export function checkedUserDataText(
  records: UserRecord[],
  files?: EmbeddedFile[] | undefined,
  invalid?: InvalidRecord[],
): { ok: true; text: string } | { ok: false; reason: string } {
  const checked = checkedUserDataFileText(
    records,
    files,
    invalid?.map((i) => i.raw),
  )
  return checked.ok ? checked : { ok: false, reason: reasonOf(checked.diagnostic) }
}

/** Photos in order while the text stays under `maxFileBytes`; the ids left out in `left`. */
export function exportAllText(
  records: UserRecord[],
  files: EmbeddedFile[] = [],
  invalid: InvalidRecord[] = [],
): { ok: true; text: string; left: string[] } | { ok: false; reason: string } {
  const all = exportAllFileText(
    records,
    files,
    invalid.map((i) => i.raw),
  )
  return all.ok ? all : { ok: false, reason: reasonOf(all.diagnostic) }
}

/** Sorted keys and no empty texts, so equal data compares equal. */
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

/** So the maker does not dangle where a file or link of that one record opens. */
export function makerRecordsOf(record: UserRecord, pool: readonly UserRecord[]): UserRecord[] {
  const id = makerIdOf(record)
  return id ? pool.filter((r) => r.kind === 'manufacturer' && r.id === id) : []
}

/** What a file of that record carries along, such as a load's records read from another program's load file. */
export function linkedRecordsOf(record: UserRecord, pool: readonly UserRecord[]): UserRecord[] {
  // alone, every user reference of `record` dangles, so the check lists them all
  const ids = new Set(checkUserRefs([record]).map((d) => parseRef(d.target)?.id))
  const linked = pool.filter((r) => r.id !== record.id && ids.has(r.id))
  const sessions = pool.filter(
    (r) => r.kind === 'session' && r.data.strings.some((s) => s.load === `user:${record.id}`),
  )
  // a maker the record names itself and one of its records names too is carried once
  return [...new Set([...linked, ...linked.flatMap((r) => makerRecordsOf(r, pool)), ...sessions])]
}

/** The stored one, else the one carried with the opened file or link, which the store may lack or hold invalid. */
export function makersToCarry(
  record: UserRecord,
  stored: readonly UserRecord[],
  carried: readonly UserRecord[],
): UserRecord[] {
  const own = makerRecordsOf(record, stored)
  return own.length ? own : makerRecordsOf(record, carried)
}

const content = (r: UserRecord) => canonicalJson({ kind: r.kind, name: r.name, data: r.data })

/** `blocked` by an invalid stored record of the id, which nothing may overwrite. */
export function planImport(
  incoming: UserRecord[],
  stored: UserRecord[],
  invalid: readonly InvalidRecord[] = [],
) {
  const byId = new Map(stored.map((r) => [r.id, r]))
  const held = new Set(invalid.map((i) => i.id))
  const added: UserRecord[] = []
  const equal: UserRecord[] = []
  const conflicts: { incoming: UserRecord; stored: UserRecord }[] = []
  const blocked: UserRecord[] = []
  for (const r of incoming) {
    const s = byId.get(r.id)
    if (held.has(r.id)) blocked.push(r)
    else if (!s) added.push(r)
    else if (content(s) === content(r)) equal.push(r)
    else conflicts.push({ incoming: r, stored: s })
  }
  return { added, equal, conflicts, blocked }
}

/** Empty when all resolve. */
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
