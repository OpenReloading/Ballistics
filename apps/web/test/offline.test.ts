import { expect, it } from 'vitest'
import {
  appUrl,
  networkOr,
  pageKey,
  precacheList,
  recordsCache,
  shellAnswer,
  shellCache,
  shellFiles,
  shellPages,
  staleCaches,
  strategyOf,
} from '../src/lib/offline.ts'

const origin = 'https://example.test'
const req = (
  url: string,
  init: { method?: string | undefined; mode?: string | undefined; headers?: object } = {},
) => ({
  method: init.method ?? 'GET',
  url: new URL(url, origin).href,
  mode: init.mode ?? 'cors',
  headers: new Headers(init.headers as Record<string, string>),
})

it('names one shell cache per build and keeps the records cache across builds', () => {
  expect(shellCache('abc')).toBe('openreloading-shell-abc')
  expect(shellCache('abc')).not.toBe(shellCache('def'))
  // names in creation order: the newest other shell stays for tabs still on that build
  expect(
    staleCaches(
      [
        shellCache('a'),
        shellCache('b'),
        recordsCache,
        'other-app',
        shellCache('c'),
        shellCache('new'),
      ],
      'new',
    ),
  ).toEqual([shellCache('a'), shellCache('b')])
  expect(staleCaches([shellCache('old'), shellCache('new')], 'new')).toEqual([])
  expect(staleCaches([shellCache('new')], 'new')).toEqual([])
})

it('keeps the preview worker from deleting the released site shells, and the reverse', () => {
  expect(shellCache('abc', 'preview-')).toBe('openreloading-preview-shell-abc')
  const names = [
    shellCache('a'),
    shellCache('p1', 'preview-'),
    shellCache('b'),
    shellCache('p2', 'preview-'),
  ]
  expect(staleCaches(names, 'new', 'preview-')).toEqual([shellCache('p1', 'preview-')])
  expect(staleCaches([...names, shellCache('new')], 'new')).toEqual([shellCache('a')])
})

it('answers from the network, else from the cached copy on a failure, a server error or a stall', async () => {
  const net = { status: 200 }
  const copy = { status: 200 }
  expect(await networkOr(Promise.resolve(net), copy, 50)).toBe(net)
  expect(await networkOr(Promise.resolve({ status: 404 }), copy, 50)).toEqual({ status: 404 })
  expect(await networkOr(Promise.reject(new Error('offline')), copy, 50)).toBe(copy)
  expect(await networkOr(Promise.resolve({ status: 502 }), copy, 50)).toBe(copy)
  expect(await networkOr(new Promise<typeof net>(() => {}), copy, 50)).toBe(copy)
  // without a copy: the network's answer or failure
  expect(await networkOr(Promise.resolve({ status: 502 }), undefined, 50)).toEqual({ status: 502 })
  await expect(networkOr(Promise.reject(new Error('offline')), undefined, 50)).rejects.toThrow()
})

it('precaches the static output as /_next/static URLs, sorted, without maps', () => {
  expect(
    precacheList([
      'chunks/b.js',
      'chunks/a.css',
      'chunks/a.js.map',
      'media/Inter_Regular.woff2',
      'media/icon.0x.png',
      'c0zQ/_buildManifest.js',
    ]),
  ).toEqual([
    '/_next/static/c0zQ/_buildManifest.js',
    '/_next/static/chunks/a.css',
    '/_next/static/chunks/b.js',
    '/_next/static/media/Inter_Regular.woff2',
    '/_next/static/media/icon.0x.png',
  ])
})

it('precaches the catalogue index in the Pages edition only, and answers it from the shell cache', () => {
  expect(precacheList(['chunks/a.js'])).toEqual(['/_next/static/chunks/a.js'])
  expect(precacheList(['chunks/a.js'], '/OpenReloading', true)).toEqual([
    '/OpenReloading/_next/static/chunks/a.js',
    '/OpenReloading/api/catalogue/index.json',
  ])
  expect(precacheList([], '', true)).toEqual(['/api/catalogue/index.json'])
  const index = req('/OpenReloading/api/catalogue/index.json')
  expect(strategyOf(index, origin, '/OpenReloading')).toBe('static')
  expect(
    strategyOf(req('/OpenReloading/api/cartridges/308-win.json'), origin, '/OpenReloading'),
  ).toBe('records')
})

it('the shell holds the offline page, the tools, the manifest and its icons', () => {
  for (const u of ['/', '/offline', '/workbench', '/groups', '/session'])
    expect(shellPages).toContain(u)
  for (const u of ['/firearms', '/bullets/designer', '/cartridges/designer'])
    expect(shellPages).toContain(u)
  // Settings is a dialog, no page
  expect(shellPages).not.toContain('/settings')
  for (const u of ['/manifest.webmanifest', '/icon.png', '/icon-192.png'])
    expect(shellFiles).toContain(u)
})

it('answers static files from the cache, records and pages network-first', () => {
  expect(strategyOf(req('/_next/static/chunks/a.js'), origin)).toBe('static')
  expect(strategyOf(req('/icon.png?3a9c'), origin)).toBe('static')
  expect(strategyOf(req('/api/cartridges?limit=200'), origin)).toBe('records')
  expect(strategyOf(req('/api/bullets/x-1', { mode: 'navigate' }), origin)).toBe('records')
  expect(strategyOf(req('/api/manufacturers'), origin)).toBe('records')
  expect(strategyOf(req('/cartridges/308-win', { mode: 'navigate' }), origin)).toBe('page')
  expect(strategyOf(req('/groups', { mode: 'navigate' }), origin)).toBe('page')
})

it('leaves the interior run, other methods and other origins to the network', () => {
  expect(strategyOf(req('/api/interior', { method: 'POST' }), origin)).toBeUndefined()
  expect(strategyOf(req('/groups', { method: 'POST', mode: 'navigate' }), origin)).toBeUndefined()
  expect(strategyOf(req('https://other.test/_next/static/a.js'), origin)).toBeUndefined()
  expect(strategyOf(req('/sw.js'), origin)).toBeUndefined()
})

it('in the Pages edition, serves under the base path and leaves the docs site to the network', () => {
  const base = '/OpenReloading'
  expect(appUrl(base, '/', '/')).toBe('/OpenReloading/')
  expect(appUrl(base, '/workbench', '/')).toBe('/OpenReloading/workbench/')
  expect(appUrl(base, '/icon.png')).toBe('/OpenReloading/icon.png')
  expect(appUrl('', '/workbench')).toBe('/workbench')
  expect(precacheList(['chunks/a.js'], base)).toEqual(['/OpenReloading/_next/static/chunks/a.js'])
  expect(strategyOf(req('/OpenReloading/_next/static/chunks/a.js'), origin, base)).toBe('static')
  expect(strategyOf(req('/OpenReloading/icon.png'), origin, base)).toBe('static')
  expect(strategyOf(req('/OpenReloading/api/cartridges/308-win.json'), origin, base)).toBe(
    'records',
  )
  expect(strategyOf(req('/OpenReloading/workbench/', { mode: 'navigate' }), origin, base)).toBe(
    'page',
  )
  const docs = req('/OpenReloading/docs/models/', { mode: 'navigate' })
  expect(strategyOf(docs, origin, base)).toBeUndefined()
  // the development preview under /develop/ has a worker of its own
  const preview = req('/OpenReloading/develop/workbench/', { mode: 'navigate' })
  expect(strategyOf(preview, origin, base)).toBeUndefined()
  expect(strategyOf(preview, origin, `${base}/develop`)).toBe('page')
  expect(
    strategyOf(req('/OpenReloading/develop', { mode: 'navigate' }), origin, base),
  ).toBeUndefined()
  expect(strategyOf(req('/other/', { mode: 'navigate' }), origin, base)).toBeUndefined()
})

it('leaves searches (`q`) to the network, so typing does not fill the records cache', () => {
  expect(strategyOf(req('/api/cartridges?q=308&limit=20'), origin)).toBeUndefined()
  expect(strategyOf(req('/api/powders?limit=8&q=n1'), origin)).toBeUndefined()
})

it('a client navigation (RSC, not a prefetch) keeps its page; a prefetch does not', () => {
  expect(strategyOf(req('/cartridges/308-win?_rsc=1x', { headers: { rsc: '1' } }), origin)).toBe(
    'navigation',
  )
  expect(
    strategyOf(
      req('/cartridges/308-win?_rsc=1x', { headers: { rsc: '1', 'next-router-prefetch': '1' } }),
      origin,
    ),
  ).toBeUndefined()
  expect(
    strategyOf(
      req('/cartridges?_rsc=1x', {
        headers: { rsc: '1', 'next-router-segment-prefetch': '/_tree' },
      }),
      origin,
    ),
  ).toBeUndefined()
})

it('the page key drops the RSC parameter and keeps the query', () => {
  expect(pageKey(`${origin}/cartridges/308-win?_rsc=1x`)).toBe('/cartridges/308-win')
  expect(pageKey(`${origin}/workbench?units=metric&_rsc=1x`)).toBe('/workbench?units=metric')
})

it('answers a worker script from the cache with a copy that has no URL of its own', async () => {
  const cached = new Response('postMessage(1)', { headers: { 'content-type': 'text/javascript' } })
  expect(shellAnswer(cached, 'script')).toBe(cached)
  const copy = shellAnswer(cached, 'worker')
  expect(copy).not.toBe(cached)
  expect(copy.url).toBe('')
  expect(copy.status).toBe(200)
  expect(copy.headers.get('content-type')).toBe('text/javascript')
  expect(await copy.text()).toBe('postMessage(1)')
})
