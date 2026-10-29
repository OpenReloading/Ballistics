import { expect, type Page } from '@playwright/test'
import { barButton } from './bar.ts'
import { gotoHydrated } from './nav.ts'
import { applyExampleLoad } from './workbench.ts'
import { runLine } from './workbench-run.ts'

// one string per step of the example's charge ladder, 5 steps
const ladder = [
  'string,velocity,velocityUnit',
  ...['A', 'B', 'C', 'D', 'E'].flatMap((name, i) =>
    [0, 4, 2].map((d) => `${name},${880 - 8 * i + d},m/s`),
  ),
].join('\n')

/**
 * Saves the example load with a ladder of strings and opens the tuning route from its Measurements
 * tab, once the fit is shown; the fit may take up to 60 s after the run, the save and the navigation.
 */
export async function openFit(page: Page) {
  // a native picker cannot be driven: the file goes to the origin private file system
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () =>
      (await navigator.storage.getDirectory()).getFileHandle('export.json', { create: true })
  })
  await gotoHydrated(page, '/workbench')
  await applyExampleLoad(page)
  await runLine(page)
  // the phone layout keeps the run's tabs behind its Results tab
  const results = page.getByRole('tab', { name: 'Results', exact: true })
  if (await results.isVisible()) await results.click()
  await page.getByRole('tab', { name: 'Measurements', exact: true }).click()
  await page
    .locator('input[type="file"]#measurements-file')
    .setInputFiles({ name: 'ladder.csv', mimeType: 'text/csv', buffer: Buffer.from(ladder) })
  await (await barButton(page, 'Save')).click()
  await expect(page.locator('.file-state')).toContainText('Saved')
  await page.getByRole('link', { name: 'Fit a powder from these strings' }).click()
  await expect(page).toHaveURL(/\/powders\/tune\/?\?session=/)
  await expect(
    page.getByRole('table', { name: 'Strings per charge' }).locator('tbody tr'),
  ).toHaveCount(5)
  await expect(page.getByRole('table', { name: 'Fitted values' })).toBeVisible({ timeout: 60_000 })
}
