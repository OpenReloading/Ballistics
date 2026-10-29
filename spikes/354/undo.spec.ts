// biome-ignore-all lint/correctness/noUndeclaredDependencies: spike, run with the e2e workspace's Playwright
import { expect, test } from '@playwright/test'
import { gotoHydrated } from '../../apps/e2e/tests/web/nav.ts'
import { applyExampleLoad, loadForm } from '../../apps/e2e/tests/web/workbench.ts'

const blur = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())

test('Ctrl+Z outside a field undoes the workbench, one step per field', async ({ page }) => {
  await gotoHydrated(page, '/workbench')
  await applyExampleLoad(page)
  const form = loadForm(page)
  const charge = form.getByLabel(/^Charge mass/)
  const mass = form.getByLabel(/^Bullet mass/)
  const [charge0, mass0] = [await charge.inputValue(), await mass.inputValue()]
  await charge.fill('')
  await charge.pressSequentially('41.25', { delay: 30 })
  await mass.fill('')
  await mass.pressSequentially('170', { delay: 30 })
  await blur(page)
  await page.keyboard.press('Control+Z')
  await expect(mass).toHaveValue(mass0)
  await expect(charge).toHaveValue('41.25')
  await page.keyboard.press('Control+Z')
  await expect(charge).toHaveValue(charge0)
  await page.keyboard.press('Control+Shift+Z')
  await expect(charge).toHaveValue('41.25')
  await page.keyboard.press('Control+Y')
  await expect(mass).toHaveValue('170')
})

test('Ctrl+Z in a focused field stays the text undo of the field', async ({ page }) => {
  await gotoHydrated(page, '/workbench')
  await applyExampleLoad(page)
  const form = loadForm(page)
  const charge = form.getByLabel(/^Charge mass/)
  const mass = form.getByLabel(/^Bullet mass/)
  await mass.fill('')
  await mass.pressSequentially('170', { delay: 30 })
  const charge0 = await charge.inputValue()
  await charge.click()
  await charge.press('End')
  await charge.pressSequentially('5', { delay: 30 })
  await charge.press('Control+Z')
  // the workbench history did not step back: the other field keeps its edit
  await expect(mass).toHaveValue('170')
  console.log(`TEXTUNDO ${JSON.stringify({ before: charge0, after: await charge.inputValue() })}`)
})
