import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { runTask, serializeError, type Task } from '@open-reloading/api/compute'
import { startBundleApi, writeStaticApi } from '@open-reloading/api/static'
import { sortKey } from '@open-reloading/schema'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { chargeTargetExample } from '../../../packages/api/src/compute/charge-schema.ts'
import { interiorExample } from '../../../packages/api/src/compute/interior-schema.ts'
import { staticFetch } from '../src/lib/static-api.ts'

let api: Awaited<ReturnType<typeof startBundleApi>>
let dir: string

/** A Web Worker that runs the task in this thread, as `compute.worker.ts` does in its own. */
class InlineWorker {
  onmessage?: (e: { data: unknown }) => void
  onerror?: () => void
  postMessage(task: Task) {
    setTimeout(() => {
      try {
        this.onmessage?.({ data: { succeeded: true, value: runTask(task) } })
      } catch (error) {
        this.onmessage?.({ data: { succeeded: false, error: serializeError(error) } })
      }
    })
  }
  terminate() {}
}

beforeAll(async () => {
  api = await startBundleApi()
  dir = await mkdtemp(path.join(tmpdir(), 'static-api-'))
  await writeStaticApi(api.data, dir)
  // the data files as a static host serves them at the site root
  vi.stubGlobal('fetch', async (url: string) => {
    const file = path.join(dir, url.replace(/^\/api\//, ''))
    try {
      return new Response(await readFile(file, 'utf8'), { status: 200 })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
  vi.stubGlobal('Worker', InlineWorker)
})

afterAll(async () => {
  vi.unstubAllGlobals()
  await api?.close()
  await rm(dir, { recursive: true, force: true })
})

/** The API's answer to `path` (no version prefix) and the static one: status and body. */
async function both(path: string, body?: object) {
  const [live, file] = await Promise.all([
    api.app.inject({
      url: `/v1/${path}`,
      method: body ? 'POST' : 'GET',
      ...(body && { payload: body }),
    }),
    staticFetch(
      path,
      body
        ? {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'content-type': 'application/json' },
          }
        : undefined,
    ),
  ])
  const liveBody = live.json()
  // the API names what produced an answer; the browser's compute answers carry no such fields
  for (const key of ['inputHash', 'apiVersion', 'dataHash']) delete liveBody[key]
  return {
    live: { status: live.statusCode, body: liveBody },
    file: { status: file.status, body: await file.json() },
  }
}

describe('the static site answers reads as the API', () => {
  const kinds = [
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
  ]
  /** The kinds that page; the others refuse `limit` and `offset`. */
  const paged = kinds.slice(0, 5)

  it('gives every list, paged, as the API does', async () => {
    for (const kind of kinds)
      for (const query of [
        '',
        ...(paged.includes(kind) ? ['?limit=200', '?limit=3&offset=2', '?offset=100000'] : []),
      ]) {
        const { live, file } = await both(`${kind}${query}`)
        expect(file, `${kind}${query}`).toEqual(live)
      }
  })

  it('finds what the API finds for q: names, aliases, spec names, manufacturers', async () => {
    const queries = {
      cartridges: ['308', 'WIN', 'magnum', 'x', '7,62', 'mm', 'zzzz', '%', '_'],
      bullets: ['demo', 'DEMO BULLETS', '168', 'hpbt', 'zzzz'],
      powders: ['demo', 'dp40', 'Powder Co', 'zzzz'],
      cases: ['demo', 'demo cases', 'C308', 'brass', '308', 'zzzz'],
      primers: ['demo', 'demo primers', 'DP-SP', 'pistol', 'lead free', 'zzzz'],
    }
    const { items } = (await both('cartridges?limit=200')).live.body as {
      items: { name: string; aliases: string[] }[]
    }
    for (const c of items.slice(0, 40))
      queries.cartridges.push(c.name.slice(1, 5), ...c.aliases.slice(0, 1))
    for (const [kind, qs] of Object.entries(queries))
      for (const q of qs) {
        const { live, file } = await both(`${kind}?q=${encodeURIComponent(q)}&limit=200`)
        expect(file, `${kind} q=${q}`).toEqual(live)
      }
  })

  it('filters bullets and powders by manufacturer as the API does', async () => {
    const { items } = (await both('manufacturers')).live.body as { items: { id: string }[] }
    for (const kind of ['bullets', 'powders', 'cases', 'primers'])
      for (const { id } of items) {
        const { live, file } = await both(`${kind}?manufacturer=${id}&limit=200`)
        expect(file, `${kind} ${id}`).toEqual(live)
      }
  })

  it('ranks a query in any word order the same, as the API does', async () => {
    for (const [kind, words] of [
      ['cartridges', ['win', '308']],
      ['cartridges', ['7.62', 'x51']],
      ['bullets', ['demo', '168']],
      ['powders', ['powder', 'dp40']],
    ] as const) {
      const forward = await both(`${kind}?q=${words.join('%20')}&limit=200`)
      const backward = await both(`${kind}?q=${[...words].reverse().join('%20')}&limit=200`)
      expect(forward.file, kind).toEqual(forward.live)
      expect(backward.file, kind).toEqual(backward.live)
      expect(forward.file.body.items.length, kind).toBeGreaterThan(0)
      expect(forward.file.body, kind).toEqual(backward.file.body)
    }
  })

  it('lists every kind in the order of its sort key, as the API does', async () => {
    for (const kind of ['cartridges', 'bullets', 'powders', 'manufacturers']) {
      const { live, file } = await both(paged.includes(kind) ? `${kind}?limit=200` : kind)
      expect(
        file.body.items.map((i: { id: string }) => i.id),
        kind,
      ).toEqual(live.body.items.map((i: { id: string }) => i.id))
    }
    const { items } = (await both('cartridges?limit=200')).file.body as {
      items: { name: string; id: string }[]
    }
    const keys = items.map((c) => sortKey(c.name))
    expect(keys).toEqual(keys.toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0)))
  })

  it('filters cartridges by table, disciplines by federation and target mappings by discipline and face', async () => {
    const tables = new Set(
      ((await both('cartridges?limit=200')).live.body.items as { table: string }[]).map(
        (c) => c.table,
      ),
    )
    for (const table of [...tables, 'XX']) {
      const { live, file } = await both(`cartridges?table=${table}&limit=200`)
      expect(file, table).toEqual(live)
    }
    const federations = (await both('federations')).live.body.items as { id: string }[]
    for (const { id } of [...federations, { id: 'unknown' }]) {
      const { live, file } = await both(`disciplines?federation=${id}`)
      expect(file, id).toEqual(live)
    }
    const mappings = (await both('target-mappings')).live.body.items as {
      discipline: string
      face: string
    }[]
    for (const m of mappings.slice(0, 20))
      for (const query of [`discipline=${m.discipline}`, `face=${m.face}`, `both`]) {
        const q = query === 'both' ? `discipline=${m.discipline}&face=${m.face}` : query
        const { live, file } = await both(`target-mappings?${q}`)
        expect(file, q).toEqual(live)
      }
  })

  it('keeps the bullets that fit each cartridge as the API does', async () => {
    const { items } = (await both('cartridges?limit=200')).live.body as {
      total: number
      items: { id: string }[]
    }
    for (const { id } of items) {
      const { live, file } = await both(`bullets?cartridge=${id}&limit=200`)
      expect(file, id).toEqual(live)
    }
  })

  it('keeps the cases of one cartridge as the API does', async () => {
    for (const id of ['308-win', 'no-such-cartridge']) {
      const { live, file } = await both(`cases?cartridge=${id}&limit=200`)
      expect(file, id).toEqual(live)
    }
    expect(((await both('cases?cartridge=308-win')).file.body.items as unknown[]).length).toBe(1)
  })

  it('keeps the primers of one size and compound as the API does', async () => {
    for (const query of [
      'size=small-pistol',
      'compound=lead-free',
      'size=large-rifle&compound=lead-free',
    ])
      expect((await both(`primers?${query}`)).file, query).toEqual(
        (await both(`primers?${query}`)).live,
      )
    expect(((await both('primers?size=small-pistol')).file.body.items as unknown[]).length).toBe(1)
  })

  it('answers a record, an unknown id with 404 and a malformed one with 400', async () => {
    for (const kind of kinds) {
      const first = (await both(kind)).live.body.items[0] as { id: string }
      const { live, file } = await both(`${kind}/${first.id}`)
      expect(file, kind).toEqual(live)
    }
    const unknown = await both('cartridges/does-not-exist')
    expect([unknown.live.status, unknown.file.status]).toEqual([404, 404])
    const malformed = await both('cartridges/Not_An_Id')
    expect([malformed.live.status, malformed.file.status]).toEqual([400, 400])
  })

  it('refuses the query values the API refuses', async () => {
    for (const query of [
      'cartridges?q=',
      'cartridges?limit=0',
      'cartridges?limit=201',
      'powders?cartridge=308-win',
      'manufacturers?limit=0',
      'bullets?cartridge=..%2F..%2Fx',
      'bullets?manufacturer=Not_An_Id',
      'powders?manufacturer=Not_An_Id',
      'cases?cartridge=Not_An_Id',
      'cases?manufacturer=Not_An_Id',
      'primers?manufacturer=Not_An_Id',
      'primers?size=medium',
      'primers?compound=mercury',
      'cartridges?table=',
      'cartridges?table=toolongvalue',
      'disciplines?federation=Not_An_Id',
      'target-mappings?face=Not_An_Id',
      'target-mappings?discipline=Not_An_Id',
      'cartridges?tabel=I',
      'bullets?cartridges=308-win',
      'disciplines?federaton=x',
      'federations?x=1',
      'cartridges?q=%01',
      'bullets?q=a%01b',
    ]) {
      const { live, file } = await both(query)
      expect([file.status, query]).toEqual([live.status, query])
    }
  })
})

describe('the data files of the static site', () => {
  it('are the catalogue index and one file per record, no list, search or per-cartridge file', async () => {
    const files = await readdir(dir, { recursive: true })
    expect(files).toContain(path.join('catalogue', 'index.json'))
    expect(files).toContain(path.join('cartridges', '308-win.json'))
    expect(files.filter((f) => /search\.json$|(^|\/)index\.json$/.test(f))).toEqual([
      path.join('catalogue', 'index.json'),
    ])
    expect(files.some((f) => f.startsWith(path.join('bullets', 'cartridge')))).toBe(false)
  })
})

describe('the static site computes as the API', () => {
  const interior = interiorExample as unknown as Record<string, unknown>

  it('answers an interior run, a ladder and a cartridge limit check with the API body', async () => {
    const bodies = [
      interior,
      { ...interior, ladder: { chargeStep: 0.00005, stepCount: 5 } },
      { ...interior, cartridge: '308-win' },
    ]
    for (const body of bodies) {
      const { live, file } = await both('interior', body)
      expect(live.status).toBe(200)
      expect(file).toEqual(live)
    }
  })

  it('answers the charge for a target with the API body', async () => {
    const { live, file } = await both('interior/charge-target', chargeTargetExample)
    expect(live.status).toBe(200)
    expect(file).toEqual(live)
  })

  it('refuses an invalid body (400), an unknown cartridge or powder (404) as the API', async () => {
    const cases: [string, object][] = [
      ['interior', {}],
      ['interior', { ...interior, cartridge: 'does-not-exist' }],
      ['interior/charge-target', { ...chargeTargetExample, powder: 'does-not-exist' }],
    ]
    for (const [p, body] of cases) {
      const { live, file } = await both(p, body)
      expect(file, p).toEqual(live)
    }
  })

  it('answers 503 timeout with the notice when a task passes the deadline', async () => {
    vi.stubGlobal(
      'Worker',
      class {
        postMessage() {}
        terminate() {}
      },
    )
    vi.useFakeTimers()
    try {
      const res = staticFetch('interior', { method: 'POST', body: JSON.stringify(interior) })
      await vi.advanceTimersByTimeAsync(5000)
      const answer = await res
      expect(answer.status).toBe(503)
      expect(await answer.json()).toEqual({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'computation did not finish within 5000 ms',
        reason: 'timeout',
        notice: 'simulation, not load data',
      })
    } finally {
      vi.useRealTimers()
      vi.stubGlobal('Worker', InlineWorker)
    }
  })

  it('fails as an unreachable API when a record file cannot be fetched (offline, not cached)', async () => {
    const online = globalThis.fetch
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')))
    try {
      const res = staticFetch('interior', {
        method: 'POST',
        body: JSON.stringify({ ...interior, cartridge: '223-rem' }),
      })
      await expect(res).rejects.toThrow(/\.json not read/)
    } finally {
      vi.stubGlobal('fetch', online)
    }
  })

  it('settles a record read when its signal aborts while the data file is pending', async () => {
    const online = globalThis.fetch
    vi.stubGlobal('fetch', () => new Promise<Response>(() => {}))
    try {
      const abort = new AbortController()
      const read = staticFetch('powders/stalled-powder', { signal: abort.signal })
      const outcome = expect(read).rejects.toMatchObject({ name: 'AbortError' })
      abort.abort()
      await outcome
    } finally {
      vi.stubGlobal('fetch', online)
    }
  })

  it('leaves no abort listener on a signal after the call settles', async () => {
    const abort = new AbortController()
    const added = vi.spyOn(abort.signal, 'addEventListener')
    const removed = vi.spyOn(abort.signal, 'removeEventListener')
    const res = await staticFetch('interior', {
      method: 'POST',
      body: 'x'.repeat(64 * 1024 + 1),
      signal: abort.signal,
    })
    expect(res.status).toBe(413)
    expect(added).toHaveBeenCalledTimes(1)
    expect(removed).toHaveBeenCalledWith('abort', added.mock.calls[0]?.[1])
  })

  it('refuses a body above 64 KiB with 413', async () => {
    const res = await staticFetch('interior', { method: 'POST', body: 'x'.repeat(64 * 1024 + 1) })
    expect(res.status).toBe(413)
  })
})
