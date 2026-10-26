/**
 * Manufacturer names for the powders and bullets that name their manufacturer by id: from
 * `GET /manufacturers` through `apiFetch`, one request per page load, or on the server
 * from `getManufacturerNames` (`api.ts`).
 */

import { checkUserRefs, fold, type UserRecord, userIdRegex } from '@open-reloading/schema'
import { apiFetch } from './api-fetch.ts'
import type { ManufacturerSummary } from './api-types.ts'
import type { InvalidRecord } from './user-data.ts'

/** Manufacturer names by id. */
export type ManufacturerNames = ReadonlyMap<string, string>

export const noManufacturerNames: ManufacturerNames = new Map()

export const manufacturerNames = (items: readonly ManufacturerSummary[]): ManufacturerNames =>
  new Map(items.map((m) => [m.id, m.name]))

/**
 * The name of a manufacturer reference (`catalogue:<id>` or `user:<id>`) in `names`, which holds
 * catalogue ids and `user:<id>` references (`withUserManufacturers`); empty for none or an unknown one.
 */
export const refName = (names: ManufacturerNames, ref: string | undefined) =>
  (ref?.startsWith('catalogue:')
    ? names.get(ref.slice('catalogue:'.length))
    : ref && names.get(ref)) || ''

/** The user manufacturers of `records` as `user:<id>` references with their names, added to `names`. */
export const withUserManufacturers = (
  names: ManufacturerNames,
  records: readonly UserRecord[],
): ManufacturerNames =>
  new Map([
    ...names,
    ...records.flatMap((r): [string, string][] =>
      r.kind === 'manufacturer' && userIdRegex.test(r.id) ? [[`user:${r.id}`, r.name]] : [],
    ),
  ])

/** A manufacturer to pick or to match a typed name against: its reference, name and other names. */
export interface KnownManufacturer {
  ref: string
  name: string
  aliases: string[]
}

/** The catalogue manufacturers, then the user manufacturers of `records`. */
export const knownManufacturers = (
  catalogue: readonly ManufacturerSummary[],
  records: readonly UserRecord[],
): KnownManufacturer[] => [
  ...catalogue.map((m) => ({ ref: `catalogue:${m.id}`, name: m.name, aliases: m.aliases ?? [] })),
  ...records.flatMap((r): KnownManufacturer[] =>
    r.kind === 'manufacturer' && userIdRegex.test(r.id)
      ? [{ ref: `user:${r.id}`, name: r.name, aliases: [] }]
      : [],
  ),
]

const sameName = (a: string, b: string) =>
  fold(a).replace(/[\s-]+/g, '') === fold(b).replace(/[\s-]+/g, '')

/**
 * The manufacturer a typed name names: one whose name or other name is the same text, ignoring
 * case, accents, spaces and hyphens. The first in `known` wins, so a catalogue manufacturer is
 * found before a user one of the same name.
 */
export const findManufacturer = (known: readonly KnownManufacturer[], typed: string) =>
  typed.trim() === ''
    ? undefined
    : known.find((m) => [m.name, ...m.aliases].some((n) => sameName(n, typed)))

/** The user manufacturer record a new typed name creates, `id` a new UUID. */
export const newManufacturerRecord = (id: string, typed: string, now: Date): UserRecord => ({
  kind: 'manufacturer',
  id,
  name: typed.trim().slice(0, 200),
  saved: now.toISOString(),
  data: { origin: 'user' },
})

/**
 * The reference a typed name stands for: the manufacturer it names, else that of a new user
 * manufacturer, whose record is `created` for the caller to store (and to add to `known` so the
 * next typed name finds it). Undefined for an empty text, and for a name nothing matches while the
 * catalogue is not known (`catalogueKnown` false): the catalogue may hold it, and a user
 * manufacturer made now would stay a duplicate of it.
 */
export function referTo(
  known: readonly KnownManufacturer[],
  typed: string,
  newUuid: () => string,
  now: Date,
  catalogueKnown = true,
): { ref: string; created?: UserRecord | undefined } | undefined {
  if (typed.trim() === '') return undefined
  const found = findManufacturer(known, typed)
  if (found) return { ref: found.ref }
  if (!catalogueKnown) return undefined
  const created = newManufacturerRecord(newUuid(), typed, now)
  return { ref: `user:${created.id}`, created }
}

/** A user manufacturer and the number of places that name it. */
export interface ManufacturerUse {
  record: UserRecord
  uses: number
}

/** The `user:<id>` references of the records open in a page; Settings counts each as in use. */
export const shownManufacturerRefs = new Map<object, string>()

/** Fired on `window` after Settings deleted or restored a user manufacturer, for the fields' lists to read the store again. */
export const manufacturersChanged = 'user-manufacturers-changed'

/**
 * The user manufacturers of `records` by name, each with the number of places that name it: a
 * bullet's or firearm's `manufacturer`, a capacity's `caseManufacturer`, an invalid record's text
 * (read as it is stored, so a record the format rejects keeps its maker) and the record open on a page
 * (`shown`, from `shownManufacturerRefs`). One that nothing names can be deleted.
 */
export function manufacturerUses(
  records: readonly UserRecord[],
  invalid: readonly InvalidRecord[],
  shown: Iterable<string> = shownManufacturerRefs.values(),
): ManufacturerUse[] {
  // with no manufacturer record in the set, every reference to one is reported as dangling
  const named = new Map<string, number>()
  const count = (ref: string) => named.set(ref, (named.get(ref) ?? 0) + 1)
  for (const d of checkUserRefs(records.filter((r) => r.kind !== 'manufacturer')))
    if (d.field === 'manufacturer' || d.field === 'caseManufacturer') count(d.target)
  for (const ref of shown) count(ref)
  const raw = invalid.map((i) => JSON.stringify(i.raw))
  return records
    .filter((r) => r.kind === 'manufacturer' && userIdRegex.test(r.id))
    .map((record) => {
      const ref = `user:${record.id}`
      return {
        record,
        uses: (named.get(ref) ?? 0) + raw.filter((text) => text.includes(ref)).length,
      }
    })
    .sort((a, b) => a.record.name.localeCompare(b.record.name))
}

/**
 * The label of a powder or bullet: "<manufacturer name> <product name>". A catalogue record names
 * its manufacturer by id, looked up in `names` (left out while the name is not known); a list row
 * or a design carries `manufacturerName`.
 */
export function productLabel(
  r: { name: string; manufacturer?: string | undefined; manufacturerName?: string | undefined },
  names: ManufacturerNames = noManufacturerNames,
) {
  const manufacturer = r.manufacturerName ?? (r.manufacturer && names.get(r.manufacturer))
  return [manufacturer, r.name].filter(Boolean).join(' ')
}

/** Manufacturer aliases by id, for the list searches; only manufacturers that have aliases. */
type ManufacturerAliases = ReadonlyMap<string, string[]>

export const manufacturerAliases = (items: readonly ManufacturerSummary[]): ManufacturerAliases =>
  new Map(items.flatMap((m) => (m.aliases?.length ? [[m.id, m.aliases]] : [])))

/**
 * `rows` with the name of each row's manufacturer (empty while the name is not known) and its
 * aliases where `aliases` has them.
 */
export const withManufacturerName = <T extends { manufacturer: string }>(
  rows: readonly T[],
  names: ManufacturerNames,
  aliases: ManufacturerAliases = new Map(),
): (T & { manufacturerName: string; manufacturerAliases?: string[] | undefined })[] =>
  rows.map((r) => {
    const manufacturerAliases = aliases.get(r.manufacturer)
    return {
      ...r,
      manufacturerName: names.get(r.manufacturer) ?? '',
      ...(manufacturerAliases && { manufacturerAliases }),
    }
  })

/**
 * The manufacturer options over `rows`: each catalogue manufacturer id with its name, by name.
 */
export const manufacturerOptions = (
  rows: readonly { manufacturer?: string | undefined; manufacturerName: string }[],
) =>
  [
    ...new Map(
      rows.flatMap((r) =>
        r.manufacturer ? [[r.manufacturer, r.manufacturerName || r.manufacturer]] : [],
      ),
    ),
  ]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label))

let listing: Promise<ManufacturerSummary[]> | undefined

/** Every catalogue manufacturer through `apiFetch`, once per page load; retried after a failure. */
export function fetchManufacturers() {
  listing ??= apiFetch('manufacturers')
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return ((await res.json()) as { items: ManufacturerSummary[] }).items
    })
    .catch((e) => {
      listing = undefined
      throw e
    })
  return listing
}

/** Every manufacturer name through `fetchManufacturers`. */
export const fetchManufacturerNames = () => fetchManufacturers().then(manufacturerNames)
