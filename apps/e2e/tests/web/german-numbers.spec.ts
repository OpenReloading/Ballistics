import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { applyExampleLoad, loadForm } from './workbench.ts'

test.beforeEach(({ page }) => storeUnits(page))

test('under German the workbench writes and takes a decimal comma and its results show it', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.addInitScript(() => localStorage.setItem('language', 'de'))
  await gotoHydrated(page, '/workbench')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await applyExampleLoad(page)

  const charge = loadForm(page).getByLabel(/^Charge mass/)
  await expect(charge).toHaveValue('2,40')
  const line = page.locator('.result').getByText(/^Simulation done\. /)
  // a comma and a point both give the value; the result writes the comma
  for (const [typed, shown] of [
    ['2,5', '2,50'],
    ['2.6', '2,60'],
  ] as const) {
    await charge.fill(typed)
    await charge.press('Control+Enter')
    await expect(line).toContainText(`Step 0, ${shown} g: `, { timeout: 15_000 })
  }
  // leaving the field writes the value as the language does
  await charge.blur()
  await expect(charge).toHaveValue('2,6')

  // what the run computed has no decimal point
  const keys = page.locator('.readout-keys').first()
  await expect(keys).toContainText(/\d,\d/)
  expect(await keys.innerText()).not.toMatch(/\d\.\d/)

  // a pasted text goes in at the caret, as a native paste does
  await charge.evaluate((el: HTMLInputElement) => {
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
    const clipboardData = new DataTransfer()
    clipboardData.setData('text', '1')
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }),
    )
  })
  await expect(charge).toHaveValue('2,61')

  const { violations } = await new AxeBuilder({ page })
    .include('[role="form"]')
    .include('.readout-keys')
    .analyze()
  expect(violations.map((v) => v.id)).toEqual([])
})
