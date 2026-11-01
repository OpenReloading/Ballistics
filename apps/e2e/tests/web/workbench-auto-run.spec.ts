import { expect, type Page, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { settingsEntry, storeUnits } from './units.ts'
import { loadForm } from './workbench.ts'
import { runExample } from './workbench-run.ts'

// a change runs the load 600 ms after the last key; Settings > Workbench switches that off

test.beforeEach(({ page }) => storeUnits(page))

const resultLine = (page: Page) => page.locator('.result').getByText(/^Simulation done\. /)
const stale = (page: Page) => page.getByText('Inputs changed', { exact: true }).first()
const charge = (page: Page) => loadForm(page).getByLabel(/^Charge mass/)

/** Writes a charge 5 % below the shown one, as typed. */
async function lowerCharge(page: Page) {
  const shown = Number.parseFloat(await charge(page).inputValue())
  await charge(page).fill((shown * 0.95).toFixed(2))
}

test('a charge change updates the result without Run', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await runExample(page)
  const before = await resultLine(page).textContent()
  await lowerCharge(page)
  await expect(stale(page)).toBeAttached()
  await expect(resultLine(page)).not.toHaveText(before ?? '', { timeout: 15_000 })
  await expect(stale(page)).not.toBeAttached()
})

for (const [what, text] of [
  ['an empty charge', ''],
  ['a charge below 0', '-1'],
])
  test(`${what} never starts a run, the result stays marked`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await runExample(page)
    const before = await resultLine(page).textContent()
    await charge(page).fill(text)
    // longer than the wait of 600 ms: a run would have started
    await page.waitForTimeout(1500)
    await expect(stale(page)).toBeAttached()
    await expect(resultLine(page)).toHaveText(before ?? '')
  })

test('with Run automatically off, only Run runs', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await gotoHydrated(page, '/powders')
  await settingsEntry(page).click()
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  await dialog.getByRole('tab', { name: 'Workbench' }).click()
  const toggle = dialog.getByRole('switch', { name: 'Run automatically' })
  await expect(toggle).toBeChecked()
  await toggle.click()
  await expect(toggle).not.toBeChecked()
  await page.keyboard.press('Escape')

  await runExample(page)
  const before = await resultLine(page).textContent()
  await lowerCharge(page)
  await page.waitForTimeout(1500)
  await expect(stale(page)).toBeAttached()
  await expect(resultLine(page)).toHaveText(before ?? '')
  await charge(page).press('Control+Enter')
  await expect(resultLine(page)).not.toHaveText(before ?? '', { timeout: 15_000 })
})
