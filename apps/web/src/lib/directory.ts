/** Directory lists: search, source, scope and sort kept in the URL. */
import type { SortDirection } from './lists.ts'

export type DirectorySort = { column: string; dir: SortDirection } | undefined

/**
 * A list's search, scope and sort as the URL keeps them: `query` search, `sort` a column key, "-"
 * first for descending.
 */
export interface DirectoryState {
  /** Search text, URL key `q`. */
  query: string
  sort: DirectorySort
  /** The sources that are on, comma-separated; empty for all (`sources.ts`). URL key `src`. */
  sources?: string | undefined
  /** Bullets and powders: the rows ticked for Compare, ids comma-separated, in the order ticked. URL key `pick`. */
  compareIds?: string | undefined
  /** Bullets: the id of a cartridge; only the bullets that fit it by the CIP rule (`fitRule`). */
  fits?: string | undefined
  /** Disciplines: the federation's abbreviation, from the federation record's link. URL key `org`. */
  organization?: string | undefined
}

export const emptyDirectory: DirectoryState = { query: '', sort: undefined }

/** No search, source or scope: the state Clear filters sets, the sort kept apart. */
export const noFilters: Partial<DirectoryState> = {
  ...emptyDirectory,
  sources: '',
  fits: '',
  organization: '',
}

/** Each field with its URL key, in the URL's order; the first is in every state. */
const urlKeys = [
  ['query', 'q'],
  ['sources', 'src'],
  ['compareIds', 'pick'],
  ['fits', 'fits'],
  ['organization', 'org'],
] as const satisfies readonly (readonly [Exclude<keyof DirectoryState, 'sort'>, string])[]

export function readDirectory(search: string): DirectoryState {
  const p = new URLSearchParams(search)
  const sort = p.get('sort') ?? ''
  return {
    query: p.get('q') ?? '',
    // the keys of one list only where the URL has them
    ...Object.fromEntries(
      urlKeys.slice(1).flatMap(([field, key]) => (p.has(key) ? [[field, p.get(key)]] : [])),
    ),
    sort: sort
      ? sort.startsWith('-')
        ? { column: sort.slice(1), dir: 'descending' }
        : { column: sort, dir: 'ascending' }
      : undefined,
  }
}

/** `search` with the state's parameters replaced; other parameters (such as `units`) stay. */
export function writeDirectory(state: DirectoryState, search: string): string {
  const p = new URLSearchParams(search)
  for (const k of [...urlKeys.map(([, key]) => key), 'sort']) p.delete(k)
  for (const [field, key] of urlKeys) {
    const v = state[field]
    if (v?.trim()) p.set(key, v)
  }
  if (state.sort) p.set('sort', `${state.sort.dir === 'descending' ? '-' : ''}${state.sort.column}`)
  const s = p.toString().replaceAll('%2C', ',').replaceAll('%2F', '/')
  return s ? `?${s}` : ''
}

/** Fields of `values` that are not null, so an absent value stays absent. */
export const present = <T extends object>(values: T) =>
  Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null)) as {
    [K in keyof T]?: Exclude<T[K], null>
  }
