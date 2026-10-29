/** User variants of catalogue records: reading the base record and applying the overrides. */
import {
  applyOverrides,
  type Bullet,
  bullet,
  cartridge,
  parseRef,
  type SpecValue,
  toSi,
  type UserBullet,
  type UserCartridge,
  type UserRecord,
  userIdRegex,
} from '@open-reloading/schema'
import type { z } from 'zod'
import { fetchRecord } from './api-fetch.ts'
import type { CartridgeDetail } from './api-types.ts'
import { storageName } from './edition.ts'
import {
  fetchManufacturerNames,
  noManufacturerNames,
  refName,
  withUserManufacturers,
} from './manufacturers.ts'
import { nth } from './nth.ts'

/** The base record of a variant: none given, read, no longer in the catalogue, or not read. */
export type Base<T> =
  | { status: 'none' }
  | { status: 'found'; record: T }
  | { status: 'missing' | 'unreachable'; ref: string }

// the API answers a cartridge without aliases with an empty list, which the record schema rejects
const cartridgeBase = cartridge.omit({ aliases: true })

const baseKey = (kind: string, id: string) => storageName(`openreloading-base:${kind}/${id}`)

/**
 * The base last read from the API, kept in this browser; undefined without one or without storage.
 * A kept value that `schema` rejects (an older app's shape, a damaged entry) is forgotten.
 */
function recalled<T>(key: string, schema: z.ZodType): T | undefined {
  try {
    const text = localStorage.getItem(key)
    if (text === null) return
    const kept: unknown = JSON.parse(text)
    // the value itself, not the parsed data, which would strip the fields the API adds
    if (schema.safeParse(kept).success) return kept as T
  } catch {}
  remember(key, undefined)
}

/** Keeps `record` (or forgets the key for undefined) as the base last read. Quota or blocked storage: nothing is kept. */
function remember(key: string, record: object | undefined) {
  try {
    if (record) localStorage.setItem(key, JSON.stringify(record))
    else localStorage.removeItem(key)
  } catch {}
}

/**
 * The catalogue record a variant is based on (`kind` as `bullets`); a renamed id is followed by the
 * API. `missing` when the catalogue no longer has it, `unreachable` when the API did not answer and
 * this browser holds no earlier read, so a record is never called gone for a network error. While
 * the API does not answer, the base last read stands in for it.
 * shortcut: a kept base is never removed for a deleted design, only replaced or dropped when its
 * record is gone from the catalogue; add a sweep if the entries pile up.
 */
async function readBase<T>(
  kind: 'bullets' | 'cartridges',
  schema: z.ZodType,
  basedOn: string | undefined,
  signal?: AbortSignal,
): Promise<Base<T>> {
  if (basedOn === undefined) return { status: 'none' }
  const id = parseRef(basedOn)?.id ?? basedOn
  const key = baseKey(kind, id)
  try {
    const record = await fetchRecord<T>(kind, id, signal)
    remember(key, record as object | undefined)
    return record ? { status: 'found', record } : { status: 'missing', ref: basedOn }
  } catch {
    const kept = recalled<T>(key, schema)
    return kept ? { status: 'found', record: kept } : { status: 'unreachable', ref: basedOn }
  }
}

/** The `revision` the API answered a base record with; undefined for a record without one. */
export const revisionOf = (record: object): string | undefined => {
  const { revision } = record as { revision?: unknown }
  return typeof revision === 'string' ? revision : undefined
}

/**
 * Whether a base changed since the variant was saved: the revision kept at save (`saved`) differs
 * from the one the base has now. False without either revision.
 */
export function baseChanged(saved: string | undefined, base: Base<object>): boolean {
  if (saved === undefined || base.status !== 'found') return false
  const now = revisionOf(base.record)
  return now !== undefined && now !== saved
}

/** Why a variant opens read only: its base is not there. Undefined for a base found or none. */
export function baseProblem(base: Base<unknown>): string | undefined {
  if (base.status === 'missing') return `The base record ${base.ref} is no longer in the catalogue.`
  if (base.status === 'unreachable') return `The base record ${base.ref} could not be read.`
}

/** A user bullet with its base and the record the overrides give. */
export interface ResolvedBullet {
  base: Base<Bullet>
  /** The base with the overrides applied; the overrides alone without a base or while it is missing. */
  record: Partial<Bullet>
  /** Why the record is read only. */
  problem?: string | undefined
  /** The base changed since the bullet was saved. */
  changed?: boolean
}

/** A user cartridge with its base and the table and values the overrides give. */
export interface ResolvedCartridge {
  base: Base<CartridgeDetail>
  /** The base with the overrides applied; the overrides alone without a base or while it is missing. */
  record: { table?: string | undefined; values: SpecValue[] }
  problem?: string | undefined
  /** The base changed since the cartridge was saved. */
  changed?: boolean
}

/** The user bullet `data` with its base read from the catalogue. */
export async function resolveBullet(
  data: UserBullet,
  signal?: AbortSignal,
): Promise<ResolvedBullet> {
  const base = await readBase<Bullet>('bullets', bullet, data.basedOn, signal)
  const problem = baseProblem(base)
  const from = base.status === 'found' ? base.record : {}
  return {
    base,
    record: applyOverrides<Partial<Bullet>>(from, data.overrides),
    problem,
    changed: baseChanged(data.basedOnRevision, base),
  }
}

/** The user cartridge `data` with its base read from the catalogue. */
export async function resolveCartridge(
  data: UserCartridge,
  signal?: AbortSignal,
): Promise<ResolvedCartridge> {
  const base = await readBase<CartridgeDetail>('cartridges', cartridgeBase, data.basedOn, signal)
  const from =
    base.status === 'found'
      ? { table: base.record.table, values: base.record.values }
      : { values: [] }
  return {
    base,
    record: applyOverrides<{ table?: string | undefined; values: SpecValue[] }>(
      from,
      data.overrides,
    ),
    problem: baseProblem(base),
    changed: baseChanged(data.basedOnRevision, base),
  }
}

/** A user bullet of the browser whose base resolves: what a picker or a list shows. */
export interface UserBulletView {
  /** The id of the user record. */
  id: string
  /** The record's name. */
  name: string
  data: UserBullet
  resolved: ResolvedBullet
  /** The name of the bullet's manufacturer; empty while it is not known. */
  manufacturerName: string
  /** Mass, diameter and length of the resolved record in SI; absent where it gives none. */
  si: { mass?: number | undefined; diameter?: number | undefined; length?: number | undefined }
}

/** A user cartridge of the browser whose base resolves. */
export interface UserCartridgeView {
  id: string
  name: string
  data: UserCartridge
  resolved: ResolvedCartridge
}

/**
 * The bullet records of `records`, each resolved against the catalogue. A record whose base the
 * catalogue no longer has is left out: it has no values to list or seat, and opens read only in the
 * designer. A base the API did not answer keeps the record in, with the values of the base last
 * read, else those its overrides give.
 */
export async function userBullets(records: readonly UserRecord[]): Promise<UserBulletView[]> {
  const names = withUserManufacturers(
    await fetchManufacturerNames().catch(() => noManufacturerNames),
    records,
  )
  const views = await Promise.all(
    records.map(async (r): Promise<UserBulletView | undefined> => {
      if (r.kind !== 'bullet') return
      const resolved = await resolveBullet(r.data)
      if (resolved.base.status === 'missing') return
      const { mass, diameter, length } = resolved.record
      const si = (q: { value: number } | undefined, kind: 'mass' | 'length') =>
        q && toSi(kind, q.value)
      return {
        id: r.id,
        name: r.name,
        data: r.data,
        resolved,
        manufacturerName: refName(names, r.data.manufacturer),
        si: {
          mass: si(mass, 'mass'),
          diameter: si(diameter, 'length'),
          length: si(length, 'length'),
        },
      }
    }),
  )
  return views.filter((v): v is UserBulletView => v !== undefined)
}

/** The cartridge records of `records` whose base the catalogue has or could not be asked, as {@link userBullets} does for bullets. */
export async function userCartridges(records: readonly UserRecord[]): Promise<UserCartridgeView[]> {
  const views = await Promise.all(
    records.map(async (r): Promise<UserCartridgeView | undefined> => {
      if (r.kind !== 'cartridge') return
      const resolved = await resolveCartridge(r.data)
      return resolved.base.status === 'missing'
        ? undefined
        : { id: r.id, name: r.name, data: r.data, resolved }
    }),
  )
  return views.filter((v): v is UserCartridgeView => v !== undefined)
}

/** Sets `value` at the dotted `path` of `target`, making the objects on the way. */
export function setPath(target: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split('.')
  const last = keys.pop() as string
  let at = target
  for (const k of keys) {
    at[k] ??= {}
    at = at[k] as Record<string, unknown>
  }
  at[last] = value
}

/** Removes the value at the dotted `path` of `target`, and the objects it leaves empty on the way. */
export function dropPath(target: Record<string, unknown>, path: string) {
  const keys = path.split('.')
  const last = keys.pop() as string
  const chain = [target]
  for (const k of keys) {
    const next = chain.at(-1)?.[k]
    if (typeof next !== 'object' || next === null || Array.isArray(next)) return
    chain.push(next as Record<string, unknown>)
  }
  delete nth(chain, keys.length)[last]
  for (let i = keys.length; i > 0 && Object.keys(nth(chain, i)).length === 0; i--)
    delete nth(chain, i - 1)[nth(keys, i - 1)]
}

/** The reference a load file keeps for a catalogue record: a plain id is a catalogue record. */
export const catalogueRef = (idOrRef: string) =>
  parseRef(idOrRef) ? idOrRef : `catalogue:${idOrRef}`

/** The reference to a user record of the browser; undefined for an id that is no UUID, which a reference cannot name. */
export const userRef = (id: string) => (userIdRegex.test(id) ? `user:${id}` : undefined)

/** The id of a catalogue record named by a plain id or a `catalogue:` reference; undefined for a user reference. */
export function catalogueIdOf(idOrRef: string) {
  const ref = parseRef(idOrRef)
  return ref ? (ref.scope === 'catalogue' ? ref.id : undefined) : idOrRef
}
