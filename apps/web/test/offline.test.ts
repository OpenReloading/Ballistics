import { readdirSync, readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import {
  appUrl,
  editionName,
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
        recordsCache(),
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

it('keeps the caches of the next edition apart from the stable edition, which shares its origin', () => {
  expect(editionName('', 'units')).toBe('units')
  expect(editionName('next', 'units')).toBe('next:units')
  expect(shellCache('abc', 'next')).toBe('next:openreloading-shell-abc')
  expect(recordsCache('next')).toBe('next:openreloading-records')
  const stable = [shellCache('a'), shellCache('b'), recordsCache()]
  const next = [shellCache('a', 'next'), shellCache('b', 'next'), recordsCache('next')]
  // a worker deletes only the shells of its own edition
  expect(staleCaches([...stable, ...next, shellCache('c')], 'c')).toEqual([shellCache('a')])
  expect(staleCaches([...stable, ...next, shellCache('c', 'next')], 'c', 'next')).toEqual([
    shellCache('a', 'next'),
  ])
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
    '/api/catalogue/index.json',
  ])
})

it('precaches the catalogue index, and answers it from the shell cache', () => {
  expect(precacheList(['chunks/a.js'], '/OpenReloading')).toEqual([
    '/OpenReloading/_next/static/chunks/a.js',
    '/OpenReloading/api/catalogue/index.json',
  ])
  expect(precacheList([])).toEqual(['/api/catalogue/index.json'])
  const index = req('/OpenReloading/api/catalogue/index.json')
  expect(strategyOf(index, origin, '/OpenReloading')).toBe('static')
  expect(
    strategyOf(req('/OpenReloading/api/cartridges/308-win.json'), origin, '/OpenReloading'),
  ).toBe('records')
})

// page routes the shell leaves out on purpose: `/my-cases` only redirects
const notPrecached = ['/my-cases']

it('the shell holds every page route but the record pages, the manifest and its icons', () => {
  const app = new URL('../src/app/', import.meta.url)
  const routes = readdirSync(app, { recursive: true, encoding: 'utf8' })
    .filter((f) => /(^|\/)page\.tsx$/.test(f) && !f.includes('['))
    .map((f) => `/${f.replace(/\/?page\.tsx$/, '')}`)
  expect(routes).toContain('/powders/tune')
  // every page route without a `[...]` segment is in both the full and the sample export, so
  // `cache.addAll` finds each shell page
  expect([...shellPages].sort()).toEqual(routes.filter((r) => !notPrecached.includes(r)).sort())
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

it('leaves other methods and other origins to the network', () => {
  expect(strategyOf(req('/api/bullets', { method: 'POST' }), origin)).toBeUndefined()
  expect(strategyOf(req('/groups', { method: 'POST', mode: 'navigate' }), origin)).toBeUndefined()
  expect(strategyOf(req('https://other.test/_next/static/a.js'), origin)).toBeUndefined()
  expect(strategyOf(req('/sw.js'), origin)).toBeUndefined()
})

it('serves under the base path and leaves the docs site to the network', () => {
  const base = '/OpenReloading'
  expect(appUrl(base, '/', '/')).toBe('/OpenReloading/')
  expect(appUrl(base, '/workbench', '/')).toBe('/OpenReloading/workbench/')
  expect(appUrl(base, '/icon.png')).toBe('/OpenReloading/icon.png')
  expect(appUrl('', '/workbench')).toBe('/workbench')
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
  expect(strategyOf(req('/other/', { mode: 'navigate' }), origin, base)).toBeUndefined()
})

it('the stable edition leaves the next edition under <base>/next/ to its own worker', () => {
  const base = '/OpenReloading'
  const next = req('/OpenReloading/next/workbench/', { mode: 'navigate' })
  expect(strategyOf(next, origin, base)).toBeUndefined()
  expect(
    strategyOf(req('/OpenReloading/next/_next/static/chunks/a.js'), origin, base),
  ).toBeUndefined()
  expect(
    strategyOf(req('/OpenReloading/next/api/cartridges/308-win.json'), origin, base),
  ).toBeUndefined()
  // the next edition's own worker serves its pages under its base
  expect(strategyOf(next, origin, '/OpenReloading/next')).toBe('page')
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

it('a worker update deletes shell caches only and its source never opens the browser store', () => {
  // the records cache and unknown caches stay; entered data lives in IndexedDB, which no cache name reaches
  const names = [shellCache('a'), recordsCache(), 'openreloading-user-data', shellCache('b')]
  expect(staleCaches(names, 'b')).toEqual([])
  expect(staleCaches([...names, shellCache('c')], 'c')).toEqual([shellCache('a')])
  const source = readFileSync(new URL('../src/service-worker.js', import.meta.url), 'utf8')
  expect(source.replace(/^\s*\/\/.*$/gm, '')).not.toMatch(/indexedDB|openreloading-user-data/)
})
