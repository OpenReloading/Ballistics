/**
 * The saved loads the workbench opens in its tabs, and the newest saved loads of the browser store
 * read without the schema, for the home page.
 */
import { storageName } from './edition.ts'
import { inStore } from './user-db.ts'

/** The saved loads open in the tabs and the one shown, stored in `localStorage` (`openLoads`). */
type OpenLoads = { ids: string[]; active?: string | undefined }

export const openLoadsKey = storageName('openLoads')

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

/** `set` with load `id` added and shown, the other open loads kept. */
export const withOpened = (set: OpenLoads, id: string): OpenLoads => ({
  ids: [...new Set([...set.ids, id])],
  active: id,
})

/** Adds load `id` to the workbench's open loads as the shown one; the workbench opens it on mounting. */
export function openOnWorkbench(id: string) {
  try {
    const set = parseOpenLoads(localStorage.getItem(openLoadsKey))
    localStorage.setItem(openLoadsKey, openLoadsText(withOpened(set, id)))
  } catch {}
}

/** A stored load's id, name and saved time; the workbench checks the record when it opens it. */
export type RecentLoad = { id: string; name: string; saved: string }

/** The `count` loads of `values` (stored records as written) with the newest `saved` time. */
export function newestLoads(values: unknown[], count: number): RecentLoad[] {
  return values
    .flatMap((v) => {
      const r = v as { kind?: unknown; id?: unknown; name?: unknown; saved?: unknown } | null
      return r?.kind === 'load' &&
        typeof r.id === 'string' &&
        typeof r.name === 'string' &&
        typeof r.saved === 'string'
        ? [{ id: r.id, name: r.name, saved: r.saved }]
        : []
    })
    .sort((a, b) => (a.saved < b.saved ? 1 : -1))
    .slice(0, count)
}

/** The three newest saved loads of the browser store. */
export const recentLoads = async () =>
  newestLoads((await inStore('records', 'readonly', (s) => s.getAll())) ?? [], 3)
