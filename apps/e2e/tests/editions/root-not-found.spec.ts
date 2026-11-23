import { expect, type Page, test } from '@playwright/test'

/** The pathnames of the page's requests for an edition's `404.edition.html`. */
function editionPages(page: Page) {
  const paths: string[] = []
  page.on('request', (r) => {
    if (r.url().endsWith('/404.edition.html')) paths.push(new URL(r.url()).pathname)
  })
  return paths
}

/** Waits until the stable edition's worker is active, so it controls the next page of its scope. */
async function installStableWorker(page: Page) {
  await page.goto('')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
}

/** Next's flight scripts set it as they run. */
const nextFlight = (page: Page) =>
  page.evaluate(() => typeof (self as { __next_f?: unknown }).__next_f)

/** Opens `path` and checks its status; `controlled`: the stable worker controls the page. */
async function openMiss(page: Page, path: string, controlled: boolean) {
  const response = await page.goto(path)
  expect(response?.status()).toBe(404)
  if (controlled)
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
}

async function stableMiss(page: Page, controlled: boolean) {
  const fetched = editionPages(page)
  await openMiss(page, 'no-such-page/', controlled)
  // only the stable app's not-found page renders it: the dispatcher's fallback has the same heading
  await expect(page.getByText('This page could not be found.')).toBeVisible()
  await page.getByRole('main').getByRole('link', { name: 'Cartridges', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cartridges')
  expect(fetched).toEqual([])
}

async function nextMiss(page: Page, site: string, controlled: boolean) {
  const fetched = editionPages(page)
  await openMiss(page, 'next/no-such-page/', controlled)
  const heading = page.getByRole('heading', { level: 1 })
  await expect(heading).toHaveCount(1)
  await expect(heading).toBeVisible()
  await expect(heading).toHaveText('Page not found')
  const home = page.getByRole('link', { name: 'RangeFoundry Workbench' })
  await expect(home).toBeVisible()
  await expect(home).toHaveAttribute('href', `${site}next/`)
  // the next edition's 404.edition.html is missing, so its answer is the root 404.html with status 404
  await page.waitForLoadState('networkidle')
  expect(fetched).toEqual([`${site}next/404.edition.html`])
  // Next's page is inert text: the preload scanner may fetch its files, but none of them runs
  expect(await nextFlight(page)).toBe('undefined')
  await expect(
    page.locator('script[src*="/_next/"], link[rel="stylesheet"][href*="/_next/"]'),
  ).toHaveCount(0)
}

test('a stable miss shows the stable not-found page', async ({ page }) => {
  await stableMiss(page, false)
})

test('a miss under next/ shows the next fallback and none of the stable page runs', async ({
  page,
  baseURL,
}) => {
  await nextMiss(page, new URL(baseURL ?? '').pathname, false)
})

test.describe('under the stable worker', () => {
  test('a stable miss shows the stable not-found page', async ({ page }) => {
    await installStableWorker(page)
    await stableMiss(page, true)
  })

  test('a miss under next/ shows the next fallback and none of the stable page runs', async ({
    page,
    baseURL,
  }) => {
    await installStableWorker(page)
    await nextMiss(page, new URL(baseURL ?? '').pathname, true)
  })
})

test.describe('without a worker', () => {
  // Playwright's routes can miss the requests of a page that a worker controls
  test.use({ serviceWorkers: 'block' })

  test('an ok answer for the next 404.edition.html replaces the page at the unchanged address', async ({
    page,
    baseURL,
  }) => {
    const site = new URL(baseURL ?? '').pathname
    await page.route('**/next/404.edition.html', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>edition marker</title></head><body><h1>edition marker</h1><script>document.documentElement.dataset.path = location.pathname</script></body></html>',
      }),
    )
    const fetched = editionPages(page)
    const response = await page.goto('next/no-such-page/')
    expect(response?.status()).toBe(404)
    // only the written page renders the marker
    await expect(page.getByRole('heading', { level: 1, name: 'edition marker' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(page.locator('html')).toHaveAttribute('data-path', `${site}next/no-such-page/`)
    await expect(page).toHaveURL(`${baseURL}next/no-such-page/`)
    // document.open() keeps the Window, so a global of Next's flight scripts would still be set
    expect(await nextFlight(page)).toBe('undefined')
    expect(fetched).toEqual([`${site}next/404.edition.html`])
  })
})
