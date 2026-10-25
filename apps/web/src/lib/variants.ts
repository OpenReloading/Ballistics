/** User variants of catalogue records: reading the base record and applying the overrides. */
import {
  applyOverrides,
  type Bullet,
  parseRef,
  type SpecValue,
  toSi,
  type UserBullet,
  type UserCartridge,
  type UserRecord,
  userIdRegex,
} from '@open-reloading/schema'
import { fetchRecord } from './api-fetch.ts'
import type { CartridgeDetail } from './api-types.ts'
import {
  fetchManufacturerNames,
  noManufacturerNames,
  refName,
  withUserManufacturers,
} from './manufacturers.ts'

/** The base record of a variant: none given, read, no longer in the catalogue, or not read. */
export type Base<T> =
  | { status: 'none' }
  | { status: 'found'; record: T }
  | { status: 'missing' | 'unreachable'; ref: string }

/**
 * The catalogue record a variant is based on (`kind` as `bullets`); a renamed id is followed by the
 * API. `missing` when the catalogue no longer has it, `unreachable` when the API did not answer, so
 * a record is never called gone for a network error.
 */
export async function readBase<T>(
  kind: 'bullets' | 'cartridges',
  basedOn: string | undefined,
  signal?: AbortSignal,
): Promise<Base<T>> {
  if (basedOn === undefined) return { status: 'none' }
  const id = parseRef(basedOn)?.id ?? basedOn
  try {
    const record = await fetchRecord<T>(kind, id, signal)
    return record ? { status: 'found', record } : { status: 'missing', ref: basedOn }
  } catch {
    return { status: 'unreachable', ref: basedOn }
  }
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
  problem?: string
}

/** A user cartridge with its base and the table and values the overrides give. */
export interface ResolvedCartridge {
  base: Base<CartridgeDetail>
  /** The base with the overrides applied; the overrides alone without a base or while it is missing. */
  record: { table?: string; values: SpecValue[] }
  problem?: string
}

/** The user bullet `data` with its base read from the catalogue. */
export async function resolveBullet(
  data: UserBullet,
  signal?: AbortSignal,
): Promise<ResolvedBullet> {
  const base = await readBase<Bullet>('bullets', data.basedOn, signal)
  const problem = baseProblem(base)
  const from = base.status === 'found' ? base.record : {}
  return { base, record: applyOverrides<Partial<Bullet>>(from, data.overrides), problem }
}

/** The user cartridge `data` with its base read from the catalogue. */
export async function resolveCartridge(
  data: UserCartridge,
  signal?: AbortSignal,
): Promise<ResolvedCartridge> {
  const base = await readBase<CartridgeDetail>('cartridges', data.basedOn, signal)
  const from =
    base.status === 'found'
      ? { table: base.record.table, values: base.record.values }
      : { values: [] }
  return {
    base,
    record: applyOverrides<{ table?: string; values: SpecValue[] }>(from, data.overrides),
    problem: baseProblem(base),
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
  si: { mass?: number; diameter?: number; length?: number }
}

/** A user cartridge of the browser whose base resolves. */
export interface UserCartridgeView {
  id: string
  name: string
  data: UserCartridge
  resolved: ResolvedCartridge
}

/**
 * The bullet records of `records`, each resolved against the catalogue. A record whose base is not
 * there is left out: it has no values to list or seat, and opens read only in the designer.
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
      if (resolved.problem) return
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

/** The cartridge records of `records` that resolve, as {@link userBullets} does for bullets. */
export async function userCartridges(records: readonly UserRecord[]): Promise<UserCartridgeView[]> {
  const views = await Promise.all(
    records.map(async (r): Promise<UserCartridgeView | undefined> => {
      if (r.kind !== 'cartridge') return
      const resolved = await resolveCartridge(r.data)
      return resolved.problem ? undefined : { id: r.id, name: r.name, data: r.data, resolved }
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
