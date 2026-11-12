import { readFileSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'

const editions = [
  { base: '/', prefix: '', otherPrefix: 'next:' },
  { base: '/next/', prefix: 'next:', otherPrefix: '' },
]
const records = [
  'cartridges/308-win/',
  'bullets/demo-bullet-150/',
  'disciplines/bdmp-1500-carbine/',
]

/** Waits until the registration whose scope is exactly `base` is active (getRegistration(url) answers the longest match). */
const waitActive = (page: Page, base: string) =>
  expect
    .poll(() =>
      page.evaluate(async (b) => {
        const all = await navigator.serviceWorker.getRegistrations()
        return all.some((r) => new URL(r.scope).pathname === b && r.active?.state === 'activated')
      }, base),
    )
    .toBe(true)

for (const { base } of editions) {
  test(`S2 ${base} prerendered home and sitemap entry`, async ({ request }) => {
    const home = await request.get(base)
    expect(home.status()).toBe(200)
    expect(await home.text()).toContain('<h1>Ballistics</h1>')
    const sitemap = await (await request.get(`${base}sitemap.xml`)).text()
    expect(sitemap).toContain(`<loc>https://openreloading.github.io${base}</loc>`)
  })

  for (const path of records)
    test(`S2 ${base}${path} answers 200 with share tags`, async ({ request }) => {
      const r = await request.get(`${base}${path}`)
      expect(r.status()).toBe(200)
      const html = await r.text()
      const url = `https://openreloading.github.io${base}${path}`
      expect(html).toContain(`<meta property="og:url" content="${url}"/>`)
      expect(html).toContain(`<link rel="canonical" href="${url}"/>`)
      expect(html).toMatch(/<meta property="og:title" content="[^"]+"\/>/)
      expect(html).toMatch(/<meta property="og:description" content="[^"]+"\/>/)
    })

  test(`S2 ${base} non-prerendered record: 404 with 404.html, rendered by this edition`, async ({
    page,
  }) => {
    const requests: string[] = []
    page.on('request', (r) => requests.push(new URL(r.url()).pathname))
    const r = await page.goto(`${base}cartridges/10-3-capra/`)
    expect(r?.status()).toBe(404)
    expect(await r?.text()).toBe(readFileSync('site/404.html', 'utf8'))
    await expect(page.locator('h1')).toHaveText('10,3 Capra')
    expect(requests).toContain(`${base}api/cartridges/10-3-capra.json`)
  })
}

for (const { base, prefix, otherPrefix } of editions)
  test(`S2 ${base} own assets, worker scope and storage names`, async ({ page }) => {
    const requests: string[] = []
    page.on('request', (r) => requests.push(new URL(r.url()).pathname))
    await page.goto(base)
    await waitActive(page, base)
    // the controller arrives through clients.claim(): Playwright's Firefox navigations bypass workers
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL))
      .toBe(`http://localhost:3043${base}sw.js`)
    expect(await page.evaluate(() => caches.keys())).toEqual([`${prefix}spike-shell-v1`])
    for (const path of [...records, 'workbench/', 'cartridges/10-3-capra/']) {
      await page.goto(`${base}${path}`)
      await expect(page.locator('html[data-hydrated]')).toBeAttached()
    }
    // every request of this edition stays in its folder
    const own = (p: string) => (base === '/' ? !p.startsWith('/next/') : p.startsWith('/next/'))
    expect(requests.filter((p) => !own(p))).toEqual([])
    // the other edition's language key does not reach this one
    await page.evaluate((key) => localStorage.setItem(key, 'de'), `${otherPrefix}language`)
    await page.goto(base)
    await expect(page.locator('html[data-hydrated]')).toBeAttached()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })

test('S2 both workers registered side by side', async ({ page }) => {
  for (const base of ['/', '/next/']) {
    await page.goto(base)
    await waitActive(page, base)
  }
  const scopes = await page.evaluate(async () =>
    (await navigator.serviceWorker.getRegistrations()).map((r) => new URL(r.scope).pathname).sort(),
  )
  expect(scopes).toEqual(['/', '/next/'])
  expect((await page.evaluate(() => caches.keys())).sort()).toEqual([
    'next:spike-shell-v1',
    'spike-shell-v1',
  ])
})
