import { expect, type Page, type Request, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { gotoHydrated } from './nav.ts'
import { choosePreset, storeUnits } from './units.ts'

test.beforeEach(({ page }) => storeUnits(page))

/** OpenReloading CSV template with made-up velocities. */
const template = [
  'string,velocity,velocityUnit,coldBore,excluded',
  'A,2795,fps,yes,',
  'A,2810,fps,,',
  'A,2803,fps,,flyer',
  'B,2831,fps,,',
].join('\n')

async function choose(page: Page, name: string, text: string) {
  await page.getByLabel('Chronograph file').setInputFiles({
    name,
    mimeType: 'text/csv',
    buffer: Buffer.from(text),
  })
}

const stats = (page: Page) => page.getByRole('table', { name: /^Statistics per string/ })

test('names a file of no known format, then reads a template file of the same name in the browser without sending it', async ({
  page,
}) => {
  await gotoHydrated(page, '/session')
  const sent: Request[] = []
  page.on('request', (r) => {
    if (r.method() !== 'GET' || r.postData()) sent.push(r)
  })
  await choose(page, 'session.csv', 'a,b\n1,2')
  await expect(
    page.getByRole('alert').filter({ hasText: 'not a recognized chronograph export' }),
  ).toBeVisible()
  // the same name again, now a template: read again although the input saw this name before
  await choose(page, 'session.csv', template)
  await expect(page.getByRole('status').filter({ hasText: 'Read' })).toHaveText(
    'Read 2 strings, 4 shots.',
  )
  // the stats follow a change of the unit preset
  await choosePreset(page, 'US customary')
  await expect(
    stats(page).getByRole('row').filter({ hasText: 'String 1: A' }).getByRole('cell').nth(2),
  ).toHaveText('2802.5')
  expect(sent).toEqual([])
})

test('takes the unit of the file over the unit chosen for files without one', async ({ page }) => {
  await gotoHydrated(page, '/session')
  const unit = page.getByLabel('Unit if the file has none')
  // from Settings: Metric, grams gives m/s
  await expect(unit).toHaveValue('m/s')
  await unit.selectOption('ft/s')
  await choose(page, 'plain.csv', 'string,velocity\nA,2812\nA,2815')
  await expect(page.getByText('Unit: ft/s, named at import')).toBeVisible()
  await unit.selectOption('m/s')
  await expect(page.getByText('Unit: m/s, named at import')).toBeVisible()
  await choose(page, 'session.csv', template)
  await expect(page.getByText('Unit: ft/s, from the file')).toBeVisible()
  await expect(page.getByText('The file was not read.')).toHaveCount(0)
})

test('prints the summary without the file control', async ({ page }) => {
  await page.setViewportSize({ width: 718, height: 1000 })
  await gotoHydrated(page, '/session')
  await choose(page, 'session.csv', template)
  await expect(stats(page)).toBeVisible()
  await page.emulateMedia({ media: 'print', colorScheme: 'dark' })
  // the banner, not the nav: below 75em the nav is hidden on screen too
  await expect(page.getByRole('banner')).toBeHidden()
  // the drop area holding the visually hidden file input
  await expect(page.locator('label', { has: page.getByLabel('Chronograph file') })).toBeHidden()
  await expect(page.getByLabel('Unit if the file has none')).toBeHidden()
  await expect(page.getByText('File: session.csv')).toBeVisible()
  // a named region only while it overflows
  const region = page.locator('.scroll', {
    has: page.getByRole('table', { name: /^Statistics per string/ }),
  })
  expect(await region.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true)
  await expect(page.getByRole('region', { name: 'Safety' })).toHaveCount(0)
  expect(await page.evaluate(() => getComputedStyle(document.body).color)).toBe('rgb(26, 26, 26)')
})

/** Loads the example from the empty state. */
async function loadExample(page: Page) {
  await page.getByRole('button', { name: 'Load example' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Read' })).toHaveText(
    'Read 3 strings, 30 shots.',
  )
}

test('the example loads into badges, the strings table and a tab per string with a chart', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.addInitScript(() => {
    ;(window as unknown as { printed: number }).printed = 0
    window.print = () => {
      ;(window as unknown as { printed: number }).printed++
    }
  })
  await gotoHydrated(page, '/session')
  await expect(page.getByText('No file read yet.')).toBeVisible()
  await expect(await barButton(page, 'Export CSV')).toBeDisabled()
  // the strip and the bar actions keep their place when the status appears
  const strip = page.locator('.session-import')
  const print = await barButton(page, 'Print')
  const before = [await strip.boundingBox(), await print.boundingBox()]
  await loadExample(page)
  expect([await strip.boundingBox(), await print.boundingBox()]).toEqual(before)

  await expect(page.getByText('File: openreloading-example-session.csv')).toBeVisible()
  await expect(page.getByText('Date: not in the file')).toBeVisible()
  await expect(stats(page).getByRole('row')).toHaveCount(4)
  await expect(
    stats(page).getByRole('row').filter({ hasText: 'String 3: Example C' }).getByRole('cell'),
  ).toHaveText(['String 3: Example C', '9 of 10', '872.5', '1.6', '4.9', '870.2', '875.1'])

  const tabs = page.getByRole('tab')
  await expect(tabs).toHaveText([
    'String 1: Example A',
    'String 2: Example B',
    'String 3: Example C',
  ])
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
  const chart = (name: string) => page.getByRole('img', { name: `Velocity per shot, ${name}` })
  await expect(chart('String 1: Example A')).toBeVisible()
  await expect(chart('String 1: Example A').locator('svg')).toBeAttached()
  await tabs.nth(2).click()
  await expect(chart('String 3: Example C')).toBeVisible()
  await expect(
    page.getByRole('table', { name: 'Shots of String 3: Example C' }).getByRole('row').nth(9),
  ).toContainText('flyer')

  // fits 1280 x 800 without scrolling the page
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(800)

  // CSV of the strings and the shots, named with the local day
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    (await barButton(page, 'Export CSV')).click(),
  ])
  const day = await page.evaluate(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  expect(download.suggestedFilename()).toBe(`openreloading-session-${day}.csv`)
  const csv = (await (await download.createReadStream()).toArray()).join('')
  const lines = csv.slice(1).split('\n')
  expect(lines[0]).toBe('String,Shots,Excluded,Mean (m/s),SD (m/s),ES (m/s),Min (m/s),Max (m/s)')
  expect(lines[3]).toBe('String 3: Example C,9,1,872.5,1.6,4.9,870.2,875.1')

  // the same session as OpenReloading JSON, velocities in m/s
  const [jsonDownload] = await Promise.all([
    page.waitForEvent('download'),
    (await barButton(page, 'Export JSON')).click(),
  ])
  expect(jsonDownload.suggestedFilename()).toBe(`openreloading-session-${day}.json`)
  const json = JSON.parse((await (await jsonDownload.createReadStream()).toArray()).join(''))
  expect(json.format).toBe('openreloading-session')
  expect(csv).not.toMatch(/safe|simulation|notice/i)

  await (await barButton(page, 'Print')).click()
  expect(await page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1)
})

test('prints the summary and every chart without the import strip', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await gotoHydrated(page, '/session')
  await loadExample(page)
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.session-import')).toBeHidden()
  await expect(page.getByRole('tablist')).toBeHidden()
  await expect(stats(page)).toBeVisible()
  const main = page.locator('main#main')
  for (const name of ['String 1: Example A', 'String 2: Example B', 'String 3: Example C']) {
    const chart = page.getByRole('img', { name: `Velocity per shot, ${name}` })
    await expect(chart).toBeVisible()
    await expect(page.getByRole('table', { name: `Shots of ${name}` })).toBeVisible()
    // the chart takes the print width on its next resize; main is read in the same poll, as the
    // print layout may settle after the media change; a cold server also loads the chart code
    await expect
      .poll(
        async () => {
          const [box, width] = [
            await chart.boundingBox(),
            await main.evaluate((m) => m.clientWidth),
          ]
          return (box?.width ?? Number.POSITIVE_INFINITY) - width
        },
        { timeout: 15_000 },
      )
      .toBeLessThanOrEqual(0)
  }
  await expect(page.locator('body')).not.toContainText(/simulation|Load example/)
})
