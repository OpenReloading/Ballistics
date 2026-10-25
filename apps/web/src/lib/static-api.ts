/**
 * The API of the Pages edition, in the browser. Reads answer from the data files the Pages build
 * writes under `<base>/api/` (`writeStaticApi` of `@open-reloading/api/static`): lists from the
 * catalogue over `catalogue/index.json`, the code the API's routes run, and records from
 * `<kind>/<id>.json`. `POST interior` and
 * `interior/charge-target` run the API's own validation and runs (`@open-reloading/api/compute`),
 * each compute task in a Web Worker of its own, terminated at the API's task deadline.
 */

import { type Catalogue, type CatalogueIndex, openCatalogue } from '@open-reloading/api/catalogue'
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
} from '@open-reloading/api/compute'
import type { Powder } from '@open-reloading/schema'
import { basePath } from './edition.ts'

const listKinds = new Set([
  'cartridges',
  'bullets',
  'powders',
  'manufacturers',
  'target-faces',
  'federations',
  'disciplines',
  'target-mappings',
  'caliber-classes',
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

/** The query values each list reads besides `q`, `limit` and `offset`; the API drops the others. */
const filters: Record<string, string[]> = {
  cartridges: ['table'],
  bullets: ['manufacturer', 'cartridge'],
  powders: ['manufacturer'],
  disciplines: ['federation'],
  'target-mappings': ['discipline', 'face'],
}

let opened: { index: CatalogueIndex; catalogue: Catalogue } | undefined

/**
 * The catalogue over `catalogue/index.json`, the index every list is answered from.
 * shortcut: lists only, a record is read from its own data file; extend `records` when a caller needs `get`.
 */
async function catalogue() {
  const index = await dataFile<CatalogueIndex>('catalogue/index')
  if (!index) throw new Error('catalogue/index.json answered 404')
  if (opened?.index !== index)
    opened = {
      index,
      catalogue: openCatalogue({
        index,
        records: () => {
          throw new Error('the Pages catalogue holds the index only')
        },
      }),
    }
  return opened.catalogue
}

/**
 * A list answer, from the catalogue as the API's routes answer it: the same paging, `q`, filters and
 * order, the refusals of its query schemas. Cartridges, bullets and powders page (`limit`, `offset`)
 * and search (`q`); the filters are `table` (cartridges), `manufacturer` (bullets, powders),
 * `cartridge` (bullets), `federation` (disciplines) and `discipline` and `face` (target mappings).
 * Other keys are dropped, as the API drops them.
 */
async function list(kind: string, query: URLSearchParams) {
  const paged = searchKinds.has(kind)
  const own = (name: string) =>
    filters[kind]?.includes(name) ? (query.get(name) ?? undefined) : undefined
  const limit = paged ? integer(query.get('limit'), 50, 1, 200) : 0
  const offset = paged ? integer(query.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER) : 0
  const q = paged ? (query.get('q') ?? undefined) : undefined
  const [table, manufacturer, cartridge, federation, discipline, face] = [
    'table',
    'manufacturer',
    'cartridge',
    'federation',
    'discipline',
    'face',
  ].map(own)
  const text = (v: string | undefined, max: number) =>
    v === undefined || (v.length >= 1 && v.length <= max && !v.includes('\0'))
  const id = (v: string | undefined) => v === undefined || (v.length <= 100 && recordId.test(v))
  if (
    Number.isNaN(limit) ||
    Number.isNaN(offset) ||
    !text(q, 100) ||
    !text(table, 10) ||
    ![manufacturer, cartridge, federation, discipline, face].every(id)
  )
    return refusal(400, 'Bad Request', 'querystring does not match the schema')
  const c = await catalogue()
  const paging = { limit, offset }
  switch (kind) {
    case 'cartridges':
      return answer(200, c.cartridges({ q, table, ...paging }))
    case 'bullets':
      return answer(200, c.bullets({ q, manufacturer, cartridge, ...paging }))
    case 'powders':
      return answer(200, c.powders({ q, manufacturer, ...paging }))
    case 'manufacturers':
      return answer(200, c.manufacturers())
    case 'target-faces':
      return answer(200, c.targetFaces())
    case 'federations':
      return answer(200, c.federations())
    case 'disciplines':
      return answer(200, c.disciplines({ federation }))
    case 'caliber-classes':
      return answer(200, c.caliberClasses())
    default:
      return answer(200, c.targetMappings({ discipline, face }))
  }
}

async function get(path: string) {
  const url = new URL(path, 'https://api/')
  const [kind, id, ...rest] = url.pathname.slice(1).split('/')
  if (kind === undefined || !listKinds.has(kind) || rest.length > 0)
    return refusal(404, 'Not Found', `${path} not found`)
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
    return failure(error, signal)
  }
}

function failure(error: unknown, signal: AbortSignal | undefined) {
  if (signal?.aborted) throw signal.reason
  if (error instanceof RecordUnread) throw error
  if (error instanceof RecordNotFound) return refusal(404, 'Not Found', error.message)
  const known = errorAnswer(error, { withNotice: true, truingDetails: false })
  if (known) return answer(known.status, known.body)
  return refusal(500, 'Internal Server Error', 'internal server error')
}

/** `apiFetch` of the Pages edition: GET from the data files, POST from the compute worker. */
export async function staticFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await (init?.method === 'POST' ? post(path, init) : get(path))
  if (init?.signal?.aborted) throw init.signal.reason
  return res
}
