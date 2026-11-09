import { expect, type Page } from '@playwright/test'
import { barButton } from './bar.ts'

/** The workbench's input column: panels Cartridge, Bullet, Powder, Gun and the Run bar. */
export const loadForm = (page: Page, name = 'Load') => page.getByRole('form', { name })

/** The text of every field of the load form. */
export const formValues = (page: Page) =>
  loadForm(page)
    .getByRole('textbox')
    .evaluateAll((els) =>
      els.map((e) => [e.getAttribute('aria-label') ?? '', (e as HTMLInputElement).value]),
    )

/** An item of the page bar's Open menu that starts a new load on the fresh workbench, `open` named in the page's language. */
async function openItem(page: Page, name: string | RegExp, open = 'Open') {
  const item = page.getByRole('menuitem', { name })
  // the new load replaces the start card, at once
  const startCard = page.locator('.start-card')
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' })
  await startCard.waitFor({ state: 'attached' })
  // retried: the menu can close again before the item's click while an applied example still loads; a click that lands after its timeout has started the load, and another would ask to discard it
  await expect(async () => {
    if ((await startCard.count()) === 0) return
    if (!(await item.isVisible())) await (await barButton(page, open)).click({ timeout: 1000 })
    await item.click({ timeout: 1000 })
  }).toPass({ timeout: 10_000 })
}

/** Applies the example load to the fresh workbench and waits until it is complete, so a run sees all its values. */
export async function applyExampleLoad(page: Page, language: 'en' | 'de' = 'en') {
  await (language === 'de'
    ? openItem(page, 'Beispiel-Laborierung', 'Öffnen')
    : openItem(page, 'Example load'))
  // complete once its bullet is seated: volume and travel follow the seating
  await expect(
    loadForm(page, language === 'de' ? 'Laborierung' : 'Load').locator('.field-flag-seating'),
  ).toHaveCount(2)
}
