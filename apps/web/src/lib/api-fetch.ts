/** The browser's API: `path` without the version prefix, answered from the static data files and the compute worker (`static-api.ts`). */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const { staticFetch } = await import('./static-api.ts')
  const res = await staticFetch(path, init)
  return res.ok ? res : worded(res)
}

/** A refusal with a code and params, the API's answer of a typed `InputError`. */
const isTyped = (body: unknown): body is { code: string; params: object } =>
  typeof body === 'object' &&
  body !== null &&
  typeof (body as { code?: unknown }).code === 'string' &&
  typeof (body as { params?: unknown }).params === 'object' &&
  (body as { params?: unknown }).params !== null

/** A typed refusal gets its English sentence, as the app holds every other message; the words load only for such an answer. */
async function worded(res: Response): Promise<Response> {
  const body: unknown = await res
    .clone()
    .json()
    .catch(() => undefined)
  if (!isTyped(body)) return res
  const words = await import('./refusal-words.ts').catch(() => undefined)
  const message = words?.refusalSentence(body)
  if (message === undefined) return res
  const { status, statusText, headers } = res
  return new Response(JSON.stringify({ ...body, message }), { status, statusText, headers })
}

/** Undefined when the API knows no such id (404, or 400 for an id it cannot be); a throw for any other refusal. */
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
