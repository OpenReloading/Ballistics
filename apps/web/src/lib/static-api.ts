/** The API in the browser over the data files the Pages build writes under `<base>/api/` (`writeStaticApi` of `@open-reloading/api/static`), running the API's own code (`@open-reloading/use-cases`), each compute task in its own worker. */

import { type Catalogue, type CatalogueIndex, openCatalogue } from '@open-reloading/api/catalogue'
import { type Powder, primerCompounds, primerSizes, recordIdRegex } from '@open-reloading/schema'
import {
  type CartridgeWithSpecs,
  type ComputeRunner,
  ComputeTimeout,
  chargeBody,
  errorAnswer,
  interiorBody,
  RecordNotFound,
  reviveError,
  runChargeTarget,
  runInterior,
  type TaskReply,
  taskTimeoutMs,
} from '@open-reloading/use-cases'
import { maxRecordIdLength } from './compare-ids.ts'
import { dataFile } from './data-file.ts'

const listKinds = new Set([
  'cartridges',
  'bullets',
  'powders',
  'cases',
  'primers',
  'manufacturers',
  'target-faces',
  'federations',
  'disciplines',
  'target-mappings',
  'caliber-classes',
  'event-types',
])
const searchKinds = new Set(['cartridges', 'bullets', 'powders', 'cases', 'primers'])
/** A compute body above this many bytes is refused with 413: an interior body is under 1 KiB, so the cap keeps a pasted file out of the Worker. */
const maxBody = 64 * 1024

const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const refusal = (status: number, error: string, message: string) =>
  answer(status, { statusCode: status, error, message })

/** An integer query value within `min` and `max`, `fallback` when absent, NaN when invalid. */
function integer(value: string | null, fallback: number, min: number, max: number) {
  if (value === null) return fallback
  const n = Number(value)
  return /^\d+$/.test(value) && n >= min && n <= max ? n : Number.NaN
}

/** The query values each list reads besides `q`, `limit` and `offset`; the API refuses the others. */
const filters: Record<string, string[]> = {
  cartridges: ['table'],
  bullets: ['manufacturer', 'cartridge'],
  powders: ['manufacturer'],
  cases: ['manufacturer', 'cartridge'],
  primers: ['manufacturer', 'size', 'compound'],
  disciplines: ['federation'],
  'target-mappings': ['discipline', 'face'],
}

let opened: { index: CatalogueIndex; catalogue: Catalogue } | undefined

/** shortcut: lists only, a record is read from its own data file; extend `records` when a caller needs `get`. */
export async function catalogue(): Promise<Catalogue> {
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

/** Paging, `q`, filters, order and refusals as the API's routes, so the static site answers as the server does. */
async function list(kind: string, query: URLSearchParams) {
  const p = listQuery(kind, query)
  if (!p) return refusal(400, 'Bad Request', 'querystring does not match the schema')
  return listAnswer(await catalogue(), kind, p)
}

/** The parameters of a list as the API's query schemas read them. */
type ListQuery = NonNullable<ReturnType<typeof listQuery>>

/** A text filter of at most `max` characters without NUL, or none. */
const text = (v: string | undefined, max: number) =>
  v === undefined || (v.length >= 1 && v.length <= max && !v.includes('\0'))
/** A record id filter, or none. */
const id = (v: string | undefined) =>
  v === undefined || (v.length <= maxRecordIdLength && recordIdRegex.test(v))

/** The query of a list of `kind`; undefined where the API's query schema refuses it. */
function listQuery(kind: string, query: URLSearchParams) {
  const paged = searchKinds.has(kind)
  const own = (name: string) =>
    filters[kind]?.includes(name) ? (query.get(name) ?? undefined) : undefined
  const limit = paged ? integer(query.get('limit'), 50, 1, 200) : 0
  const offset = paged ? integer(query.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER) : 0
  const q = paged ? (query.get('q') ?? undefined) : undefined
  const [table, manufacturer, cartridge, federation, discipline, face, size, compound] = [
    'table',
    'manufacturer',
    'cartridge',
    'federation',
    'discipline',
    'face',
    'size',
    'compound',
  ].map(own)
  const sizeOf = primerSizes.options.find((o) => o === size)
  const compoundOf = primerCompounds.options.find((o) => o === compound)
  const known = [...(filters[kind] ?? []), ...(paged ? ['q', 'limit', 'offset'] : [])]
  const refused =
    [...query.keys()].some((k) => !known.includes(k)) ||
    /\p{Cc}/u.test(q ?? '') ||
    Number.isNaN(limit) ||
    Number.isNaN(offset) ||
    !text(q, 100) ||
    !text(table, 10) ||
    ![manufacturer, cartridge, federation, discipline, face].every(id) ||
    (size !== undefined && sizeOf === undefined) ||
    (compound !== undefined && compoundOf === undefined)
  if (refused) return
  return {
    q,
    limit,
    offset,
    table,
    manufacturer,
    cartridge,
    federation,
    discipline,
    face,
    size: sizeOf,
    compound: compoundOf,
  }
}

/** The catalogue's answer to a list of `kind`. */
function listAnswer(c: Catalogue, kind: string, p: ListQuery) {
  const { q, table, manufacturer, cartridge, federation, discipline, face } = p
  const paging = { limit: p.limit, offset: p.offset }
  switch (kind) {
    case 'cartridges':
      return answer(200, c.cartridges({ q, table, ...paging }))
    case 'bullets':
      return answer(200, c.bullets({ q, manufacturer, cartridge, ...paging }))
    case 'powders':
      return answer(200, c.powders({ q, manufacturer, ...paging }))
    case 'primers':
      return answer(
        200,
        c.primers({ q, manufacturer, size: p.size, compound: p.compound, ...paging }),
      )
    case 'cases':
      return answer(200, c.cases({ q, manufacturer, cartridge, ...paging }))
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
    case 'event-types':
      return answer(200, c.eventTypes())
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
  if (!recordIdRegex.test(id))
    return refusal(400, 'Bad Request', 'params/id must match the record id')
  const record = await dataFile(`${kind}/${id}`)
  return record === undefined
    ? refusal(404, 'Not Found', `${kind.replace(/s$/, '')} ${id} not found`)
    : answer(200, record)
}

/** A record file of a compute body not read (offline, not cached): thrown as a failed API request is. */
class RecordUnread extends Error {}

const findRecord =
  <T>(kind: string) =>
  async (id: string): Promise<T> => {
    const record = await dataFile<T>(`${kind}/${id}`).catch((cause: unknown) => {
      throw new RecordUnread(`${kind}/${id}.json not read`, { cause })
    })
    if (record === undefined) throw new RecordNotFound(kind.replace(/s$/, ''), id)
    return record
  }

/** Terminated after `taskTimeoutMs` with a `ComputeTimeout`, as the API's pool. */
function workerRunner(signal: AbortSignal | undefined): ComputeRunner {
  return {
    run: (task) => {
      // an abort during the record reads before the first run lands before any worker starts
      if (signal?.aborted) return Promise.reject(signal.reason)
      return new Promise((resolve, reject) => {
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
        worker.onmessage = (e: MessageEvent<TaskReply>) => {
          end()
          if (e.data.succeeded) resolve(e.data.value as never)
          else reject(reviveError(e.data.error))
        }
        worker.onerror = () => {
          end()
          reject(new Error('compute worker failed'))
        }
        worker.postMessage(task)
      })
    },
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
  const known = errorAnswer(error, { withNotice: true, truingDetails: false })
  if (known) return answer(known.status, known.body)
  return refusal(500, 'Internal Server Error', 'internal server error')
}

/** `apiFetch` of the static site: GET from the data files, POST from the compute worker. */
export async function staticFetch(path: string, init?: RequestInit): Promise<Response> {
  const signal = init?.signal ?? undefined
  if (signal?.aborted) throw signal.reason
  const answered = init?.method === 'POST' ? post(path, init) : get(path)
  // an abort settles this caller at once; the data file read it waits for is shared and keeps going
  let onAbort: (() => void) | undefined
  const aborted =
    signal &&
    new Promise<never>((_, reject) => {
      onAbort = () => reject(signal.reason)
      signal.addEventListener('abort', onAbort, { once: true })
    })
  let res: Response
  try {
    res = await (aborted ? Promise.race([answered, aborted]) : answered)
  } finally {
    // a signal reused across calls keeps no listener of a settled one
    if (signal && onAbort) signal.removeEventListener('abort', onAbort)
  }
  if (signal?.aborted) throw signal.reason
  return res
}
