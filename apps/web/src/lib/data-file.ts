import { basePath, edition } from './edition.ts'
import { recordsCache } from './offline.ts'

const files = new Map<string, Promise<unknown>>()

/**
 * Keeps a data file read before a service worker controlled the page in the records cache, where
 * the worker keeps the files it saw: the first visit's reads pass it by, so the page stores them
 * itself once the worker is ready, and the record opens again offline. The catalogue index is the
 * worker's precache. Failures are ignored.
 */
function keepForOffline(name: string, url: string, res: Response) {
  if (name.startsWith('catalogue/') || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.ready
    .then(() => caches.open(recordsCache(edition)))
    .then((cache) => cache.put(url, res))
    .catch(() => {})
}

/**
 * A data file of the export (`name` without `.json`, under `<base>/api/`), undefined when there is
 * none, kept for the page load. The record pages read their record here, the Pages API
 * (`static-api.ts`) reads its records and the catalogue index.
 */
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
