import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'

/** A cartridge record page renders in the browser from its data file: the exported file holds the head tags and a loading state. */
const record = '/cartridges/308-win/'
const loaded = (page: Page) => page.locator('main figure.drawing-figure')

test("the exported file carries the record's own head tags and no drawing", async ({ request }) => {
  const html = await (await request.get(record)).text()
  const head = html.slice(0, html.indexOf('</head>'))
  expect(head).toContain('<title>308 Win. dimensions and pressures')
  for (const tag of [
    '<meta name="description" content="CIP dimensions and maximum pressures of 308 Win., with sources."/>',
    '<meta property="og:title" content="308 Win. dimensions and pressures"/>',
    '<meta property="og:description" content="CIP dimensions and maximum pressures of 308 Win., with sources."/>',
    '<meta name="twitter:title" content="308 Win. dimensions and pressures"/>',
    '<meta name="twitter:description" content="CIP dimensions and maximum pressures of 308 Win., with sources."/>',
  ])
    expect(head).toContain(tag)
  expect(html).toContain('<h1')
  expect(html).not.toContain('dims-cartridge')
})

for (const colorScheme of ['light', 'dark'] as const)
  test(`the loaded record page has no axe violation, ${colorScheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme })
    await gotoHydrated(page, record)
    await expect(loaded(page)).toHaveCount(2)
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(
      violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} ${n.html}`).join(', ')}`,
      ),
    ).toEqual([])
  })

test('a record whose data file is gone shows the not-found message', async ({ page }) => {
  await page.route('**/api/cartridges/308-win.json', (route) => route.fulfill({ status: 404 }))
  await page.goto(record)
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  await expect(page.getByText('Nothing at this address')).toBeVisible()
  await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(1)
})

test('an unknown record id answers the not-found page of the site', async ({ page }) => {
  const response = await page.goto('/cartridges/no-such-record/')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
})

test.describe('offline', () => {
  test.use({ serviceWorkers: 'allow' })

  test('a visited record opens again offline, drawn from its stored data file', async ({
    page,
    context,
  }) => {
    await gotoHydrated(page, record)
    await expect(loaded(page)).toHaveCount(2)
    // the worker stores the page and the record's data file of the first visit
    await page.evaluate(() => navigator.serviceWorker.ready)
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const [html, data] = await Promise.all([
            caches.match(location.pathname),
            caches.match('/api/cartridges/308-win.json'),
          ])
          return Boolean(html && data)
        }),
      )
      .toBe(true)
    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: '308 Win.' })).toBeVisible()
    await expect(loaded(page)).toHaveCount(2)
    await context.setOffline(false)
  })
})
