import { basePath, edition } from './edition.ts'
import { recordsCache } from './offline.ts'

const files = new Map<string, Promise<unknown>>()

/** The first visit's reads pass the worker by, so the page stores them itself once the worker is ready; failures are ignored. */
function keepForOffline(name: string, url: string, res: Response) {
  if (name.startsWith('catalogue/') || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.ready
    .then(() => caches.open(recordsCache(edition)))
    .then((cache) => cache.put(url, res))
    .catch(() => {})
}

/** Under `<base>/api/`, kept for the page load; undefined when there is none. */
export function dataFile<T>(name: string): Promise<T | undefined> {
  let file = files.get(name)
  if (!file) {
    const url = `${basePath}/api/${name}.json`
    const controlled = Boolean(navigator.serviceWorker?.controller)
    file = fetch(url).then((res) => {
      if (res.status === 404) return
      if (!res.ok) throw new Error(`${name}.json answered ${res.status}`)
      if (!controlled) keepForOffline(name, url, res.clone())
      return res.json()
    })
    file.catch(() => files.delete(name))
    files.set(name, file)
  }
  return file as Promise<T | undefined>
}
