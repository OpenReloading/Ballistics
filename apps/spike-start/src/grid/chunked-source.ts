import type { DataPage, DataQuery, DataSource } from '@open-reloading/ui'

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(signal.reason)
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

/** Stands in for an index read in chunks: ranges come from whole chunks of `size` rows, each loaded once per filter and sort after `delay` ms; an aborted query leaves its loads running for the next one. */
export function chunkedSource<Row>(
  inner: DataSource<Row>,
  size = 5000,
  delay = 40,
): DataSource<Row> {
  let key: Pick<DataQuery, 'filters' | 'sorting'> | undefined
  let chunks = new Map<number, Promise<DataPage<Row>>>()
  return {
    query(query, signal) {
      if (key?.filters !== query.filters || key.sorting !== query.sorting) {
        key = { filters: query.filters, sorting: query.sorting }
        chunks = new Map()
      }
      const own = chunks
      const load = (n: number) => {
        let chunk = own.get(n)
        if (!chunk) {
          chunk = wait(delay).then(() =>
            inner.query({ ...query, range: { start: n * size, count: size } }),
          )
          chunk.catch(() => own.delete(n))
          own.set(n, chunk)
        }
        return chunk
      }
      const { start, count } = query.range
      const first = Math.floor(start / size)
      const last = Math.floor((start + Math.max(count, 1) - 1) / size)
      const numbers = Array.from({ length: last - first + 1 }, (_, i) => first + i)
      return abortable(Promise.all(numbers.map(load)), signal).then((pages) => {
        const offset = start - first * size
        return {
          rows: pages.flatMap((p) => p.rows).slice(offset, offset + count),
          total: pages[0]?.total ?? 0,
        }
      })
    },
  }
}

/** Times the synchronous part of each query (where `arraySource` filters and sorts) for the results file. */
export function timedSource<Row>(
  inner: DataSource<Row>,
  log: { ms: number; query: DataQuery }[],
): DataSource<Row> {
  return {
    query(query, signal) {
      const t = performance.now()
      const page = inner.query(query, signal)
      log.push({ ms: performance.now() - t, query })
      return page
    },
  }
}
