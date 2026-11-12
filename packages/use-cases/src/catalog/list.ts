import { score } from '@open-reloading/schema'
import type { CataloguePage, IndexRow, Paging } from './types.ts'

/**
 * One page of the rows that `keep` accepts, in the order of `rows` or, where `q` is set, ranked
 * by `score` (ties keep the row order). `total` counts before paging.
 */
export function select<T>(
  rows: readonly IndexRow<T>[],
  { q, limit, offset = 0 }: Paging & { q?: string | undefined },
  keep: (item: T) => boolean = () => true,
): CataloguePage<T> {
  let found = rows.filter((r) => keep(r.item)).map((r) => ({ r, rank: 0 }))
  if (q?.trim()) {
    found = found.flatMap(({ r }) => {
      const rank = score(r.search, q)
      return rank === undefined ? [] : [{ r, rank }]
    })
    // the sort is stable, so equal ranks stay in the default order
    found.sort((a, b) => b.rank - a.rank)
  }
  return {
    total: found.length,
    items: found
      .slice(offset, limit === undefined ? undefined : offset + limit)
      .map((f) => f.r.item),
  }
}
