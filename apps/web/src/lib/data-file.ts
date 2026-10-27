import { basePath } from './edition.ts'

const files = new Map<string, Promise<unknown>>()

/**
 * A data file of the export (`name` without `.json`, under `<base>/api/`), undefined when there is
 * none, kept for the page load. The record pages read their record here, the Pages API
 * (`static-api.ts`) reads its records and the catalogue index.
 */
export function dataFile<T>(name: string): Promise<T | undefined> {
  let file = files.get(name)
  if (!file) {
    file = fetch(`${basePath}/api/${name}.json`).then((res) => {
      if (res.status === 404) return
      if (!res.ok) throw new Error(`${name}.json answered ${res.status}`)
      return res.json()
    })
    file.catch(() => files.delete(name))
    files.set(name, file)
  }
  return file as Promise<T | undefined>
}
