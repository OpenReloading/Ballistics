/**
 * The rule-book target faces of the API (`apiFetch`), and the federations,
 * disciplines and target mappings that ring scoring picks them by: a few records, fetched once per
 * page load. Shared by ring scoring and the face search of hole detection. The face designs of
 * this browser come with the faces, read from the store on each call: a design saved in another
 * tab or page shows at once.
 */
import type { TargetFace } from '@openreloading/schema'
import { apiFetch } from './api-fetch.ts'
import type { FederationData } from './face-disciplines.ts'
import { buildFace, faceIdPrefix, userFaceId } from './user-faces.ts'
import { storedRecords } from './user-store.ts'

export type FaceSummary = { id: string; organization: string; name: string }

let listing: Promise<FaceSummary[]> | undefined
const records = new Map<string, Promise<TargetFace>>()

async function json<T>(path: string): Promise<T> {
  const res = await apiFetch(path)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

/** The face designs of the browser's store that build a face; none where the store cannot be read. */
async function designFaces(): Promise<TargetFace[]> {
  const { records } = await storedRecords().catch(() => ({ records: [] }))
  return records.flatMap((r) => {
    if (r.kind !== 'targetFaceDesign') return []
    const built = buildFace(r.data, userFaceId(r.id), r.name)
    return 'face' in built ? [built.face] : []
  })
}

/** The catalogue's faces, else (the API unreachable) the designs alone; fails with neither. */
async function withDesigns<T>(
  catalogue: () => Promise<T[]>,
  designs: (faces: TargetFace[]) => T[],
): Promise<T[]> {
  // both reads start at once
  const [mine, listed] = await Promise.all([
    designFaces().then(designs),
    catalogue().then(
      (list) => ({ list }),
      (error: unknown) => ({ error }),
    ),
  ])
  if ('error' in listed) {
    if (mine.length === 0) throw listed.error
    return mine
  }
  return [...listed.list, ...mine]
}

const catalogueSummaries = () => {
  listing ??= json<{ items: FaceSummary[] }>('target-faces').then(
    (r) => r.items,
    (e) => {
      listing = undefined
      throw e
    },
  )
  return listing
}

export const fetchFaceSummaries = () =>
  withDesigns(catalogueSummaries, (faces) =>
    faces.map(({ id, organization, name }) => ({ id, organization, name })),
  )

/** Whether a face record has `id`; false while the list cannot be fetched. */
export const isFaceId = (id: string) =>
  fetchFaceSummaries().then(
    (faces) => faces.some((f) => f.id === id),
    () => false,
  )

export function fetchFace(id: string) {
  if (id.startsWith(faceIdPrefix))
    return designFaces().then(
      (faces) => faces.find((f) => f.id === id) ?? Promise.reject(new Error('No such face design')),
    )
  let p = records.get(id)
  if (!p) {
    p = json<TargetFace>(`target-faces/${encodeURIComponent(id)}`)
    p.catch(() => records.delete(id))
    records.set(id, p)
  }
  return p
}

/** Fetches every target face record (one request per face, cached for the page load), then the designs. */
export const fetchAllFaces = (): Promise<TargetFace[]> =>
  withDesigns(
    async () => Promise.all((await catalogueSummaries()).map((f) => fetchFace(f.id))),
    (faces) => faces,
  )

let federations: Promise<FederationData> | undefined

/** Fetches federations, disciplines and target mappings once per page load, retried after a failure. */
export function fetchFederationData() {
  const items = <T>(path: string) => json<{ items: T[] }>(path).then((r) => r.items)
  federations ??= Promise.all([
    items<FederationData['federations'][number]>('federations'),
    items<FederationData['disciplines'][number]>('disciplines'),
    items<FederationData['mappings'][number]>('target-mappings'),
  ]).then(
    ([federations, disciplines, mappings]) => ({ federations, disciplines, mappings }),
    (e) => {
      federations = undefined
      throw e
    },
  )
  return federations
}
