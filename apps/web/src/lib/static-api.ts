/**
 * The API of the Pages edition, in the browser. Reads answer from the data files the Pages build
 * writes under `<base>/api/` (`writeStaticApi` of `@openreloading/api/static`): lists filtered and
 * paged here as the API does, `q` ranked over the keys of `<kind>/search.json`. `POST interior` and
 * `interior/charge-target` run the API's own validation and runs (`@openreloading/api/compute`),
 * each compute task in a Web Worker of its own, terminated at the API's task deadline.
 */
import {
  type CartridgeWithSpecs,
  type ComputeRunner,
  ComputeTimeout,
  chargeBody,
  errorAnswer,
  interiorBody,
  reviveError,
  runChargeTarget,
  runInterior,
  taskTimeoutMs,
} from '@openreloading/api/compute'
import { type Powder, score } from '@openreloading/schema'
import { basePath } from './edition.ts'

type List = { total: number; items: { id: string; manufacturer?: string }[] }

const listKinds = new Set([
  'cartridges',
  'bullets',
  'powders',
  'manufacturers',
  'target-faces',
  'federations',
  'disciplines',
  'target-mappings',
])
const searchKinds = new Set(['cartridges', 'bullets', 'powders'])
const recordId = /^[a-z0-9]+(-[a-z0-9]+)*$/
/** The forwarding route's cap on a compute body (`src/app/api/[...path]/route.server.ts`). */
const maxBody = 64 * 1024

const answer = (status: number, body: unknown) => Response.json(body, { status })
const refusal = (status: number, error: string, message: string) =>
  answer(status, { statusCode: status, error, message })

const files = new Map<string, Promise<unknown>>()

/** A data file (`name` without `.json`), undefined when there is none, kept for the page load. */
function dataFile<T>(name: string): Promise<T | undefined> {
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

/** An integer query value within `min` and `max`, `fallback` when absent, NaN when invalid. */
function integer(value: string | null, fallback: number, min: number, max: number) {
  if (value === null) return fallback
  const n = Number(value)
  return /^\d+$/.test(value) && n >= min && n <= max ? n : Number.NaN
}

/**
 * A list answer. Cartridges, bullets and powders page (`limit`, `offset`) and search (`q` ranked by
 * `score` of the schema package over the `search` keys of the data files), bullets and powders also by `manufacturer`, bullets by `cartridge`. The other lists answer every item. Other keys
 * are dropped, as the API drops them. The filters of the federation lists (`federation`,
 * `discipline`, `face`) have no data files: 400.
 */
async function list(kind: string, query: URLSearchParams) {
  if (!searchKinds.has(kind)) {
    for (const key of ['federation', 'discipline', 'face'])
      if (query.has(key)) return refusal(400, 'Bad Request', `${key} is not in the Pages edition`)
    return answer(200, await dataFile<List>(`${kind}/index`))
  }
  const limit = integer(query.get('limit'), 50, 1, 200)
  const offset = integer(query.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER)
  const q = query.get('q')
  const cartridge = kind === 'bullets' ? query.get('cartridge') : null
  const manufacturer = kind === 'cartridges' ? null : query.get('manufacturer')
  const id = (v: string | null) => v === null || (v.length <= 100 && recordId.test(v))
  if (
    Number.isNaN(limit) ||
    Number.isNaN(offset) ||
    (q !== null && !(q.length >= 1 && q.length <= 100)) ||
    !id(cartridge) ||
    !id(manufacturer)
  )
    return refusal(400, 'Bad Request', 'querystring does not match the schema')
  // a cartridge none fits has no file
  const source = cartridge === null ? `${kind}/index` : `bullets/cartridge/${cartridge}`
  let items = (await dataFile<List>(source))?.items ?? []
  if (manufacturer !== null) items = items.filter((i) => i.manufacturer === manufacturer)
  if (q?.trim()) {
    const keys = (await dataFile<Record<string, string>>(`${kind}/search`)) ?? {}
    // the API's `select` (`packages/api/src/catalogue/list.ts`): ranked, equal ranks in list order
    items = items
      .flatMap((i) => {
        const rank = score(keys[i.id] ?? '', q)
        return rank === undefined ? [] : [{ i, rank }]
      })
      .sort((a, b) => b.rank - a.rank)
      .map(({ i }) => i)
  }
  return answer(200, { total: items.length, items: items.slice(offset, offset + limit) })
}

async function get(path: string) {
  const url = new URL(path, 'http://api/')
  const [kind, id, ...rest] = url.pathname.slice(1).split('/')
  if (!listKinds.has(kind) || rest.length > 0) return refusal(404, 'Not Found', `${path} not found`)
  if (id === undefined || id === '') return list(kind, url.searchParams)
  if (!recordId.test(id)) return refusal(400, 'Bad Request', 'params/id must match the record id')
  const record = await dataFile(`${kind}/${id}`)
  return record === undefined
    ? refusal(404, 'Not Found', `${kind.replace(/s$/, '')} ${id} not found`)
    : answer(200, record)
}

/** An unknown record id of a compute body: the API answers it 404. */
class RecordNotFound extends Error {}
/** A record file of a compute body not read (offline, not cached): thrown as a failed API request is. */
class RecordUnread extends Error {}

const findRecord =
  <T>(kind: string) =>
  async (id: string): Promise<T> => {
    const record = await dataFile<T>(`${kind}/${id}`).catch((cause: unknown) => {
      throw new RecordUnread(`${kind}/${id}.json not read`, { cause })
    })
    if (record === undefined) throw new RecordNotFound(`${kind.replace(/s$/, '')} ${id} not found`)
    return record
  }

/**
 * Runs each task in a Web Worker of its own, terminated after `taskTimeoutMs` (a `ComputeTimeout`,
 * as the API's pool) or when `signal` aborts.
 */
function workerRunner(signal: AbortSignal | undefined): ComputeRunner {
  return {
    run: (task) =>
      new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./compute.worker.ts', import.meta.url), {
          type: 'module',
        })
        const end = () => {
          clearTimeout(timer)
          signal?.removeEventListener('abort', abort)
          worker.terminate()
        }
        const abort = () => {
          end()
          reject(signal?.reason)
        }
        const timer = setTimeout(() => {
          end()
          reject(new ComputeTimeout(`computation did not finish within ${taskTimeoutMs} ms`))
        }, taskTimeoutMs)
        signal?.addEventListener('abort', abort, { once: true })
        worker.onmessage = (e) => {
          end()
          if (e.data.succeeded) resolve(e.data.value)
          else reject(reviveError(e.data.error))
        }
        worker.onerror = () => {
          end()
          reject(new Error('compute worker failed'))
        }
        worker.postMessage(task)
      }),
    close: async () => {},
  }
}

async function post(path: string, init: RequestInit | undefined) {
  if (path !== 'interior' && path !== 'interior/charge-target')
    return refusal(404, 'Not Found', `${path} not found`)
  const text = typeof init?.body === 'string' ? init.body : ''
  if (new TextEncoder().encode(text).length > maxBody)
    return refusal(413, 'Payload Too Large', 'request body above 64 KiB')
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return refusal(400, 'Bad Request', 'Body is not valid JSON')
  }
  const signal = init?.signal ?? undefined
  const context = {
    compute: workerRunner(signal),
    findCartridge: findRecord<CartridgeWithSpecs>('cartridges'),
    findPowder: findRecord<Powder>('powders'),
  }
  try {
    const { status, payload } =
      path === 'interior'
        ? await runInterior(context, interiorBody.parse(body))
        : await runChargeTarget(context, chargeBody.parse(body))
    return answer(status, payload)
  } catch (error) {
    if (signal?.aborted) throw signal.reason
    if (error instanceof RecordUnread) throw error
    if (error instanceof RecordNotFound) return refusal(404, 'Not Found', error.message)
    const known = errorAnswer(error, { withNotice: true, truingDetails: false })
    if (known) return answer(known.status, known.body)
    return refusal(500, 'Internal Server Error', 'internal server error')
  }
}

/** `apiFetch` of the Pages edition: GET from the data files, POST from the compute worker. */
export async function staticFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await (init?.method === 'POST' ? post(path, init) : get(path))
  if (init?.signal?.aborted) throw init.signal.reason
  return res
}
