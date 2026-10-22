import { expect, type Page } from '@playwright/test'
import { barButton } from './bar.ts'

/** The workbench's input column: panels Cartridge, Bullet, Powder, Gun and the Run bar. */
export const loadForm = (page: Page) => page.getByRole('form', { name: 'Load' })

/** Clicks an item of the page bar's Open menu. */
async function openItem(page: Page, name: string | RegExp) {
  const item = page.getByRole('menuitem', { name })
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' })
  // retried: the menu can close again before the item's click while an applied example still loads
  await expect(async () => {
    if (!(await item.isVisible())) await (await barButton(page, 'Open')).click({ timeout: 1000 })
    await item.click({ timeout: 1000 })
  }).toPass({ timeout: 10_000 })
}

/** Applies the example load and waits until it is complete, so a run sees all its values. */
export async function applyExampleLoad(page: Page) {
  await openItem(page, 'Example load')
  // complete once its bullet is seated: volume and travel follow the seating
  await expect(loadForm(page).locator('.field-flag-seating')).toHaveCount(2)
}
