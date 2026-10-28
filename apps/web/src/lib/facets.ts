/** The choice filters of the lists: which rows pass them and how many each option would leave. */

/** What one list filters by: a field whose values a row has one or several of. */
export interface Facet<T> {
  /** The URL parameter. */
  key: string
  label: string
  /** The row's values for this filter, as the URL keeps them; none when the row has no value. */
  values: (row: T) => readonly string[]
  /** The text of a value; the value itself where unset. */
  text?: (value: string) => string
  /** The order of the options; by text where unset. */
  order?: (a: string, b: string) => number
}

/** The values chosen, by filter key. A filter with no entry, or an empty one, lets every row pass. */
export type FacetSelection = Readonly<Record<string, readonly string[]>>

/** One option of a filter: its value, its text and the rows it leaves. */
export interface FacetOption {
  value: string
  text: string
  count: number
}

const chosen = (selected: FacetSelection, key: string) => selected[key] ?? []

/** Whether a row passes every filter but `skip`: one of the row's values is chosen. */
function passesFacets<T>(
  row: T,
  facets: readonly Facet<T>[],
  selected: FacetSelection,
  skip?: string,
) {
  return facets.every((f) => {
    const on = chosen(selected, f.key)
    return f.key === skip || on.length === 0 || f.values(row).some((v) => on.includes(v))
  })
}

/** The rows that pass every filter. */
export const facetRows = <T>(rows: readonly T[], facets: readonly Facet<T>[], s: FacetSelection) =>
  rows.filter((r) => passesFacets(r, facets, s))

/** The rows of `base` that pass the other filters than `facet`, counted by each value they have. */
function countValues<T>(
  base: readonly T[],
  facets: readonly Facet<T>[],
  selected: FacetSelection,
  facet: Facet<T>,
) {
  const counts = new Map<string, number>()
  for (const r of base) {
    if (!passesFacets(r, facets, selected, facet.key)) continue
    for (const v of new Set(facet.values(r))) counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  return counts
}

/**
 * The options of each filter: every value any of `all` has, with the rows of `base` (`all` after
 * the search) that pass the other filters and have the value, so a count of 0 is a choice that
 * leaves nothing. A filter that `all` gives fewer than two values is left out unless it has a
 * value chosen. Values chosen but absent from `all` stay, to be unchecked.
 */
export function facetOptions<T>(
  all: readonly T[],
  base: readonly T[],
  facets: readonly Facet<T>[],
  selected: FacetSelection,
) {
  const out = new Map<string, FacetOption[]>()
  for (const f of facets) {
    const on = chosen(selected, f.key)
    const universe = new Set([...all.flatMap((r) => f.values(r)), ...on])
    if (universe.size < 2 && on.length === 0) continue
    const counts = countValues(base, facets, selected, f)
    const text = (v: string) => f.text?.(v) ?? v
    const order = f.order ?? ((a, b) => text(a).localeCompare(text(b), 'en', { numeric: true }))
    out.set(
      f.key,
      [...universe]
        .sort(order)
        .map((value) => ({ value, text: text(value), count: counts.get(value) ?? 0 })),
    )
  }
  return out
}

/** The chosen options as the no-match note names them: "Federation DSB, BDS". */
export function facetNames<T>(facets: readonly Facet<T>[], selected: FacetSelection) {
  return facets.flatMap((f) => {
    const on = chosen(selected, f.key)
    return on.length > 0 ? [`${f.label} ${on.map((v) => f.text?.(v) ?? v).join(', ')}`] : []
  })
}
