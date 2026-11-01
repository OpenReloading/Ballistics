import { expect, type Page, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { loadForm } from './workbench.ts'

// throwaway prototype of #827: published load rows next to the simulation, behind ?proto= only
// rows match by cartridge, powder record and printed bullet mass (175 gr), not by bullet record
const load = 'cartridge=308-win&bullet=cutting-edge-m-308-175-fcg'

test.beforeEach(({ page }) => storeUnits(page))

/** Runs the 175 gr load; 308 Win. has no capacity record, so the test types one (a test input, not a record value). */
async function run(page: Page, query: string) {
  await gotoHydrated(page, `/workbench?${query}`)
  const form = loadForm(page)
  await form.getByRole('textbox', { name: /^Case capacity \(H₂O\)/ }).fill('3.75')
  await expect(form.getByRole('textbox', { name: /^Bullet travel/ })).not.toHaveValue('')
  const charge = form.getByLabel(/^Charge mass/)
  await charge.fill('2.7')
  await charge.press('Control+Enter')
  await expect(page.getByText(/^Simulation done\. /)).toBeAttached({ timeout: 15_000 })
  // a record that arrives after Run marks the result stale until the automatic run replaces it
  await expect(page.locator('.result[data-running], .result [data-stale]')).toHaveCount(0, {
    timeout: 15_000,
  })
}

test('the rows of the cited table show with the simulation, the deviation and the maker source', async ({
  page,
}) => {
  await run(page, `proto=c&${load}&powder=imr-4064`)
  await expect(page.getByText('Published loads: 2 matching')).toBeVisible()
  await page.getByRole('button', { name: 'Show rows' }).click()
  const table = page.getByRole('table', { name: /^Published loads/ })
  await expect(table.getByRole('row')).toHaveCount(3)
  await expect(
    table.getByRole('link', { name: 'Hodgdon Powder Co., page 117' }).first(),
  ).toHaveAttribute('href', /AM25\.pdf$/)
  await expect(table).toContainText('45,200 PSI')
  await expect(table).toContainText(/band ±7[.,]2 %/)
  await expect(table).toContainText(/band ±37[.,]9 %/)
})

test('a crusher row is compared by velocity only', async ({ page }) => {
  await run(page, `proto=a&${load}&powder=hodgdon-varget`)
  // at 1280 px the tab does not fit its row and sits in the More menu
  const tab = page.getByRole('tab', { name: 'Published loads' })
  if (await tab.isVisible()) await tab.click()
  else {
    await page.locator('.tabs-more').click()
    await page.getByRole('menuitem', { name: 'Published loads' }).click()
  }
  const table = page.getByRole('table', { name: /^Published loads/ })
  await expect(table).toContainText('42,600 CUP')
  await expect(
    table.getByText('Crusher pressure (CUP, LUP): compared by velocity only'),
  ).toHaveCount(2)
  await expect(table).toContainText(/band ±7[.,]2 %/)
})

test('the workbench without the flag shows no published loads', async ({ page }) => {
  await run(page, `${load}&powder=imr-4064`)
  await expect(page.getByRole('tab', { name: 'Published loads' })).toHaveCount(0)
  await expect(page.getByText(/^Published loads/)).toHaveCount(0)
})
