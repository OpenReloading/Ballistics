/** Target photos in user data files: the ids records point at, and base64 file entries. */
import type { EmbeddedFile, UserRecord } from '@openreloading/schema'

/** Ids of the photos the target sheets among `records` point at. */
export const photoIds = (records: UserRecord[]) => [
  ...new Set(
    records.flatMap((r) => (r.kind === 'targetSheet' && r.data.photo ? [r.data.photo] : [])),
  ),
]

/** Blobs as file entries, base64 in chunks: one spread over megabytes overflows the stack. */
export function embedFiles(blobs: { id: string; blob: Blob }[]): Promise<EmbeddedFile[]> {
  return Promise.all(
    blobs.map(async ({ id, blob }) => {
      const bytes = new Uint8Array(await blob.arrayBuffer())
      let s = ''
      for (let i = 0; i < bytes.length; i += 0x8000)
        s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      // another type fails the check of the written file (Save parses it first)
      return { id, type: (blob.type || 'image/jpeg') as EmbeddedFile['type'], data: btoa(s) }
    }),
  )
}

/** A file entry back as a Blob of its type; a plain loop, as a mapped `Uint8Array.from` is slow on megabytes. */
export function embeddedFileBlob(f: EmbeddedFile) {
  const s = atob(f.data)
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return new Blob([bytes], { type: f.type })
}

/** Photo ids that target sheets in `before` point at and no record in `after` does. */
export function droppedPhotos(before: UserRecord[], after: UserRecord[]): string[] {
  const kept = new Set(photoIds(after))
  return photoIds(before).filter((p) => !kept.has(p))
}
