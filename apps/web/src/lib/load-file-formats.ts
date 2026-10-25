/** The load-file formats the File menu opens, and reading files with them. */
import type { EmbeddedFile, UserRecord } from '@openreloading/schema'
import {
  maxFileBytes,
  type ParsedUserFile,
  parseUserDataFile,
  tooLargeMessage,
} from './user-data.ts'

/**
 * A load-file format the File menu opens and imports: told by `detect`, read by `parse` into user
 * records that passed `@openreloading/schema`. A new format is its module plus one entry in
 * `loadFileFormats`.
 */
export interface LoadFileFormat {
  /** Shown in the open picker. */
  name: string
  /** Media type to file extensions, as the open picker takes them. */
  accept: Record<string, string[]>
  detect: (text: string) => boolean
  parse: (text: string) => ParsedUserFile
}

/**
 * Every load-file format, detected in this order. The OpenReloading user data file stays last and
 * takes every file no other entry claims, so its reasons name what is wrong with any other file.
 */
export const loadFileFormats: LoadFileFormat[] = [
  {
    name: 'OpenReloading data',
    accept: { 'application/json': ['.json'] },
    detect: () => true,
    parse: parseUserDataFile,
  },
]

/** One file read by the first format of `formats` that detects it. */
export function readLoadFile(text: string, formats = loadFileFormats): ParsedUserFile {
  if (text.length > maxFileBytes) return { ok: false, reason: tooLargeMessage }
  const format = formats.find((f) => f.detect(text)) ?? formats[formats.length - 1]
  return format.parse(text)
}

/** The warnings and unmapped fields of a read file as one sentence, empty when it has none. */
export const readNote = (p: ParsedUserFile) =>
  p.ok
    ? [
        ...(p.warnings ?? []),
        ...(p.unmapped?.length ? [`Not read: ${p.unmapped.join(', ')}.`] : []),
      ].join(' ')
    : ''

/** Every valid file's records, photos, `invalid` entries and notes, and each skipped file with its reason. */
export function parseFiles(files: { name: string; text?: string }[], formats = loadFileFormats) {
  const records: UserRecord[] = []
  const embedded: EmbeddedFile[] = []
  const invalid: unknown[] = []
  const skipped: { name: string; reason: string }[] = []
  const notes: { name: string; note: string }[] = []
  for (const f of files) {
    const p: ParsedUserFile =
      f.text === undefined ? { ok: false, reason: tooLargeMessage } : readLoadFile(f.text, formats)
    if (p.ok) {
      records.push(...p.records)
      embedded.push(...(p.files ?? []))
      invalid.push(...(p.invalid ?? []))
      const note = readNote(p)
      if (note) notes.push({ name: f.name, note })
    } else skipped.push({ name: f.name, reason: p.reason })
  }
  return { records, files: embedded, invalid, skipped, notes }
}
