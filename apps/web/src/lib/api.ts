import type {
  Bullet,
  CatalogueCase,
  EventType,
  Powder,
  Primer,
  TargetFace,
} from '@open-reloading/schema'
import { cacheLife } from 'next/cache'
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
import type { DisciplineSummary, MappingSummary } from './face-disciplines.ts'
import { type ManufacturerNames, manufacturerNames } from './manufacturers.ts'
import { exportIds } from './prerender-sample.ts'

type Fetched<T> = { status: 'ok'; data: T } | { status: 'notFound' }

/**
 * GET `path` from API_URL, cached for days. 404 and 400 (an id the API rejects) give `notFound`;
 * any other failure throws, which fails the build.
 */
async function apiGet<T>(path: string): Promise<Fetched<T>> {
  'use cache'
  const apiUrl = process.env.API_URL ?? 'http://localhost:3000'
  const res = await fetch(`${apiUrl}${API_PREFIX}${path}`, {
    signal: AbortSignal.timeout(10_000),
  })
  cacheLife('days')
  if (res.status === 404 || res.status === 400) return { status: 'notFound' }
  if (!res.ok) throw new Error(`API answered ${res.status} for ${path}`)
  return { status: 'ok', data: (await res.json()) as T }
}

/** Every item of a list route, in pages of 200 (the API cap) until `total`, at most 50 pages. */
async function listAll<T>(path: string): Promise<Fetched<T[]>> {
  const items: T[] = []
  for (let page = 0; page < 50; page++) {
    const r = await apiGet<ListOf<T>>(`${path}?limit=200&offset=${page * 200}`)
    if (r.status !== 'ok') return r
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

/** Every manufacturer, none when the API has no such list. */
export async function listManufacturers(): Promise<ManufacturerSummary[]> {
  const r = await apiGet<ListOf<ManufacturerSummary>>('/manufacturers')
  return r.status === 'ok' ? r.data.items : []
}

/** Manufacturer names by id. */
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
export const getDiscipline = getOne<DisciplineRecord>('/disciplines')
export const getFederation = getOne<FederationRecord>('/federations')
export const getEventType = getOne<EventType>('/event-types')

/** The items of a list route that takes no paging (target faces, federations, disciplines, target mappings). */
async function listItems<T>(path: string): Promise<Fetched<T[]>> {
  const r = await apiGet<ListOf<T>>(path)
  return r.status === 'ok' ? { status: 'ok', data: r.data.items } : r
}

export const listTargetMappings = (face?: string) =>
  listItems<MappingSummary>(
    face ? `/target-mappings?face=${encodeURIComponent(face)}` : '/target-mappings',
  )
export const listAllTargetFaces = () => listItems<{ id: string; name: string }>('/target-faces')
export const listDisciplines = () => listItems<DisciplineSummary>('/disciplines')
export const listFederations = () => listItems<FederationListItem>('/federations')
export const listCaliberClasses = () => listItems<CaliberClassSummary>('/caliber-classes')
export const listEventTypes = () => listItems<{ id: string }>('/event-types')

/**
 * `generateStaticParams` of a detail route: every id of the list, or for `PRERENDER=sample` the
 * sample of `prerender-sample.ts` (`exportIds`). A missing list fails the build.
 */
export async function staticIds(list: () => Promise<Fetched<{ id: string }[]>>, what: string) {
  const r = await list()
  if (r.status !== 'ok') throw new Error(`no ${what} list at build`)
  return exportIds(
    what,
    r.data.map((c) => c.id),
  ).map((id) => ({ id }))
}
