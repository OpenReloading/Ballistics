import { expect, type Page, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { applyExampleLoad } from './workbench.ts'
import { runLine } from './workbench-run.ts'

// The powder tuning route lists the chronograph strings of the open load per charge and takes more
// typed in; the Measurements tab and the powder designer link to it
// Metric (SI): g, m/s
test.beforeEach(({ page }) => storeUnits(page))

const file = [
  'string,velocity,velocityUnit,coldBore,excluded',
  'A,850,m/s,,',
  'A,854,m/s,,',
  'A,852,m/s,,',
].join('\n')

const table = (page: Page) => page.getByRole('table', { name: 'Strings per charge' })

const noSideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)

test('the Measurements tab opens the route with the load strings, and an added string joins the table', async ({
  page,
}) => {
  await page.goto('/workbench')
  await applyExampleLoad(page)
  await runLine(page)
  await page.getByRole('tab', { name: 'Measurements', exact: true }).click()
  await page
    .locator('input[type="file"]#measurements-file')
    .setInputFiles({ name: 'day1.csv', mimeType: 'text/csv', buffer: Buffer.from(file) })
  await page.getByRole('link', { name: 'Fit a powder from these strings' }).click()
  await expect(page).toHaveURL(/\/powders\/tune\/?\?session=/)

  const rows = table(page).locator('tbody tr')
  await expect(rows).toHaveCount(1)
  // shots, mean and SD of the string 850, 854, 852 m/s
  await expect(rows.first().locator('td').nth(1)).toHaveText('3')
  await expect(rows.first().locator('td').nth(2)).toHaveText('852.0')
  await expect(rows.first().locator('td').nth(3)).toHaveText('2.0')

  await page.getByRole('textbox', { name: 'Charge (g)' }).fill('9.9')
  await page.getByRole('textbox', { name: /^Shot velocities/ }).fill('900 904')
  await page.getByRole('button', { name: 'Add a string' }).click()
  await expect(rows).toHaveCount(2)
  await expect(rows.last().locator('td').nth(2)).toHaveText('902.0')
  await expect(
    page.getByText('All values on this screen are simulations, not load data.'),
  ).toBeVisible()

  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    expect(await noSideScroll(page)).toBe(true)
  }
})

test('the powder designer links to the tuning route', async ({ page }) => {
  await gotoHydrated(page, '/powders/designer')
  await page.getByRole('link', { name: 'Fit a powder from chronograph strings' }).click()
  await expect(page).toHaveURL(/\/powders\/tune\/?$/)
  await expect(page.getByRole('button', { name: 'Add a string' })).toBeVisible()
})
