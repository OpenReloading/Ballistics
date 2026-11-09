/** `AbortSignal.any` for Firefox before 124 and Safari before 17.4, which lack it. */
export function anySignal(signals: readonly AbortSignal[]): AbortSignal {
  const all = new AbortController()
  for (const s of signals) {
    if (s.aborted) {
      all.abort(s.reason)
      break
    }
    // the listeners go once `all` aborts
    s.addEventListener('abort', () => all.abort(s.reason), { once: true, signal: all.signal })
  }
  return all.signal
}
