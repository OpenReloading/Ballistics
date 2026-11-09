import { expect, type Page } from '@playwright/test'

/** Writes the stored choice as Settings writes it, and the language module follows it as it follows a change made in another tab. */
export async function showGerman(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('language', 'de')
    window.dispatchEvent(new StorageEvent('storage', { key: 'language', newValue: 'de' }))
  })
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
}
