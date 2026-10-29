/**
 * The browser store of user records and target photos (IndexedDB); the workspace folder handle is
 * kept in the same database (`workspace-folder.ts`).
 */
import type { EmbeddedFile, UserRecord } from '@open-reloading/schema'
import { validRecords } from './user-data.ts'
import { inStore } from './user-db.ts'
import { embeddedFileBlob, photoIds } from './user-photos.ts'

/** The schema-valid records of the browser store and the invalid ones, as stored: none is dropped. */
export const storedRecords = async () =>
  validRecords((await inStore('records', 'readonly', (s) => s.getAll())) ?? [])

/** The photo id a stored value points at as a target sheet, whether or not it passes the schema. */
export const rawPhotoId = (raw: unknown) => {
  const photo = (raw as { data?: { photo?: unknown | undefined } } | null)?.data?.photo
  return typeof photo === 'string' ? photo : undefined
}

/**
 * Ids of the photos a stored target sheet points at, an invalid sheet's too: its photo stays
 * with it.
 */
export async function storedPhotoIds() {
  const { records, invalid } = await storedRecords()
  const raw = invalid.flatMap((i) => rawPhotoId(i.raw) ?? [])
  return new Set([...photoIds(records), ...raw])
}

/**
 * Stores the `invalid` entries of an Export all file as they are, each only where no stored
 * record has its id, so a valid record is never overwritten. Counts the entries stored (`added`),
 * left out for an id already in the store (`kept`) and without a text id, which no record has
 * (`unstorable`).
 */
export async function putInvalid(raw: unknown[]) {
  const n = { added: 0, kept: 0, unstorable: 0 }
  for (const r of raw) {
    if (typeof (r as { id?: unknown } | null)?.id !== 'string') n.unstorable++
    else if (await putRecordIfAbsent(r as UserRecord)) n.added++
    else n.kept++
  }
  return n
}

/** The stored record `id` as written, unvalidated; undefined when absent. */
export const storedRecord = (id: string) =>
  inStore('records', 'readonly', (s) => s.get(id)) as Promise<UserRecord | undefined>

export const putRecords = (records: UserRecord[]) =>
  inStore('records', 'readwrite', (s) => {
    for (const r of records) s.put(r)
    return
  })

/**
 * Whether a writer that last read or wrote the record saved at `base` may replace `stored`: it is
 * absent, or no other writer saved it since. Without `base` only an absent record fits.
 */
export const fits = (stored: { saved: string } | undefined, base: string | undefined) =>
  !stored || stored.saved === base

/** Puts `record` when the stored one `fits` `base`, read and written in one transaction; false when not. */
export async function putRecordIf(record: UserRecord, base: string | undefined) {
  const stored = await inStore('records', 'readwrite', (s) => {
    const r = s.get(record.id)
    r.addEventListener('success', () => {
      if (fits(r.result, base)) s.put(record)
    })
    return r
  })
  return fits(stored, base)
}

/**
 * Replaces the stored record `id` by what `change` makes of it (the stored value as written,
 * unvalidated, undefined when absent), read and written in one transaction: two tabs changing one
 * record never lose each other's change. `change` returns undefined to leave the record as it is.
 * Resolves with the record written, undefined when `change` left it.
 */
export async function updateRecord(
  id: string,
  change: (stored: unknown) => UserRecord | undefined,
) {
  let written: UserRecord | undefined
  await inStore('records', 'readwrite', (s) => {
    const r = s.get(id)
    r.addEventListener('success', () => {
      written = change(r.result)
      if (written) s.put(written)
    })
    return r
  })
  return written
}

/**
 * Puts `record` unless the store holds a record, valid or not, with its id, read and written in
 * one transaction; false when it was left out.
 */
export async function putRecordIfAbsent(record: UserRecord) {
  const stored = await inStore('records', 'readwrite', (s) => {
    const r = s.get(record.id)
    r.addEventListener('success', () => {
      if (!r.result) s.put(record)
    })
    return r
  })
  return !stored
}

/** The `fit.previous` of a stored powder, unvalidated; undefined for any other record. */
const previousOf = (raw: unknown) => {
  const r = raw as { kind?: unknown; data?: { fit?: { previous?: unknown } } } | null
  const p = r?.kind === 'powder' ? r.data?.fit?.previous : undefined
  return typeof p === 'string' ? p : undefined
}

const idOf = (ref: string) => ref.slice('user:'.length)

/**
 * What a powder naming `named` names once the records of `gone` are deleted: the `previous` of a
 * deleted powder, through the deleted ones, up to a record that stays. Undefined to leave it.
 */
function relinked(named: string, gone: ReadonlyMap<string, unknown>) {
  let to = named
  const seen = new Set<string>()
  for (let at = gone.get(idOf(to)); at && !seen.has(to); at = gone.get(idOf(to))) {
    seen.add(to)
    const next = previousOf(at)
    // a deleted powder without a `previous` of its own leaves the name as it was
    if (!next) return
    to = next
  }
  return to !== named && !gone.has(idOf(to)) ? to : undefined
}

/**
 * Deletes the records `ids`. In the same transaction a powder whose `fit.previous` names a
 * deleted powder takes that powder's own `previous` (through the deleted ones), so a chain of
 * refits stays whole and a load on an older fit still finds the newest.
 */
export const deleteRecords = (ids: string[]) =>
  inStore('records', 'readwrite', (s) => {
    const all = s.getAll()
    all.addEventListener('success', () => {
      const raw = all.result as { id?: unknown; data?: { fit?: object } }[]
      const gone = new Map(
        raw.flatMap((r) => (typeof r.id === 'string' && ids.includes(r.id) ? [[r.id, r]] : [])),
      )
      for (const r of raw) {
        const named = previousOf(r)
        const to = named && typeof r.id === 'string' && !gone.has(r.id) && relinked(named, gone)
        if (to) s.put({ ...r, data: { ...r.data, fit: { ...r.data?.fit, previous: to } } })
      }
      for (const id of ids) s.delete(id)
    })
    return
  })

export const deleteRecord = (id: string) => deleteRecords([id])

/** A user file (a target photo) kept in this browser under `id`; never sent anywhere. */
export const putPhoto = (id: string, file: Blob) =>
  inStore('files', 'readwrite', (s) => s.put(file, id))

/** Keeps in this browser the photos of `records` that the file carries. */
export async function storePhotos(files: EmbeddedFile[], records: UserRecord[]) {
  const wanted = new Set(photoIds(records))
  for (const f of files) if (wanted.has(f.id)) await putPhoto(f.id, embeddedFileBlob(f))
}

export const storedPhoto = (id: string) =>
  inStore('files', 'readonly', (s) => s.get(id)) as Promise<Blob | undefined>

export const deletePhoto = (id: string) => inStore('files', 'readwrite', (s) => s.delete(id))

let persisted: Promise<boolean> | undefined
/**
 * Asks once per page load for persistent storage, so the browser does not evict the
 * records under storage pressure; true where the API is missing.
 */
export const requestPersistentStorage = () =>
  (persisted ??= (navigator.storage?.persist?.() ?? Promise.resolve(true)).catch(() => true))
