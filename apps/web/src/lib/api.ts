import type {
  Bullet,
  CatalogueCase,
  Powder,
  Primer,
  TargetFace,
  TargetMapping,
} from '@open-reloading/schema'
import { cacheLife } from 'next/cache'
import { PHASE_PRODUCTION_BUILD } from 'next/constants'
import type {
  BulletSummary,
  CartridgeDetail,
  CartridgeSummary,
  CaseSummary,
  ListOf,
  ManufacturerSummary,
  PowderSummary,
  PrimerSummary,
} from './api-types.ts'
import { API_PREFIX } from './api-version.ts'
import type {
  CaliberClassSummary,
  DisciplineRecord,
  FederationListItem,
  FederationRecord,
} from './disciplines.ts'
import { pagesBasePath } from './edition.ts'
import type { DisciplineSummary, MappingSummary } from './face-disciplines.ts'
import { type ManufacturerNames, manufacturerNames } from './manufacturers.ts'
import { pickIds } from './prerender-sample.ts'

type Fetched<T> = { status: 'ok'; data: T } | { status: 'notFound' } | { status: 'unavailable' }

/**
 * GET `path` from API_URL, cached for days. 404 and 400 (an id the API rejects) give `notFound`.
 * An unreachable API gives `unavailable` during `next build` only, with `revalidate: 0` so that part
 * renders at request time (a short `revalidate` lets the in-memory cache serve the entry to a later
 * route's warming phase and drop it before that route's final prerender: a cache-miss warning); at
 * run time it throws, so a failed revalidation keeps the cached page.
 */
async function apiGet<T>(path: string): Promise<Fetched<T>> {
  'use cache'
  const apiUrl = process.env.API_URL ?? 'http://localhost:3000'
  try {
    const res = await fetch(`${apiUrl}${API_PREFIX}${path}`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (res.status === 404 || res.status === 400) {
      cacheLife('days')
      return { status: 'notFound' }
    }
    if (!res.ok) throw new Error(`API answered ${res.status} for ${path}`)
    const data = (await res.json()) as T
    cacheLife('days')
    return { status: 'ok', data }
  } catch (e) {
    if (process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) throw e
    cacheLife({ revalidate: 0 })
    return { status: 'unavailable' }
  }
}

/** Every item of a list route, in pages of 200 (the API cap) until `total`, at most 50 pages. */
async function listAll<T>(path: string): Promise<Fetched<T[]>> {
  const items: T[] = []
  for (let page = 0; page < 50; page++) {
    const r = await apiGet<ListOf<T>>(`${path}?limit=200&offset=${page * 200}`)
    if (r.status !== 'ok') return { status: 'unavailable' }
    items.push(...r.data.items)
    if (items.length >= r.data.total || r.data.items.length === 0) break
  }
  return { status: 'ok', data: items }
}

export const listAllCartridges = () => listAll<CartridgeSummary>('/cartridges')
export const listAllBullets = () => listAll<BulletSummary>('/bullets')
export const listAllPowders = () => listAll<PowderSummary>('/powders')
export const listAllPrimers = () => listAll<PrimerSummary>('/primers')
export const listAllCases = () => listAll<CaseSummary>('/cases')

/** Every manufacturer; none while the API is unavailable at build. */
export async function listManufacturers(): Promise<ManufacturerSummary[]> {
  const r = await apiGet<ListOf<ManufacturerSummary>>('/manufacturers')
  return r.status === 'ok' ? r.data.items : []
}

/** Manufacturer names by id; none while the API is unavailable at build. */
export const getManufacturerNames = async (): Promise<ManufacturerNames> =>
  manufacturerNames(await listManufacturers())

const getOne =
  <T>(path: string) =>
  (id: string): Promise<Fetched<T>> =>
    apiGet<T>(`${path}/${encodeURIComponent(id)}`)

export const getCartridge = getOne<CartridgeDetail>('/cartridges')
export const getBullet = getOne<Bullet>('/bullets')
export const getPowder = getOne<Powder>('/powders')
export const getPrimer = getOne<Primer>('/primers')
export const getCase = getOne<CatalogueCase>('/cases')
export const getTargetFace = getOne<TargetFace>('/target-faces')
export const getTargetMapping = getOne<TargetMapping>('/target-mappings')
export const getDiscipline = getOne<DisciplineRecord>('/disciplines')
export const getFederation = getOne<FederationRecord>('/federations')

export const listAllTargetFaces = () => listAll<{ id: string }>('/target-faces')

/** The items of a list route that takes no paging (federations, disciplines, target mappings). */
async function listItems<T>(path: string): Promise<Fetched<T[]>> {
  const r = await apiGet<ListOf<T>>(path)
  return r.status === 'ok' ? { status: 'ok', data: r.data.items } : { status: 'unavailable' }
}

export const listTargetMappings = (face?: string) =>
  listItems<MappingSummary>(
    face ? `/target-mappings?face=${encodeURIComponent(face)}` : '/target-mappings',
  )
export const listDisciplines = () => listItems<DisciplineSummary>('/disciplines')
export const listFederations = () => listItems<FederationListItem>('/federations')
export const listCaliberClasses = () => listItems<CaliberClassSummary>('/caliber-classes')

/** Param returned when the API is unreachable at build: Cache Components reject an empty list. */
export const buildPlaceholderId = '_build'

/**
 * `generateStaticParams` of a detail route: every id of the list (the sample of `PRERENDER=sample`,
 * `prerender-sample.ts`), or the placeholder without the API. The Pages edition has no page it
 * does not prerender: every id, and a build without the API fails.
 */
export async function staticIds(list: () => Promise<Fetched<{ id: string }[]>>, what: string) {
  const r = await list()
  if (pagesBasePath !== undefined) {
    if (r.status !== 'ok') throw new Error(`API unavailable at build: no ${what} pages`)
    return r.data.map(({ id }) => ({ id }))
  }
  if (r.status !== 'ok') {
    console.warn(`API unavailable at build: ${what} pages render on first request`)
    return [{ id: buildPlaceholderId }]
  }
  return pickIds(
    what,
    r.data.map((c) => c.id),
  ).map((id) => ({ id }))
}
