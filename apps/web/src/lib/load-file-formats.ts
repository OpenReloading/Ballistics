/** The load-file formats the File menu opens, and reading files with them. */
import { type EmbeddedFile, type UserRecord, userDataFormat } from '@open-reloading/schema'
import type { Translator } from '../i18n/translate.ts'
import { translateMessage } from './core-messages.ts'
import { nth } from './nth.ts'
import {
  maxFileBytes,
  type ParsedUserFile,
  parseUserDataFile,
  tooLargeMessage,
} from './user-data.ts'

/**
 * A load-file format the File menu opens and imports: told by `detect`, read by `parse` into user
 * records that passed `@open-reloading/schema`, both from the file's bytes, so the extension plays
 * no part. A new format is its module plus one entry in `loadFileFormats`.
 */
export interface LoadFileFormat {
  /** Shown in the open picker and on the Import entry's card. */
  name: string
  /** Media type to file extensions, as the open picker takes them. */
  accept: Record<string, string[]>
  detect: (bytes: Uint8Array) => boolean
  parse: (bytes: Uint8Array) => ParsedUserFile
}

/** The text of `bytes` as UTF-8, a byte order mark left out, as `File.text()` reads it. */
const utf8 = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

/**
 * Every load-file format, detected in this order. The OpenReloading user data file, a JSON object
 * that names its format, comes first and also reads every file no entry claims, so its reasons name
 * what is wrong.
 */
export const loadFileFormats: LoadFileFormat[] = [
  {
    name: 'OpenReloading data',
    accept: { 'application/json': ['.json'] },
    detect: (bytes) => {
      const text = utf8(bytes)
      return /^\s*\{/.test(text) && text.includes(`"${userDataFormat}"`)
    },
    parse: (bytes) => parseUserDataFile(utf8(bytes)),
  },
]

/** The first format of `formats` that detects `bytes`, none for a file over `maxFileBytes`. */
export const loadFormatOf = (bytes: Uint8Array, formats = loadFileFormats) =>
  bytes.byteLength > maxFileBytes ? undefined : formats.find((f) => f.detect(bytes))

/** One file read by the first format of `formats` that detects it, else by the first format. */
export function readLoadFile(bytes: Uint8Array, formats = loadFileFormats): ParsedUserFile {
  if (bytes.byteLength > maxFileBytes) return { ok: false, reason: tooLargeMessage }
  return (loadFormatOf(bytes, formats) ?? nth(formats, 0)).parse(bytes)
}

/** The warnings and unmapped fields of a read file as one sentence, empty when it has none. */
export const readNote = (p: ParsedUserFile, t: Translator['t']) =>
  p.ok
    ? [
        ...(p.warnings ?? []).map((w) => translateMessage(w, t)),
        ...(p.unmapped?.length
          ? [t('Not read: {fields}.', { fields: p.unmapped.join(', ') })]
          : []),
      ].join(' ')
    : ''

/** Every valid file's records, photos, `invalid` entries and notes, and each skipped file with its reason. */
export function parseFiles(
  files: { name: string; bytes?: Uint8Array | undefined }[],
  formats = loadFileFormats,
  t: Translator['t'],
) {
  const records: UserRecord[] = []
  const embedded: EmbeddedFile[] = []
  const invalid: unknown[] = []
  const skipped: { name: string; reason: string }[] = []
  const notes: { name: string; note: string }[] = []
  for (const f of files) {
    const p: ParsedUserFile =
      f.bytes === undefined
        ? { ok: false, reason: tooLargeMessage }
        : readLoadFile(f.bytes, formats)
    if (p.ok) {
      records.push(...p.records)
      embedded.push(...(p.files ?? []))
      invalid.push(...(p.invalid ?? []))
      const note = readNote(p, t)
      if (note) notes.push({ name: f.name, note })
    } else skipped.push({ name: f.name, reason: p.reason })
  }
  return { records, files: embedded, invalid, skipped, notes }
}
