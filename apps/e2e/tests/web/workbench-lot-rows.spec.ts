import { expect, test } from '@playwright/test'
import { AxeBuilder } from './a11y.ts'
import { storeUnits } from './units.ts'
import { runSavedLoad } from './workbench-run.ts'

test.beforeEach(({ page }) => storeUnits(page))

/** Runs the fixture load and opens the Ladder table tab with its lot rows computed. */
async function openLotRows(page: import('@playwright/test').Page) {
  await runSavedLoad(page)
  await page.getByRole('tab', { name: 'Ladder table', exact: true }).click()
  await expect(page.locator('.lot-rows .lot-chart svg path').first()).toBeAttached({
    timeout: 15_000,
  })
}

const burnRates = (page: import('@playwright/test').Page) =>
  page.locator('.ladder-table td[data-label="Burn rate"]').allTextContents()

// one run of the fixture load for every state of the lot rows: the run is the slow part
test('the Ladder table adds a slower and a faster lot row to every charge, axe clean, printed and as cards on a phone', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1280, height: 650 })
  await openLotRows(page)

  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page })
      .include('.lot-rows')
      .include('.ladder-table')
      .analyze()
    expect(violations.map((v) => v.id)).toEqual([])
  }
  await page.emulateMedia({ colorScheme: 'light' })

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

  await page.emulateMedia({ media: 'print' })
  const printed = page.locator('.print-report .lot-chart')
  await expect(printed.locator('svg path').first()).toBeAttached()
  expect((await printed.boundingBox())?.width).toBeGreaterThan(100)
  expect(
    await page.locator('.print-report .ladder-table td[data-label="Burn rate"]').count(),
  ).toBeGreaterThan(3)
  await page.emulateMedia({ media: 'screen' })

  await page.setViewportSize({ width: 390, height: 800 })
  await page.getByRole('tab', { name: 'Results', exact: true }).click()
  const chart = page.locator('.lot-rows .lot-chart')
  await expect(chart.locator('svg path').first()).toBeAttached()
  expect((await chart.boundingBox())?.width).toBeLessThanOrEqual(390)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
