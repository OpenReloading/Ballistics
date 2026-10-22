import { expect, type Page, test } from '@playwright/test'
import { gotoHydrated, safetyAck } from './nav.ts'
import { storeUnits } from './units.ts'
import { applyExampleLoad } from './workbench.ts'
import { runLine } from './workbench-run.ts'

const pages = [
  ['/', 'OpenReloading Ballistics'],
  ['/cartridges/308-win', '308 Win.'],
  ['/workbench', 'Load workbench'],
  ['/targets', 'Targets'],
  ['/targets/issf-25m-precision-50m-pistol', '25m Precision and 50m Pistol Target'],
  ['/disciplines', 'Disciplines'],
  ['/disciplines/dsb-25m-pistole-revolver', '25 m Pistole/Revolver'],
  ['/federations', 'Federations'],
  ['/federations/dsb', 'Deutscher Schützenbund e.V.'],
]

for (const [path, title] of pages)
  test(`${path} answers 200, shows its h1 and logs no error`, async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    page.on('pageerror', (e) => errors.push(e.message))
    // networkidle, so errors logged after hydration count. Relative, so the Pages base path stays
    const res = await page.goto(`.${path}`, { waitUntil: 'networkidle' })
    expect(res?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
    expect(errors).toEqual([])
  })

test('the forwarding route answers 200 with the 308 Win. record', async ({ request }, info) => {
  test.skip(info.project.name === 'pages', 'the Pages edition has no forwarding route')
  const res = await request.get('/api/cartridges/308-win')
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('application/json')
  expect((await res.json()).id).toBe('308-win')
})

test('a Pages record page opens another without a page load, back and forward too', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'pages', 'checks the RSC files of the static export')
  const failed: string[] = []
  page.on('response', (r) => {
    if (new URL(r.url()).pathname.endsWith('.txt') && r.status() >= 400)
      failed.push(`${r.status()} ${r.url()}`)
  })
  await gotoHydrated(page, './bullets/demo-bullet-168')
  // a full page load drops the marker
  await page.evaluate(() => Object.assign(window, { softNav: true }))
  await page
    .getByRole('list', { name: 'Cartridges' })
    .getByRole('link', { name: '308 Win.', exact: true })
    .click()
  const h1 = page.getByRole('heading', { level: 1 })
  await expect(h1).toHaveText('308 Win.')
  await page.goBack()
  await expect(h1).toContainText('168')
  await page.goForward()
  await expect(h1).toHaveText('308 Win.')
  expect(await page.evaluate(() => 'softNav' in window)).toBe(true)
  expect(failed).toEqual([])
})

/** Runs the example load on `page` and gives the result line: step, charge, peak pressure and muzzle velocity. */
async function exampleResult(page: Page, url: string) {
  await storeUnits(page)
  await page.goto(url)
  await applyExampleLoad(page)
  return runLine(page)
}

test('the Pages workbench runs the example load in the browser as the API does', async ({
  page,
  browser,
}, info) => {
  test.skip(info.project.name !== 'pages', 'compares the Pages edition with the server edition')
  const webUrl = process.env.WEB_URL ?? 'http://localhost:3001'
  // the Safety dialog accepted, as the projects' storage state does
  const server = await browser.newPage({
    serviceWorkers: 'block',
    storageState: {
      cookies: [],
      origins: [{ origin: webUrl, localStorage: [{ name: 'safety-ack', value: safetyAck }] }],
    },
  })
  const expected = await exampleResult(server, `${webUrl}/workbench`)
  expect(expected).toMatch(/peak \d+ bar, .* \d+ m\/s/)
  expect(await exampleResult(page, './workbench')).toBe(expected)
})
