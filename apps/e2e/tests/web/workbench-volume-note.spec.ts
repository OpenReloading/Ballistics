import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { storeUnits } from './units.ts'
import { loadForm } from './workbench.ts'
import { runExample } from './workbench-run.ts'

test.beforeEach(({ page }) => storeUnits(page))

const note = 'Chamber volume not measured'

test('a record capacity and a volume typed over the measured capacity show the note on screen and in print, in the window', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1280, height: 650 })
  await runExample(page)
  // the example's volume follows its brass record's stated capacity, an estimate; the print copies
  // of the note are in the page too
  const message = page.locator('.result-notes li', { hasText: note })
  await expect(message).toBeVisible()
  await loadForm(page)
    .getByRole('textbox', { name: /^Case capacity/ })
    .fill('3.6')
  await loadForm(page)
    .getByLabel(/^Charge mass/)
    .press('Control+Enter')
  await expect(page.getByText(note)).toHaveCount(0)
  await loadForm(page)
    .getByLabel(/^Usable case volume/)
    .fill('3.1')
  await loadForm(page)
    .getByLabel(/^Charge mass/)
    .press('Control+Enter')
  await expect(message).toBeVisible({ timeout: 15_000 })
  // what to enter is its reason in the notes dialog
  await page.locator('.result-notes').getByRole('button', { name: /^More/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Result notes' })
  await expect(dialog).toContainText(
    'To use a measured case capacity, enter it in the Cartridge card',
  )
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  // nothing scrolls, the page or the results column
  const overflow = await page.evaluate(() =>
    [document.scrollingElement, document.querySelector('.workspace-results')].map((e) =>
      e ? e.scrollHeight - e.clientHeight : 0,
    ),
  )
  expect(overflow.every((x) => x <= 1)).toBe(true)
  const { violations } = await new AxeBuilder({ page }).include('.result-notes').analyze()
  expect(violations.map((v) => v.id)).toEqual([])
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.print-report .report-sub')).toContainText(note)
})
