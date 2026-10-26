/**
 * Holds the latest value and sends it once `wait` ms pass without a newer one, or at once on
 * `flush`. Only the last value of a burst is sent, so a drag costs one send, with the exact end.
 */
export function trailing<T>(send: (value: T) => void, wait: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let held: { value: T } | undefined
  const flush = () => {
    clearTimeout(timer)
    timer = undefined
    const pending = held
    held = undefined
    if (pending) send(pending.value)
  }
  return {
    push(value: T) {
      held = { value }
      clearTimeout(timer)
      timer = setTimeout(flush, wait)
    },
    flush,
    /** Drops the held value. */
    cancel() {
      clearTimeout(timer)
      timer = undefined
      held = undefined
    },
  }
}
