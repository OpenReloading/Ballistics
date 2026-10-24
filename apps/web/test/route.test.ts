import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '../src/app/api/[...path]/route.server.ts'
import { API_PREFIX } from '../src/lib/api-version.ts'

const context = (path: string[]) => ({ params: Promise.resolve({ path }) })
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.stubEnv('API_URL', 'http://api.test:3000')
  fetchMock = vi.fn(async () => Response.json({ total: 0, items: [] }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('forwarding route', () => {
  it('forwards an allowed GET with its query to API_URL', async () => {
    const res = await GET(new Request('http://web/api/cartridges?q=308'), context(['cartridges']))
    expect(res.status).toBe(200)
    expect(fetchMock.mock.calls[0][0]).toBe(`http://api.test:3000${API_PREFIX}/cartridges?q=308`)
  })

  it.each([
    [
      'the powder list and a powder record for the workbench search',
      ['powders?q=delta', 'powders/charlie-delta-fast'],
    ],
    [
      'the target face list and a face record for ring scoring',
      ['target-faces', 'target-faces/issf-10m-air-rifle'],
    ],
    [
      'the federation, discipline and target mapping lists for ring scoring',
      [
        'federations',
        'disciplines',
        'target-mappings',
        'caliber-classes',
        'disciplines/issf-50m-pistol',
      ],
    ],
    [
      'the manufacturer list and record that label powders and bullets',
      ['manufacturers', 'manufacturers/demo-powder'],
    ],
  ])('forwards %s', async (_, paths) => {
    for (const path of paths)
      await GET(new Request(`http://web/api/${path}`), context(path.split('?')[0].split('/')))
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(
      paths.map((path) => `http://api.test:3000${API_PREFIX}/${path}`),
    )
  })

  it('answers 404 for a path outside the allowlist without contacting the API', async () => {
    const res = await GET(
      new Request('http://web/api/exterior/stability'),
      context(['exterior', 'stability']),
    )
    expect(res.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
    const post = await POST(
      new Request('http://web/api/exterior/trajectory', { method: 'POST', body: '{}' }),
      context(['exterior', 'trajectory']),
    )
    expect(post.status).toBe(404)
  })

  it('returns status, retry-after and body unchanged', async () => {
    const body = JSON.stringify({
      statusCode: 503,
      reason: 'busy',
      notice: 'simulation, not load data',
    })
    fetchMock.mockResolvedValueOnce(
      new Response(body, {
        status: 503,
        headers: { 'content-type': 'application/json', 'retry-after': '5', 'x-other': '1' },
      }),
    )
    const res = await POST(
      new Request('http://web/api/interior', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"model":"m3"}',
      }),
      context(['interior']),
    )
    expect(res.status).toBe(503)
    expect(res.headers.get('retry-after')).toBe('5')
    expect(res.headers.get('content-type')).toBe('application/json')
    expect(res.headers.get('x-other')).toBeNull()
    expect(await res.text()).toBe(body)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`http://api.test:3000${API_PREFIX}/interior`)
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"model":"m3"}')
  })

  it('answers 413 for a body above 64 KiB without contacting the API', async () => {
    const big = (headers: HeadersInit = {}) =>
      new Request('http://web/api/interior', { method: 'POST', headers, body: 'x'.repeat(65537) })
    expect((await POST(big(), context(['interior']))).status).toBe(413)
    const declared = await POST(big({ 'content-length': '65537' }), context(['interior']))
    expect(declared.status).toBe(413)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('answers 502 when the API is unreachable', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    const res = await GET(new Request('http://web/api/bullets/x-1'), context(['bullets', 'x-1']))
    expect(res.status).toBe(502)
    expect((await res.json()).message).toBe('API unreachable')
  })

  it('rejects a segment holding a slash, so the target stays on API_URL', async () => {
    const res = await GET(
      new Request('http://web/api/bullets/a%2F..'),
      context(['bullets', 'a/..']),
    )
    expect(res.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
