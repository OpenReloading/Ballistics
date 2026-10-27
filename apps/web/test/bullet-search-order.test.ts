import { afterEach, expect, it, vi } from 'vitest'
import { paletteSearch } from '../src/components/workbench-search.tsx'
import type { BulletRow } from '../src/lib/bullet-rows.ts'
import { findBullets, searchBullets } from '../src/lib/bullet-search.ts'

// these tests stub `fetch` as the API's own answers: the browser's calls go to it as written, in place of the data files and the compute worker
vi.mock('../src/lib/static-api.ts', () => ({
  staticFetch: (path: string, init?: RequestInit) => fetch(`/api/${path}`, init),
}))

// invented bullets, mass in g and diameter in mm
const bullet = (id: string, name: string, mass: number, origin?: 'user'): BulletRow => ({
  id,
  manufacturer: 'acme',
  manufacturerName: 'Acme Bullets',
  name,
  diameter: 7.823,
  mass,
  length: null,
  ballisticCoefficientG1: null,
  ballisticCoefficientG7: null,
  ...(origin ? { origin } : {}),
})

const catalogue = Array.from({ length: 30 }, (_, i) =>
  bullet(`cat-${i}`, `30 Cal ${150 + i} gr ${i % 3 ? 'Match' : 'Tipped'}`, (150 + i) * 0.06479891),
)
const designs = [
  bullet('user:a', 'My match 168 gr', 10.886, 'user'),
  bullet('user:b', 'Zed tipped', 9, 'user'),
]

const answer = (items: unknown[]) => Response.json({ total: items.length, items }, { status: 200 })

afterEach(() => vi.unstubAllGlobals())

function serve() {
  vi.stubGlobal('fetch', (url: string) => {
    const path = new URL(url, 'http://x').pathname
    if (path.endsWith('/manufacturers'))
      return Promise.resolve(answer([{ id: 'acme', name: 'Acme Bullets', aliases: [] }]))
    if (path.endsWith('/bullets')) return Promise.resolve(answer(catalogue))
    return Promise.resolve(answer([]))
  })
}

const queries = ['match', 'tipped', '168', '168 gr', '308 match', 'acme', 'cal 155']

it('lists the field, the palette and the dialog in the same order for the same query', async () => {
  serve()
  const all = [...designs, ...catalogue]
  const filters = { manufacturer: '', caliber: '', mass: '' }
  for (const q of queries) {
    const dialog = searchBullets(all, q, filters).map((b) => b.id)
    expect(dialog.length, q).toBeGreaterThan(0)
    const field = (await findBullets(designs, q, 20)).items.map((b) => b.id)
    const palette = (await paletteSearch(q, designs, undefined, new AbortController().signal))
      .bullets
    expect(field, q).toEqual(dialog.slice(0, 20))
    expect(
      palette.map((b) => b.id),
      q,
    ).toEqual(dialog.slice(0, 8))
  }
})

it('lists the own bullets in the palette, first among equal matches', async () => {
  serve()
  const found = await paletteSearch('match', designs, undefined, new AbortController().signal)
  expect(found.bullets[0]?.id).toBe('user:a')
  expect(found.bullets.some((b) => b.origin === 'user')).toBe(true)
  expect(
    (await paletteSearch('zed', designs, undefined, new AbortController().signal)).bullets,
  ).toEqual([designs[1]])
})
