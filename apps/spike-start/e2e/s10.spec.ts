// Needs site/, site-b/next and today's next export in ../../pages (RESULTS-S10.md); --workers 1: tests swap /next/
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { type APIRequestContext, expect, type Page, test } from '@playwright/test'

type Report = {
  count: number
  raw: number
  gzip: number
  budget: number
  workerMentionsIndexedDB: boolean
  entries: { url: string; revision: string | null; raw: number; gzip: number }[]
}
const report = (site: string, edition: string): Report =>
  JSON.parse(readFileSync(`generated/precache-${site}-${edition}.json`, 'utf8'))
const hashed = /^assets\/.+-[\w-]{8}\.\w+$/
const origin = 'http://localhost:3043'
const editions = [
  { base: '/', folder: 'site', edition: 'stable', prefix: '' },
  { base: '/next/', folder: 'site/next', edition: 'next', prefix: 'next:' },
]

/** Serves `dir` (relative to the app folder) under /next/, as a new deploy of that edition. */
const serveNext = (request: APIRequestContext, dir = 'site/next') =>
  request.put(`/__next?dir=${encodeURIComponent(dir)}`)

/** The registration whose scope is exactly `base` (getRegistration(url) answers the longest match). */
const registration = (page: Page, base: string) =>
  page.evaluate(async (b) => {
    const r = (await navigator.serviceWorker.getRegistrations()).find(
      (x) => new URL(x.scope).pathname === b,
    )
    return (
      r && { active: r.active?.state, waiting: r.waiting?.state, installing: r.installing?.state }
    )
  }, base)

const waitActive = (page: Page, base: string) =>
  expect.poll(async () => (await registration(page, base))?.active).toBe('activated')
const waitControlled = (page: Page, base: string) =>
  expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL))
    .toBe(`${origin}${base}sw.js`)
const update = (page: Page, base: string) =>
  page.evaluate(async (b) => {
    const r = (await navigator.serviceWorker.getRegistrations()).find(
      (x) => new URL(x.scope).pathname === b,
    )
    await r?.update()
  }, base)
/** The entry script of a Start page: names the build that rendered it. */
const entry = (page: Page) =>
  page
    .locator('script[type="module"][src*="/assets/index-"]')
    .getAttribute('src')
    .then((s) => s?.replace(/^.*\/assets\//, 'assets/'))
const entryOf = (r: Report) => r.entries.find((e) => /^assets\/index-/.test(e.url))?.url
const hydrated = (page: Page) => expect(page.locator('html[data-hydrated]')).toBeAttached()
/** Main-frame document loads from now on, to tell one reload from a loop (`framenavigated` also counts the router's history updates). */
const navigations = (page: Page) => {
  const seen: string[] = []
  page.on('request', (r) => {
    if (r.isNavigationRequest() && r.frame() === page.mainFrame()) seen.push(r.url())
  })
  return seen
}

test.beforeEach(async ({ request }) => {
  await serveNext(request)
})

test('S10 precache: every entry revisioned or hashed; build B changes only changed files', () => {
  for (const site of ['site', 'site-b'])
    for (const edition of site === 'site' ? ['stable', 'next'] : ['next'])
      for (const e of report(site, edition).entries)
        expect(e.revision !== null || hashed.test(e.url), `${site} ${edition} ${e.url}`).toBe(true)
  const a = report('site', 'next')
  const b = report('site-b', 'next')
  const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex')
  const changed: string[] = []
  for (const e of a.entries) {
    const same = b.entries.find((x) => x.url === e.url)
    const bytesSame = same && digest(`site/next/${e.url}`) === digest(`site-b/next/${e.url}`)
    // a kept entry keeps its revision exactly when its bytes are unchanged
    if (same) expect(same.revision === e.revision, e.url).toBe(Boolean(bytesSame))
    if (!same || !bytesSame) changed.push(e.url)
  }
  const stem = (u: string) => u.replace(/-[\w-]{8}\.js$/, '.js')
  test.info().annotations.push({ type: 'changed in build B', description: changed.join(', ') })
  // workbench.tsx changed: its route chunk is not precached; the entry imports it by hashed name, the home chunk imports the entry
  expect(changed.map(stem).sort()).toEqual([
    '_shell.html',
    'assets/index.js',
    'assets/routes.js',
    'index.html',
  ])
})

test('S10 budget: each edition within 1,500,000 bytes gzip level 9', () => {
  for (const edition of ['stable', 'next']) {
    const r = report('site', edition)
    test.info().annotations.push({
      type: `precache ${edition}`,
      description: `${r.count} entries, ${r.raw} raw, ${r.gzip} gzip 9`,
    })
    expect(r.gzip).toBeLessThanOrEqual(1_500_000)
  }
})

test('S10 cache names: next: prefix for the next worker only, none of the shell prefix', async ({
  page,
}) => {
  await page.goto('/')
  await waitActive(page, '/')
  const stable = await page.evaluate(() => caches.keys())
  expect(stable.length).toBeGreaterThan(0)
  expect(
    stable.filter((n) => n.startsWith('next:') || n.startsWith('openreloading-shell-')),
  ).toEqual([])
  await page.goto('/next/')
  await waitActive(page, '/next/')
  const all = await page.evaluate(() => caches.keys())
  const added = all.filter((n) => !stable.includes(n))
  expect(added.length).toBeGreaterThan(0)
  expect(
    added.filter((n) => !n.startsWith('next:') || n.startsWith('next:openreloading-shell-')),
  ).toEqual([])
  // the precache holds exactly the injected list
  const urls = await page.evaluate(async (name) => {
    const keys = await (await caches.open(name)).keys()
    return keys.map((k) => new URL(k.url).pathname.replace(/^\/next\//, '')).sort()
  }, 'next:openreloading-app-precache')
  expect(urls).toEqual(
    report('site', 'next')
      .entries.map((e) => e.url)
      .sort(),
  )
  test.info().annotations.push({ type: 'caches', description: all.join(', ') })
})

test('S10 update waits for the user across a reload and a second tab, then one reload', async ({
  page,
  context,
  request,
  browserName,
}) => {
  const a = entryOf(report('site', 'next'))
  const b = entryOf(report('site-b', 'next'))
  await page.goto('/next/')
  await waitActive(page, '/next/')
  await waitControlled(page, '/next/')
  expect(await entry(page)).toBe(a)
  await serveNext(request, 'site-b/next')
  await update(page, '/next/')
  await expect.poll(async () => (await registration(page, '/next/'))?.waiting).toBe('installed')
  await page.reload()
  await hydrated(page)
  expect(await registration(page, '/next/')).toMatchObject({
    active: 'activated',
    waiting: 'installed',
  })
  expect(await entry(page)).toBe(a)
  const second = await context.newPage()
  await second.goto('/next/')
  await hydrated(second)
  expect(await registration(second, '/next/')).toMatchObject({ waiting: 'installed' })
  expect(await entry(second)).toBe(a)
  await second.close()
  const seen = navigations(page)
  await page.locator('.update-notice').getByRole('button', { name: 'Reload' }).click()
  await expect.poll(() => entry(page)).toBe(b)
  await hydrated(page)
  await page.waitForTimeout(3000)
  expect(seen).toHaveLength(1)
  expect((await registration(page, '/next/'))?.waiting).toBeUndefined()
  // no IndexedDB after install, activation, the update and an offline reload
  await context.setOffline(true)
  await page.reload()
  await hydrated(page)
  expect(await entry(page)).toBe(b)
  // after the reload: WebKit leaves the earlier page's worker object at 'activating'
  await waitActive(page, '/next/')
  await context.setOffline(false)
  for (const base of ['/', '/next/']) {
    await page.goto(base)
    await hydrated(page)
    if (browserName !== 'webkit' || (await page.evaluate(() => 'databases' in indexedDB)))
      expect(await page.evaluate(() => indexedDB.databases())).toEqual([])
  }
  test.info().annotations.push({
    type: 'worker file mentions indexedDB',
    description: String(report('site', 'next').workerMentionsIndexedDB),
  })
})

for (const { base, folder } of editions)
  test(`S10 offline ${base}: home, shell-answered workbench, record pages, record index`, async ({
    page,
    context,
    browserName,
  }) => {
    // measured: offline, the Firefox worker still fetched an uncached page from the network
    test.skip(browserName === 'firefox', 'offline emulation does not reach the worker in Firefox')
    const cartridge = JSON.parse(readFileSync('public/api/cartridges/308-win.json', 'utf8')).name
    const bullet = JSON.parse(readFileSync('public/api/bullets/demo-bullet-150.json', 'utf8')).name
    // the online visit: home, a record and the workbench through links, a record page opened directly
    await page.goto(base)
    await waitActive(page, base)
    await waitControlled(page, base)
    await page.getByRole('link', { name: '308 Win.' }).click()
    await expect(page.locator('h1')).toHaveText(cartridge)
    await page.getByRole('link', { name: 'Workbench' }).click()
    await expect(page.locator('h1')).toHaveText('Load workbench')
    await page.goto(`${base}bullets/demo-bullet-150/`)
    await expect(page.locator('h1')).toHaveText(bullet)
    await page.goto(base)
    await hydrated(page)

    await context.setOffline(true)
    await page.reload()
    await hydrated(page)
    await expect(page.locator('h1')).toHaveText('Ballistics')
    const shell = await page.goto(`${base}workbench/`)
    expect(await shell?.text()).toBe(readFileSync(`${folder}/_shell.html`, 'utf8'))
    await hydrated(page)
    await expect(page.locator('h1')).toHaveText('Load workbench')
    await page.reload()
    await expect(page.locator('h1')).toHaveText('Load workbench')
    await page.goto(`${base}bullets/demo-bullet-150/`)
    await expect(page.locator('h1')).toHaveText(bullet)
    await page.reload()
    await expect(page.locator('h1')).toHaveText(bullet)
    await page.goto(`${base}cartridges/308-win/`)
    await expect(page.locator('h1')).toHaveText(cartridge)
    const index = await page.evaluate(async (b) => {
      const r = await fetch(`${b}api/catalogue/index.json`)
      return { ok: r.ok, cartridges: Array.isArray((await r.json()).cartridges) }
    }, base)
    expect(index).toEqual({ ok: true, cartridges: true })
    await context.setOffline(false)
  })

test('S10 editions: the stable worker leaves /next/ and /docs/ to the network', async ({
  page,
}) => {
  await page.goto('/')
  await waitActive(page, '/')
  await waitControlled(page, '/')
  const answered: string[] = []
  page.on('response', (r) => {
    if (r.fromServiceWorker()) answered.push(new URL(r.url()).pathname)
  })
  for (const path of ['/next/api/catalogue/index.json', '/docs/', '/next/'])
    await page.evaluate((p) => fetch(p).then((r) => r.status), path)
  // a /next/ page before its own worker: controlled by the stable one, which answers none of its requests
  await page.goto('/next/', { waitUntil: 'load' })
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toBe(
    `${origin}/sw.js`,
  )
  expect(answered.filter((p) => p.startsWith('/next/') || p.startsWith('/docs/'))).toEqual([])
})

test('S10 editions: the next worker sees no request outside /next/', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'service worker handles: Chromium only in Playwright')
  await page.goto('/')
  await waitActive(page, '/')
  await page.goto('/next/')
  await waitActive(page, '/next/')
  await waitControlled(page, '/next/')
  const worker = context.serviceWorkers().find((w) => w.url() === `${origin}/next/sw.js`)
  if (!worker) throw new Error('no /next/ worker handle')
  // a fetch listener added now is never called: record every fetch event whose request Serwist's listener reads
  await worker.evaluate(() => {
    const g = self as unknown as { seen: string[]; FetchEvent: { prototype: object } }
    g.seen = []
    const proto = g.FetchEvent.prototype
    const get = Object.getOwnPropertyDescriptor(proto, 'request')?.get
    Object.defineProperty(proto, 'request', {
      get() {
        const r = get?.call(this) as Request
        g.seen.push(r.url)
        return r
      },
    })
  })
  await page.goto('/next/')
  await page.getByRole('link', { name: '308 Win.' }).click()
  await page.getByRole('link', { name: 'Workbench' }).click()
  await page.goto('/next/bullets/demo-bullet-150/')
  await hydrated(page)
  const seen = await worker.evaluate(() => (self as unknown as { seen: string[] }).seen)
  expect(seen.length).toBeGreaterThan(0)
  expect(seen.filter((u) => !u.startsWith(`${origin}/next/`))).toEqual([])
  // a request outside its folder from one of its pages reaches it, and it leaves that to the network
  const outside = await page.evaluate(() => fetch('/api/catalogue/index.json').then((r) => r.ok))
  expect(outside).toBe(true)
  const late = await worker.evaluate(() => (self as unknown as { seen: string[] }).seen)
  test.info().annotations.push({
    type: 'outside fetch seen by the next worker',
    description: String(late.some((u) => u === `${origin}/api/catalogue/index.json`)),
  })
})

test('S10 handover: today worker to Serwist and back on one profile', async ({
  playwright,
  browserName,
  request,
}, info) => {
  test.skip(browserName === 'firefox', 'offline emulation does not reach the worker in Firefox')
  test.setTimeout(180_000)
  const context = await playwright[browserName].launchPersistentContext(
    info.outputPath('profile'),
    {
      baseURL: origin,
      serviceWorkers: 'allow',
    },
  )
  // today's Safety dialog, accepted (apps/e2e/tests/web/nav.ts): its overlay would cover today's update notice
  await context.addInitScript(() => localStorage.setItem('next:safety-ack', '3'))
  const page = context.pages()[0] ?? (await context.newPage())
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const today = () =>
    expect(page.locator('script[src*="/next/_next/static/"]').first()).toBeAttached()
  // both apps render an h1 on every page; the body's text would also count inline scripts
  const notBlank = async () =>
    expect
      .poll(() =>
        page.evaluate(() => document.querySelector('h1')?.textContent?.trim().length ?? 0),
      )
      .toBeGreaterThan(0)
  const userDb = (op: 'put' | 'get') =>
    page.evaluate(
      (op) =>
        new Promise<unknown>((resolve, reject) => {
          // version 1 with the stores of apps/web/src/lib/user-db.ts, so a new database matches today's schema
          const r = indexedDB.open('next:openreloading-user-data', 1)
          r.onupgradeneeded = () => {
            r.result.createObjectStore('records', { keyPath: 'id' })
            r.result.createObjectStore('handles')
            r.result.createObjectStore('files')
          }
          r.onerror = () => reject(r.error)
          r.onsuccess = () => {
            const tx = r.result.transaction('records', op === 'put' ? 'readwrite' : 'readonly')
            const store = tx.objectStore('records')
            const q =
              op === 'put'
                ? store.put({ id: 's10-handover', name: 'S10 handover' })
                : store.get('s10-handover')
            q.onsuccess = () =>
              (tx.oncomplete = () => {
                r.result.close()
                resolve(q.result)
              })
            q.onerror = () => reject(q.error)
          }
        }),
      op,
    )
  const reloadOnce = async (click: () => Promise<void>, landed: () => Promise<void>) => {
    const seen = navigations(page)
    await click()
    await landed()
    await page.waitForTimeout(3000)
    expect(seen).toHaveLength(1)
    await notBlank()
  }

  let todayCaches: string[] = []
  let startCaches: string[] = []
  // (1) today's worker controls /next/, a record in today's database
  await test.step('1 today', async () => {
    await serveNext(request, '../../pages')
    await page.goto('/next/')
    await today()
    await waitActive(page, '/next/')
    await waitControlled(page, '/next/')
    await notBlank()
    await userDb('put')
    todayCaches = await page.evaluate(() => caches.keys())
    expect(todayCaches.some((n) => n.startsWith('next:openreloading-shell-'))).toBe(true)
  })

  // (2) the Serwist build is deployed: it waits, today's notice confirms, the page reloads onto Start
  await test.step('2 Serwist', async () => {
    await serveNext(request, 'site/next')
    await update(page, '/next/')
    await expect.poll(async () => (await registration(page, '/next/'))?.waiting).toBe('installed')
    await expect(page.locator('.update-notice')).toBeVisible()
    await reloadOnce(
      () => page.locator('.update-notice').getByRole('button', { name: 'Reload' }).click(),
      () => expect.poll(() => entry(page)).toBe(entryOf(report('site', 'next'))),
    )
    await hydrated(page)
    startCaches = await page.evaluate(() => caches.keys())
    for (const n of todayCaches) expect(startCaches).toContain(n)
    expect(
      await page.evaluate(() => indexedDB.databases().then((d) => d.map((x) => x.name))),
    ).toContain('next:openreloading-user-data')
    await context.setOffline(true)
    await page.reload()
    await hydrated(page)
    await expect(page.locator('h1')).toHaveText('Ballistics')
    await context.setOffline(false)
  })

  // (3) today's build is deployed again: it waits, the spike notice confirms, the page reloads onto today's app
  await test.step('3 today again', async () => {
    await serveNext(request, '../../pages')
    await update(page, '/next/')
    await expect
      .poll(async () => (await registration(page, '/next/'))?.waiting, { timeout: 60_000 })
      .toBe('installed')
    await expect(page.locator('.update-notice')).toBeVisible()
    await reloadOnce(
      () => page.locator('.update-notice').getByRole('button', { name: 'Reload' }).click(),
      today,
    )
    const backCaches = await page.evaluate(() => caches.keys())
    for (const n of startCaches) expect(backCaches).toContain(n)
    expect(await userDb('get')).toEqual({ id: 's10-handover', name: 'S10 handover' })
    info.annotations.push({ type: 'caches after step 3', description: backCaches.join(', ') })
  })
  info.annotations.push({ type: 'page errors', description: errors.join(' | ') || 'none' })
  await context.close()
})
