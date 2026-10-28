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
  sources?: string
  /** Bullets and powders: the rows ticked for Compare, ids comma-separated, in the order ticked. URL key `pick`. */
  compareIds?: string
  /** Bullets: the id of a cartridge; only the bullets that fit it by the CIP rule (`fitRule`). */
  fits?: string
  /** The values chosen per choice filter (`facets.ts`), under the filter's key as URL key, comma-separated. */
  facets?: Record<string, string[]>
}

export const emptyDirectory: DirectoryState = { query: '', sort: undefined }

/** No search, source or scope: the state Clear filters sets, the sort kept apart. */
export const noFilters: Partial<DirectoryState> = {
  ...emptyDirectory,
  sources: '',
  fits: '',
  facets: {},
}

/** Each field with its URL key, in the URL's order; the first is in every state. */
const urlKeys = [
  ['query', 'q'],
  ['sources', 'src'],
  ['compareIds', 'pick'],
  ['fits', 'fits'],
] as const satisfies readonly (readonly [Exclude<keyof DirectoryState, 'sort'>, string])[]

/** `search` read into a state; `facetKeys` are the choice filters of the list, read where the URL has them. */
export function readDirectory(search: string, facetKeys: readonly string[] = []): DirectoryState {
  const p = new URLSearchParams(search)
  const sort = p.get('sort') ?? ''
  const facets = Object.fromEntries(
    facetKeys.flatMap((k) => {
      const values = (p.get(k) ?? '').split(',').filter(Boolean)
      return values.length > 0 ? [[k, values]] : []
    }),
  )
  return {
    query: p.get('q') ?? '',
    // the keys of one list only where the URL has them
    ...Object.fromEntries(
      urlKeys.slice(1).flatMap(([field, key]) => (p.has(key) ? [[field, p.get(key)]] : [])),
    ),
    ...(Object.keys(facets).length > 0 && { facets }),
    sort: sort
      ? sort.startsWith('-')
        ? { column: sort.slice(1), dir: 'descending' }
        : { column: sort, dir: 'ascending' }
      : undefined,
  }
}

/**
 * `search` with the state's parameters replaced; other parameters (such as `units`) stay. The
 * parameters of `facetKeys` and of the facets in the state are replaced too.
 */
export function writeDirectory(
  state: DirectoryState,
  search: string,
  facetKeys: readonly string[] = [],
): string {
  const p = new URLSearchParams(search)
  const facets = Object.entries(state.facets ?? {})
  for (const k of [
    ...urlKeys.map(([, key]) => key),
    'sort',
    ...facetKeys,
    ...facets.map(([k]) => k),
  ])
    p.delete(k)
  for (const [field, key] of urlKeys) {
    const v = state[field]
    if (v?.trim()) p.set(key, v)
  }
  for (const [k, values] of facets) if (values.length > 0) p.set(k, values.join(','))
  if (state.sort) p.set('sort', `${state.sort.dir === 'descending' ? '-' : ''}${state.sort.column}`)
  const s = p.toString().replaceAll('%2C', ',').replaceAll('%2F', '/')
  return s ? `?${s}` : ''
}

/** Fields of `values` that are not null, so an absent value stays absent. */
export const present = <T extends object>(values: T) =>
  Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null)) as {
    [K in keyof T]?: Exclude<T[K], null>
  }
