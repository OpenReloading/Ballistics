/** For `useSyncExternalStore`; other tabs follow a change, and where storage refuses, the last choice holds for the page; `write` returns null to remove the key. */
export function storedChoice<T>(
  key: string,
  parse: (text: string | null) => T,
  write: (value: T) => string | null,
) {
  const listeners = new Set<() => void>()
  let page: { value: T; stored: boolean } | undefined
  // the same value while the text is unchanged, as useSyncExternalStore needs
  let cached: { text: string | null; value: T } | undefined
  const read = (): T => {
    if (page && !page.stored) return page.value
    let text: string | null
    try {
      text = localStorage.getItem(key)
    } catch {
      return page ? page.value : parse(null)
    }
    if (cached?.text !== text) cached = { text, value: parse(text) }
    return cached.value
  }
  const subscribe = (notify: () => void) => {
    listeners.add(notify)
    const otherTab = (e: StorageEvent) => {
      if (e.key === key) notify()
    }
    window.addEventListener('storage', otherTab)
    return () => {
      listeners.delete(notify)
      window.removeEventListener('storage', otherTab)
    }
  }
  const set = (value: T) => {
    const text = write(value)
    let stored = true
    try {
      if (text === null) localStorage.removeItem(key)
      else localStorage.setItem(key, text)
    } catch {
      stored = false
    }
    page = { value, stored }
    for (const notify of listeners) notify()
  }
  return { read, subscribe, set }
}
