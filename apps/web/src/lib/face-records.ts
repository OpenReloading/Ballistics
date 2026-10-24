/**
 * The rule-book target faces of the API (`apiFetch`), and the federations,
 * disciplines and target mappings that ring scoring picks them by: a few records, fetched once per
 * page load. Shared by ring scoring and the face search of hole detection.
 */
import type { TargetFace } from '@open-reloading/schema'
import { apiFetch } from './api-fetch.ts'
import type { FederationData } from './face-disciplines.ts'

export type FaceSummary = { id: string; organization: string; name: string }

let listing: Promise<FaceSummary[]> | undefined
const records = new Map<string, Promise<TargetFace>>()

async function json<T>(path: string): Promise<T> {
  const res = await apiFetch(path)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

export function fetchFaceSummaries() {
  listing ??= json<{ items: FaceSummary[] }>('target-faces').then(
    (r) => r.items,
    (e) => {
      listing = undefined
      throw e
    },
  )
  return listing
}

/** Whether a face record has `id`; false while the list cannot be fetched. */
export const isFaceId = (id: string) =>
  fetchFaceSummaries().then(
    (faces) => faces.some((f) => f.id === id),
    () => false,
  )

export function fetchFace(id: string) {
  let p = records.get(id)
  if (!p) {
    p = json<TargetFace>(`target-faces/${encodeURIComponent(id)}`)
    p.catch(() => records.delete(id))
    records.set(id, p)
  }
  return p
}

/** Fetches every target face record (one request per face, cached for the page load). */
export async function fetchAllFaces(): Promise<TargetFace[]> {
  return Promise.all((await fetchFaceSummaries()).map((f) => fetchFace(f.id)))
}

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
