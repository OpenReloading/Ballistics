import { pagesBasePath } from './edition.ts'

/**
 * One API call of the browser, `path` the API path without its version prefix and with its query
 * (`cartridges/308-win`, `powders?limit=200`). Server edition: through the forwarding route
 * `/api/`. Pages edition: from the static data files and the compute worker (`static-api.ts`),
 * with the API's statuses and bodies.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  if (pagesBasePath === undefined) return fetch(`/api/${path}`, init)
  const { staticFetch } = await import('./static-api.ts')
  return staticFetch(path, init)
}

/**
 * A record by id through `apiFetch` (`kind` as `bullets`): undefined when the API knows no such id
 * (404, or 400 for an id it cannot be), a throw for any other refusal.
 */
export async function fetchRecord<T>(
  kind: string,
  id: string,
  signal?: AbortSignal,
): Promise<T | undefined> {
  const res = await apiFetch(`${kind}/${encodeURIComponent(id)}`, { signal })
  if (res.status === 404 || res.status === 400) return undefined
  if (!res.ok) throw new Error(`The API answered ${res.status}.`)
  return (await res.json()) as T
}
