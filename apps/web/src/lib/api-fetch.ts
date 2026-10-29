/**
 * One API call of the browser, `path` the API path without its version prefix and with its query
 * (`cartridges/308-win`, `powders?limit=200`): answered from the static data files and the compute
 * worker (`static-api.ts`), with the API's statuses and bodies.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
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
  const res = await apiFetch(`${kind}/${encodeURIComponent(id)}`, { ...(signal && { signal }) })
  if (res.status === 404 || res.status === 400) return undefined
  if (!res.ok) throw new Error(`Error ${res.status}.`)
  return (await res.json()) as T
}
