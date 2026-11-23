import { expect, type Page } from '@playwright/test'
import { storageName } from './edition.ts'

/** Writes the stored choice as Settings writes it, and the language module follows it as it follows a change made in another tab. */
export async function showGerman(page: Page) {
  await page.evaluate((store) => {
    localStorage.setItem(store, 'de')
    window.dispatchEvent(new StorageEvent('storage', { key: store, newValue: 'de' }))
  }, storageName('language'))
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
}
