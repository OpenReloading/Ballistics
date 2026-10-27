import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ cacheLife: () => {} }))
const { listAllBullets, staticIds } = await import('../src/lib/api.ts')

const offsets: number[] = []

/** A list route of `total` items whose page at `failAt` answers 500. */
function serve(total: number, failAt = -1) {
  vi.stubGlobal('fetch', (url: string) => {
    const offset = Number(new URL(url).searchParams.get('offset'))
    offsets.push(offset)
    if (offset === failAt) return Promise.resolve(new Response('', { status: 500 }))
    const items = Array.from({ length: Math.max(0, Math.min(200, total - offset)) }, (_, i) => ({
      id: `b-${offset + i}`,
    }))
    return Promise.resolve(Response.json({ total, items }))
  })
}

beforeEach(() => {
  offsets.length = 0
  vi.stubEnv('PRERENDER', '')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it('reads pages of 200 until total', async () => {
  serve(1684)
  const r = await listAllBullets()
  expect(offsets).toEqual([0, 200, 400, 600, 800, 1000, 1200, 1400, 1600])
  expect(r.status === 'ok' && new Set(r.data.map((b) => b.id)).size).toBe(1684)
})

it('stops after 50 pages', async () => {
  serve(20_000)
  const r = await listAllBullets()
  expect(offsets).toHaveLength(50)
  expect(r.status === 'ok' && r.data.length).toBe(10_000)
})

it('fails the whole list when one page fails, and so the detail routes of the build', async () => {
  serve(1684, 400)
  await expect(listAllBullets()).rejects.toThrow('API answered 500')
  await expect(staticIds(listAllBullets, 'bullet')).rejects.toThrow('API answered 500')
  serve(2)
  expect(await staticIds(listAllBullets, 'bullet')).toEqual([{ id: 'b-0' }, { id: 'b-1' }])
})

it('cuts the cartridge pages only with PRERENDER=sample', async () => {
  serve(1684)
  vi.stubEnv('PRERENDER', 'sample')
  expect(await staticIds(listAllBullets, 'cartridge')).toEqual([{ id: 'b-0' }])
  expect(await staticIds(listAllBullets, 'bullet')).toHaveLength(1684)
  vi.stubEnv('PRERENDER', 'full')
  expect(await staticIds(listAllBullets, 'cartridge')).toHaveLength(1684)
})
