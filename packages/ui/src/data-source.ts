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

const collator = new Intl.Collator(undefined, { numeric: true })

const compareKeys = (a: string | number, b: string | number): number =>
  typeof a === 'number' && typeof b === 'number' ? a - b : collator.compare(String(a), String(b))

/** A data source over rows in memory, for small tables and as the reference of the contract. */
export function arraySource<Row>(
  rows: readonly Row[],
  columns: ArrayColumns<Row>,
): DataSource<Row> {
  return {
    query: ({ filters, sorting, range }, signal) => {
      if (signal?.aborted) return Promise.reject(signal.reason)
      const found = rows.filter((row) =>
        filters.every(({ id, value }) => columns.matches(row, id, value)),
      )
      // toSorted is stable, so rows with equal keys keep their order
      const sorted = found.toSorted((a, b) => {
        for (const { id, desc } of sorting) {
          const order = compareKeys(columns.sortKey(a, id), columns.sortKey(b, id))
          if (order !== 0) return desc ? -order : order
        }
        return 0
      })
      return Promise.resolve({
        rows: sorted.slice(range.start, range.start + range.count),
        total: found.length,
      })
    },
  }
}
