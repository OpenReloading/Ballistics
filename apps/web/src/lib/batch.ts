/**
 * Runs `task` over `items` with at most `limit` in flight, in item order of start. Nothing new
 * starts once `signal` aborts; a task in flight settles itself (its request carries the signal).
 * `onDone` is called after each task with its index, its result and how many are done. A task that
 * throws ends its worker only: the others finish, then the first error is thrown.
 */
export async function runBatch<T, R>(
  items: readonly T[],
  limit: number,
  signal: AbortSignal,
  task: (item: T, index: number) => Promise<R>,
  onDone?: (index: number, result: R, done: number) => void,
): Promise<void> {
  const queue = items.entries()
  let done = 0
  const worker = async () => {
    while (!signal.aborted) {
      const step = queue.next()
      if (step.done) return
      const [index, item] = step.value
      const result = await task(item, index)
      onDone?.(index, result, ++done)
    }
  }
  const settled = await Promise.allSettled(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  )
  const failed = settled.find((s) => s.status === 'rejected')
  if (failed) throw failed.reason
}
