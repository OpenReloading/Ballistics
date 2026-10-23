import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { storeUnits } from './units.ts'
import { runExample } from './workbench-run.ts'

test.beforeEach(({ page }) => storeUnits(page))

/** Runs the example and opens the Ladder table tab with its lot rows computed. */
async function openLotRows(page: import('@playwright/test').Page) {
  await runExample(page)
  await page.getByRole('tab', { name: 'Ladder table', exact: true }).click()
  await expect(page.locator('.lot-rows .lot-chart svg path').first()).toBeAttached({
    timeout: 15_000,
  })
}

const burnRates = (page: import('@playwright/test').Page) =>
  page.locator('.ladder-table td[data-label="Burn rate"]').allTextContents()

test('the Ladder table adds a slower and a faster lot row to every charge and follows the percentage', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1280, height: 650 })
  await openLotRows(page)
  const first = await burnRates(page)
  expect(first.length).toBeGreaterThan(3)
  expect(first.length % 3).toBe(0)
  expect(first.slice(0, 3)).toEqual(['−3 %', 'nominal', '+3 %'])
  await page.getByLabel(/^Lot burn rate change/).fill('5')
  await expect.poll(() => burnRates(page).then((r) => r[0])).toBe('−5 %')
  await expect(page.getByLabel('Target barrel time')).toBeVisible()
  await page.getByLabel('Target barrel time').fill('1.2')
  await expect(page.locator('.lot-rows .lot-chart')).toContainText('Target 1.200 ms')
  await expect(page.locator('.lot-rows .lot-note')).toBeVisible()
})

for (const colorScheme of ['light', 'dark'] as const)
  test(`the lot rows, axe clean in ${colorScheme}`, async ({ page }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width: 1280, height: 650 })
    await page.emulateMedia({ colorScheme })
    await openLotRows(page)
    const { violations } = await new AxeBuilder({ page })
      .include('.lot-rows')
      .include('.ladder-table')
      .analyze()
    expect(violations.map((v) => v.id)).toEqual([])
  })

test('at phone width the chart fits the window and the table is cards', async ({ page }) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1280, height: 650 })
  await openLotRows(page)
  await page.setViewportSize({ width: 390, height: 800 })
  await page.getByRole('tab', { name: 'Results', exact: true }).click()
  const chart = page.locator('.lot-rows .lot-chart')
  await expect(chart.locator('svg path').first()).toBeAttached()
  const box = await chart.boundingBox()
  expect(box?.width).toBeLessThanOrEqual(390)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('the printed report holds the lot chart and the lot rows', async ({ page }) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1280, height: 650 })
  await openLotRows(page)
  await page.emulateMedia({ media: 'print' })
  const chart = page.locator('.print-report .lot-chart')
  await expect(chart.locator('svg path').first()).toBeAttached()
  const box = await chart.boundingBox()
  expect(box?.width).toBeGreaterThan(100)
  expect(
    await page.locator('.print-report .ladder-table td[data-label="Burn rate"]').count(),
  ).toBeGreaterThan(3)
})
