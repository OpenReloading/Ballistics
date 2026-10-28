import type { Page } from '@playwright/test'

/**
 * A button of the page bar's actions; below 75em "Page actions"
 * opens them first, a chosen action closes them again.
 */
export async function barButton(page: Page, name: string | RegExp, toggleName = 'Page actions') {
  const toggle = page.getByRole('button', { name: toggleName }).locator('visible=true')
  if ((await toggle.count()) > 0 && (await toggle.getAttribute('aria-expanded')) === 'false')
    await toggle.click()
  return page
    .locator('.page-bar-actions')
    .locator('visible=true')
    .getByRole('button', typeof name === 'string' ? { name, exact: true } : { name })
}
