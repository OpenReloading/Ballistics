import { expect, type Page, test } from '@playwright/test'
import { barButton } from './bar.ts'
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
  // the example load is not saved: its strings name no load, so no fit runs
  await expect(page.getByText('Save the load to fit a powder from its strings.')).toBeVisible()
  await expect(page.getByText(/^Fitted vivacity/)).toHaveCount(0)

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

// one string per step of the example's charge ladder, 5 steps
const ladder = [
  'string,velocity,velocityUnit',
  ...['A', 'B', 'C', 'D', 'E'].flatMap((name, i) =>
    [0, 4, 2].map((d) => `${name},${880 - 8 * i + d},m/s`),
  ),
].join('\n')

test('the Measurements link of a saved load fits the powder on the load the workbench runs', async ({
  page,
}) => {
  await page.goto('/workbench')
  await applyExampleLoad(page)
  await runLine(page)
  await page.getByRole('tab', { name: 'Measurements', exact: true }).click()
  await page
    .locator('input[type="file"]#measurements-file')
    .setInputFiles({ name: 'ladder.csv', mimeType: 'text/csv', buffer: Buffer.from(ladder) })
  await (await barButton(page, 'Save')).click()
  await expect(page.locator('.file-state')).toContainText('Saved')
  await page.getByRole('link', { name: 'Fit a powder from these strings' }).click()
  await expect(page).toHaveURL(/\/powders\/tune\/?\?session=/)
  await expect(table(page).locator('tbody tr')).toHaveCount(5)
  await expect(page.getByText(/^Fitted vivacity: /)).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('Save the load to fit a powder from its strings.')).toHaveCount(0)
})

test('the powder designer links to the tuning route', async ({ page }) => {
  await gotoHydrated(page, '/powders/designer')
  await page.getByRole('link', { name: 'Fit a powder from chronograph strings' }).click()
  await expect(page).toHaveURL(/\/powders\/tune\/?$/)
  await expect(page.getByRole('button', { name: 'Add a string' })).toBeVisible()
})

test('a saved powder design opens the route with the saved loads that use it', async ({ page }) => {
  await gotoHydrated(page, '/powders/designer')
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Tuned')
  await expect(page.getByText('Saved in this browser')).toBeVisible()
  await page.getByRole('link', { name: 'Fit a powder from chronograph strings' }).click()
  await expect(page).toHaveURL(/\/powders\/tune\/?\?powder=user/)
  await expect(page.getByText('No saved load uses this powder.', { exact: false })).toBeVisible()
})
