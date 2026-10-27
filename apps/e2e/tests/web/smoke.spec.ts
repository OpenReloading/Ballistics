import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { loadForm } from './workbench.ts'
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

/** The live API: a separate origin from the exported site the project's `baseURL` names. */
const apiUrl = process.env.API_URL ?? 'http://localhost:3000'

test('the exported data files are what the API answers', async ({ request }) => {
  for (const [kind, id] of [
    ['cartridges', '308-win'],
    ['bullets', 'demo-bullet-168'],
    ['powders', 'demo-powder-dp40'],
    ['target-faces', 'issf-25m-precision-50m-pistol'],
  ] as const) {
    // relative, so the Pages base path stays
    const exported = await request.get(`./api/${kind}/${id}.json`)
    const live = await request.get(`${apiUrl}/v1/${kind}/${id}`)
    expect(exported.status(), `${kind}/${id} exported`).toBe(200)
    expect(exported.headers()['content-type']).toContain('application/json')
    expect(live.status(), `${kind}/${id} live`).toBe(200)
    expect(await exported.json(), `${kind}/${id}`).toEqual(await live.json())
  }
})

test('a record page opens another without a page load, back and forward too', async ({ page }) => {
  const failed: string[] = []
  page.on('response', (r) => {
    if (new URL(r.url()).pathname.endsWith('.txt') && r.status() >= 400)
      failed.push(`${r.status()} ${r.url()}`)
  })
  // a discipline and its federation: no cartridge links, so no prefetch of a page the sample leaves out
  await gotoHydrated(page, './disciplines/dsb-25m-pistole-revolver')
  // a full page load drops the marker
  await page.evaluate(() => Object.assign(window, { softNav: true }))
  await page.getByRole('link', { name: 'Deutscher Schützenbund e.V.', exact: true }).click()
  const h1 = page.getByRole('heading', { level: 1 })
  await expect(h1).toHaveText('Deutscher Schützenbund e.V.')
  await page.goBack()
  await expect(h1).toHaveText('25 m Pistole/Revolver')
  await page.goForward()
  await expect(h1).toHaveText('Deutscher Schützenbund e.V.')
  expect(await page.evaluate(() => 'softNav' in window)).toBe(true)
  expect(failed).toEqual([])
})

test('the workbench runs the example load in the browser as the API runs its file', async ({
  page,
  request,
}) => {
  await storeUnits(page)
  // the file of Save options > Download for the API goes to a file in the browser's own storage
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () =>
      (await navigator.storage.getDirectory()).getFileHandle('export.json', { create: true })
  })
  await gotoHydrated(page, './workbench')
  // the start card inside the window: in the frame the workspace keeps its height
  const example = page.getByRole('button', { name: 'Try the example load' })
  await expect(example).toBeInViewport()
  await example.click()
  await expect(loadForm(page).locator('.field-flag-seating')).toHaveCount(2)
  const line = await runLine(page)
  const shown = /peak (\d+) bar, .* (\d+) m\/s/.exec(line ?? '')
  expect(shown, line ?? 'no result line').not.toBeNull()
  await (await barButton(page, 'Save options')).click()
  const download = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Download for the API' }).click()
  const file = JSON.parse(await readFile(await (await download).path(), 'utf8'))
  const res = await request.post(`${apiUrl}/v1/interior/load-file`, { data: file })
  expect(res.status(), await res.text()).toBe(200)
  const { peakPressure, muzzleVelocity } = (await res.json()).summary
  // the line's rounding: bar and m/s without decimals
  expect(Number(shown?.[1])).toBeCloseTo(peakPressure / 1e5, 0)
  expect(Number(shown?.[2])).toBeCloseTo(muzzleVelocity, 0)
})
