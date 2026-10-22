/** The workbench loads, tabs and the saved-loads list. */
import type { UserRecord } from '@openreloading/schema'
import { matchesQuery } from './lists.ts'
import { copyName } from './user-file-names.ts'
import { putRecords, storedRecord } from './user-store.ts'

export type LoadRecord = Extract<UserRecord, { kind: 'workbenchState' }>

/** Tab titles; equal names are numbered from the second on. */
export function tabTitles(names: string[]): string[] {
  const seen = new Map<string, number>()
  return names.map((n) => {
    const count = (seen.get(n) ?? 0) + 1
    seen.set(n, count)
    return count === 1 ? n : `${n} ${count}`
  })
}

/** The tab to show when `key` closes: the next one, else the previous; undefined for the only tab. */
export function tabAfterClose(keys: string[], key: string): string | undefined {
  const i = keys.indexOf(key)
  return keys[i + 1] ?? keys[i - 1]
}

const noCartridge = 'No cartridge'

/** The name of a load nobody named: cartridge, bullet, and powder with the charge; "New load" when none is set. */
export function generatedName(p: {
  cartridge?: string
  bullet?: string
  powder?: string
  charge?: string
}): string {
  const parts = [p.cartridge, p.bullet, [p.powder, p.charge].filter(Boolean).join(' ')]
  return parts.filter(Boolean).join(', ') || 'New load'
}

/**
 * The load's name on the switcher: the one typed, else "cartridge · powder" (the powder's name
 * without its maker), else the generated name.
 */
export function shortName(p: {
  custom?: string
  cartridge?: string
  powder?: string
  generated: string
}): string {
  if (p.custom?.trim()) return p.custom
  return [p.cartridge, p.powder].filter(Boolean).join(' · ') || p.generated
}

/** The load's name: the one typed, else the generated one (an empty name falls back to it). */
export const loadName = (custom: string | undefined, generated: string) =>
  custom?.trim() ? custom : generated

/** Renames the stored copy of load `id`, which another tab may have saved since the list was read. */
export async function renameStored(id: string, name: string) {
  const stored = await storedRecord(id)
  if (!stored) throw new Error('the load is no longer in this browser')
  await putRecords([{ ...stored, name }])
}

/** Stores a copy of the stored load `r` (else `r`) under `id`, named as a copy. */
export async function duplicateStored(r: LoadRecord, id: string) {
  const from = (await storedRecord(r.id)) ?? r
  await putRecords([{ ...from, id, name: copyName(from.name), saved: new Date().toISOString() }])
}

/**
 * The saved-loads list: records whose name has every word of `query`, grouped by cartridge (groups
 * by title, the group without a cartridge last), newest first. A group is titled by the cartridge's
 * name from `cartridgeNames` (by id), by the id while the lookup lacks it.
 */
export function loadGroups(
  records: LoadRecord[],
  query: string,
  cartridgeNames: Record<string, string> = {},
) {
  const groups = new Map<string, { key: string; title: string; records: LoadRecord[] }>()
  for (const r of records) {
    if (!matchesQuery([r.name], query)) continue
    const key = r.data.cartridge ?? ''
    const group = groups.get(key) ?? {
      key,
      title: key ? (cartridgeNames[key] ?? key) : noCartridge,
      records: [],
    }
    group.records.push(r)
    groups.set(key, group)
  }
  return [...groups.values()]
    .map((g) => ({ ...g, records: g.records.sort((a, b) => (a.saved < b.saved ? 1 : -1)) }))
    .sort((a, b) =>
      !a.key || !b.key
        ? Number(!a.key) - Number(!b.key)
        : a.title.localeCompare(b.title, 'en', { numeric: true }),
    )
}

/** The saved loads open in the tabs and the one shown, stored in `localStorage` (`openLoads`). */
type OpenLoads = { ids: string[]; active?: string }

export const openLoadsKey = 'openLoads'

export const openLoadsText = (set: OpenLoads) => JSON.stringify(set)

/** A stored set; anything damaged reads as empty. */
export function parseOpenLoads(text: string | null): OpenLoads {
  try {
    const json = JSON.parse(text ?? 'null') as { ids?: unknown; active?: unknown } | null
    const ids = Array.isArray(json?.ids)
      ? [...new Set(json.ids.filter((x): x is string => typeof x === 'string'))]
      : []
    return typeof json?.active === 'string' ? { ids, active: json.active } : { ids }
  } catch {
    return { ids: [] }
  }
}
