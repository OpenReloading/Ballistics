/** The load-file formats the File menu opens, and reading files with them. */
import { type EmbeddedFile, type UserRecord, userDataFormat } from '@rangefoundry/schema'
import type { Translator } from '../i18n/translate.ts'
import { csrLoadFormat } from './csr-load-format.ts'
import { grtLoadFormat } from './grt-load-format.ts'
import { nth } from './nth.ts'
import {
  maxFileBytes,
  type ParsedUserFile,
  parseUserDataFile,
  tooLargeMessage,
} from './user-data.ts'

/** Detected and read from the bytes into records that passed `@rangefoundry/schema` at runtime, so the extension plays no part; a new format is its module plus one entry here. */
export interface LoadFileFormat {
  /** Shown in the open picker and on the Import entry's card. */
  name: string
  /** Media type to file extensions, as the open picker takes them. */
  accept: Record<string, string[]>
  detect: (bytes: Uint8Array) => boolean
  /** A format with a large reader loads it here, so the File menu's routes do not carry it. */
  parse: (bytes: Uint8Array) => ParsedUserFile | Promise<ParsedUserFile>
}

/** The text of `bytes` as UTF-8, a byte order mark left out, as `File.text()` reads it. */
const utf8 = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

/** The user data file comes first and also reads every file no entry claims, so its reasons name what is wrong. */
export const loadFileFormats: LoadFileFormat[] = [
  {
    name: 'RangeFoundry data',
    accept: { 'application/json': ['.json'] },
    detect: (bytes) => {
      const text = utf8(bytes)
      return /^\s*\{/.test(text) && text.includes(`"${userDataFormat}"`)
    },
    parse: (bytes) => parseUserDataFile(utf8(bytes)),
  },
  grtLoadFormat,
  csrLoadFormat,
]

/** The first format of `formats` that detects `bytes`, none for a file over `maxFileBytes`. */
export const loadFormatOf = (bytes: Uint8Array, formats = loadFileFormats) =>
  bytes.byteLength > maxFileBytes ? undefined : formats.find((f) => f.detect(bytes))

/** One file read by the first format of `formats` that detects it, else by the first format. */
export async function readLoadFile(
  bytes: Uint8Array,
  formats = loadFileFormats,
): Promise<ParsedUserFile> {
  if (bytes.byteLength > maxFileBytes) return { ok: false, reason: tooLargeMessage }
  return await (loadFormatOf(bytes, formats) ?? nth(formats, 0)).parse(bytes)
}

/** The warnings, unmapped fields and skipped kinds of a read file as one sentence, empty when it has none. */
export const readNote = (p: ParsedUserFile, t: Translator['t']) =>
  p.ok
    ? [
        ...(p.warnings ?? []).map((w) => t(w.message, w.values)),
        ...(p.unmapped?.length
          ? [t('Not read: {fields}.', { fields: p.unmapped.join(', ') })]
          : []),
        ...(p.skipped?.length
          ? [
              t(
                'Skipped records of a kind this version does not know: {kinds}. They are not kept or exported.',
                { kinds: p.skipped.map((k) => `${k.count} × ${k.kind}`).join(', ') },
              ),
            ]
          : []),
      ].join(' ')
    : ''

/** Every valid file's records, photos, `invalid` entries and notes, and each skipped file with its reason. */
export async function parseFiles(
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
        : await readLoadFile(f.bytes, formats)
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
