import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { storeUnits } from './units.ts'
import { loadForm } from './workbench.ts'
import { runExample } from './workbench-run.ts'

test.beforeEach(({ page }) => storeUnits(page))

const note = 'Chamber volume not measured'

test('a volume typed over the measured capacity shows the note on screen and in print, in the window', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1280, height: 650 })
  await runExample(page)
  // the example's volume follows its measured case capacity
  await expect(page.getByText(note)).toHaveCount(0)
  await loadForm(page)
    .getByLabel(/^Usable case volume/)
    .fill('3.1')
  await loadForm(page)
    .getByLabel(/^Charge mass/)
    .press('Control+Enter')
  const message = page.locator('.message').filter({ hasText: note })
  await expect(message).toBeVisible({ timeout: 15_000 })
  await expect(message).toContainText('Enter a measured case capacity in the Cartridge card')
  // nothing scrolls, the page or the results column
  const overflow = await page.evaluate(() =>
    [document.scrollingElement, document.querySelector('.workspace-results')].map((e) =>
      e ? e.scrollHeight - e.clientHeight : 0,
    ),
  )
  expect(overflow.every((x) => x <= 1)).toBe(true)
  const { violations } = await new AxeBuilder({ page }).include('.message').analyze()
  expect(violations.map((v) => v.id)).toEqual([])
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.print-report .report-sub')).toContainText(note)
})
