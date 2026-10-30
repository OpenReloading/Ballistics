/** The data file import and Export all of the File menu, which loads them on use (`file-menu.tsx`). */
import type { EmbeddedFile, UserRecord } from '@open-reloading/schema'
import type { Translator } from '../i18n/translate.ts'
import { errorText } from './error-text.ts'
import { parseFiles } from './load-file-formats.ts'
import { type InvalidRecord, planImport } from './user-data.ts'
import { photoIds } from './user-photos.ts'
import { putInvalid, putRecords, storedRecords, storePhotos } from './user-store.ts'

export { exportAllText } from './user-data.ts'

/** What an import of data files stored, skipped and found in conflict. */
export type ImportReport = {
  added: number
  equal: number
  skipped: { name: string; reason: string }[]
  /** Warnings and fields not read of the files read. */
  notes: { name: string; note: string }[]
  conflicts: { incoming: UserRecord; stored: UserRecord }[]
  /** Records not stored because an invalid browser record has their id. */
  blocked: UserRecord[]
  /** The `invalid` entries of the files: stored as invalid records, left out for an id the browser has, or unstorable. */
  invalid: { added: number; kept: number; unstorable: number }
  /** Photos the files carry, stored with the records that are replaced. */
  files: EmbeddedFile[]
  /** The report's sentences in the language of `tr`; empty where there is nothing to say. */
  said: (tr: Translator) => { summary: string; invalid: string; held: string; conflicts: string }
}

function reportSaid(report: ImportReport, { t, tn }: Translator) {
  const { invalid, conflicts, blocked } = report
  const held = blocked.length
    ? tn(
        blocked.length,
        '{count} record not imported because an invalid browser record has its id: {names}. Download it raw and delete it under Open, Invalid records, then import again.',
        '{count} records not imported because invalid browser records have their ids: {names}. Download them raw and delete them under Open, Invalid records, then import again.',
        { names: blocked.map((r) => r.name).join(', ') },
      )
    : ''
  return {
    summary: t('{added} records added, {equal} already in this browser, {skipped} files skipped.', {
      added: report.added,
      equal: report.equal,
      skipped: report.skipped.length,
    }),
    invalid:
      invalid.added + invalid.kept + invalid.unstorable > 0
        ? `${[
            tn(
              invalid.added,
              '{count} invalid record restored',
              '{count} invalid records restored',
            ),
            invalid.kept > 0 &&
              t('{count} left out because a browser record has their id', { count: invalid.kept }),
            invalid.unstorable > 0 &&
              t('{count} left out without a text id', { count: invalid.unstorable }),
          ]
            .filter(Boolean)
            .join(', ')}.`
        : '',
    held,
    conflicts: conflicts.length
      ? tn(
          conflicts.length,
          '{count} record has the id of a browser record with other content: {names}. Replace the browser copy?',
          '{count} records have the id of a browser record with other content: {names}. Replace the browser copies?',
          { names: conflicts.map((c) => c.stored.name).join(', ') },
        )
      : '',
  }
}

/** What an import reports to: the store hooks and the page's messages. */
interface ImportIo {
  onStored?: (() => void) | undefined
  noteStorage: () => void
  fail: (said: (tr: Translator) => string) => void
  show: (report: ImportReport) => void
  /** The note on the records `added` refer to and the browser does not hold. */
  refs: (added: UserRecord[]) => Promise<string>
}

/** A file to import: its name and its bytes, read when its turn comes (undefined when it is too large). */
export type ImportFile = { name: string; read: () => Promise<Uint8Array | undefined> }

/** Reads and stores one file at a time, so several large files are not held at once. */
export async function importTexts(files: ImportFile[], io: ImportIo, { t }: Translator) {
  const total: ImportReport = {
    added: 0,
    equal: 0,
    skipped: [],
    notes: [],
    conflicts: [],
    blocked: [],
    invalid: { added: 0, kept: 0, unstorable: 0 },
    files: [],
    said: (tr) => reportSaid(total, tr),
  }
  const added: UserRecord[] = []
  for (const f of files) {
    try {
      const {
        records,
        files: photos,
        invalid,
        skipped,
        notes,
      } = await parseFiles([{ name: f.name, bytes: await f.read() }], undefined, t)
      const stored = await storedRecords()
      const plan = planImport(records, stored.records, stored.invalid)
      // an equal record may come to a browser without its photo
      await storePhotos(photos, [...plan.added, ...plan.equal])
      await putRecords(plan.added)
      added.push(...plan.added)
      total.added += plan.added.length
      // after the valid records, and never over a record with its id
      const put = await putInvalid(invalid)
      for (const k of ['added', 'kept', 'unstorable'] as const) total.invalid[k] += put[k]
      total.equal += plan.equal.length
      total.skipped.push(...skipped)
      total.notes.push(...notes)
      total.conflicts.push(...plan.conflicts)
      total.blocked.push(...plan.blocked)
      // kept for Replace: only the photos of the records it may store
      const wanted = new Set(photoIds(plan.conflicts.map((c) => c.incoming)))
      total.files.push(...photos.filter((p) => wanted.has(p.id)))
    } catch (e) {
      io.fail(({ tn }) =>
        tn(
          total.added,
          'Import stored {count} record, then failed on {name}: {error}',
          'Import stored {count} records, then failed on {name}: {error}',
          { name: f.name, error: errorText(e) },
        ),
      )
      if (total.added) io.onStored?.()
      return
    }
  }
  // once all files are stored, so a reference to a record of a later file resolves
  const refs = await io.refs(added)
  if (refs) total.notes.push({ name: t('References'), note: refs })
  io.onStored?.()
  io.noteStorage()
  io.show(total)
}

/** The sentences after an export: the photos left out for the size limit and the invalid records in it. */
export function exportNotes(
  records: UserRecord[],
  invalid: InvalidRecord[],
  left: string[],
  t: Translator['t'],
  tn: Translator['tn'],
) {
  const without = records.flatMap((s) =>
    s.kind === 'targetSheet' && left.includes(s.data.photo ?? '') ? [s.name] : [],
  )
  const photos = without.length
    ? t(
        'Left out for the file size limit: the photos of {names}. Save on a sheet keeps its photo.',
        { names: without.join(', ') },
      )
    : ''
  const raw = invalid.length
    ? tn(
        invalid.length,
        '{count} invalid record is in it as stored.',
        '{count} invalid records are in it as stored.',
      )
    : ''
  return [raw, photos].filter(Boolean).join(' ')
}
