/** What a table asks for: TanStack Table's column filters and sorting, and a range of the sorted rows. */
export interface DataQuery {
  readonly filters: readonly { readonly id: string; readonly value: unknown }[]
  readonly sorting: readonly { readonly id: string; readonly desc: boolean }[]
  readonly range: { readonly start: number; readonly count: number }
}

/** The rows of a query's range, and how many rows match its filters in all. */
export interface DataPage<Row> {
  readonly rows: readonly Row[]
  readonly total: number
}

/** The rows behind a table: the device's index, a catalog read in chunks, or rows in memory. */
export interface DataSource<Row> {
  query(query: DataQuery, signal?: AbortSignal): Promise<DataPage<Row>>
}

/** How rows in memory answer a query: whether a row passes a column's filter, and a column's sort value. */
export interface ArrayColumns<Row> {
  matches(row: Row, id: string, value: unknown): boolean
  sortKey(row: Row, id: string): string | number
}

// one collation for every source, so a table pages the same rows whichever source answers it
const collator = new Intl.Collator('en', { numeric: true })

/** Numbers by value and before text, NaN last; text by the shared collation. */
function compareSortKeys(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) || Number.isNaN(b)) return Number(Number.isNaN(a)) - Number(Number.isNaN(b))
    return a - b
  }
  if (typeof a !== typeof b) return typeof a === 'number' ? -1 : 1
  return collator.compare(String(a), String(b))
}

const validRange = ({ start, count }: DataQuery['range']) =>
  Number.isInteger(start) && Number.isInteger(count) && start >= 0 && count >= 0

/** The rows that pass `filters`, sorted by `sorting`; equal rows keep their order. */
function matching<Row>(rows: readonly Row[], columns: ArrayColumns<Row>, query: DataQuery): Row[] {
  const found = rows.filter((row) =>
    query.filters.every(({ id, value }) => columns.matches(row, id, value)),
  )
  if (query.sorting.length === 0) return found
  // each row's keys once, then a stable sort of them
  const keyed = found.map((row) => ({
    row,
    keys: query.sorting.map(({ id }) => columns.sortKey(row, id)),
  }))
  keyed.sort((a, b) => {
    for (const [i, { desc }] of query.sorting.entries()) {
      const order = compareSortKeys(a.keys[i] ?? '', b.keys[i] ?? '')
      if (order !== 0) return desc ? -order : order
    }
    return 0
  })
  return keyed.map(({ row }) => row)
}

/**
 * A data source over rows in memory, for small tables and as the reference of the contract. The rows that pass the
 * filters, sorted, are kept for the next query with the same filter and sort arrays, which a scrolling table asks.
 */
export function arraySource<Row>(
  rows: readonly Row[],
  columns: ArrayColumns<Row>,
): DataSource<Row> {
  let last:
    | { filters: DataQuery['filters']; sorting: DataQuery['sorting']; rows: Row[] }
    | undefined
  return {
    query: (query, signal) => {
      if (signal?.aborted) return Promise.reject(signal.reason)
      if (!validRange(query.range))
        return Promise.reject(new RangeError(`not a range of rows: ${JSON.stringify(query.range)}`))
      // a table replaces its filter and sort state when either changes, so the same arrays ask for the same rows
      if (last?.filters !== query.filters || last.sorting !== query.sorting)
        last = {
          filters: query.filters,
          sorting: query.sorting,
          rows: matching(rows, columns, query),
        }
      const { start, count } = query.range
      return Promise.resolve({
        rows: last.rows.slice(start, start + count),
        total: last.rows.length,
      })
    },
  }
}
