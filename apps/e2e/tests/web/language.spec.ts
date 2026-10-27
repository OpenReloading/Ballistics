import { expect, type Page, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { settingsEntry, storeUnits } from './units.ts'

test.beforeEach(({ page }) => storeUnits(page))

const lead = {
  en: 'A ballistics database with interior and exterior ballistics simulations',
  de: 'Eine Ballistik-Datenbank mit Simulationen der Innen- und Außenballistik',
}

/** Chooses `language` in Settings, General, and closes the dialog. The tab and the group are named in the language shown. */
async function choose(page: Page, language: 'English' | 'Deutsch') {
  await settingsEntry(page).click()
  const dialog = page.getByRole('dialog', { name: /^(Settings|Einstellungen)$/ })
  await dialog.getByRole('tab', { name: /^(General|Allgemein)$/ }).click()
  await dialog
    .getByRole('radiogroup', { name: /^(Language|Sprache)$/ })
    .getByText(language, { exact: true })
    .click()
  await expect(dialog.getByRole('radio', { name: language, exact: true })).toBeChecked()
  return dialog
}

test('German is chosen in Settings, switches the home page and the dialog, and is remembered', async ({
  page,
}) => {
  const problems: string[] = []
  page.on('pageerror', (e) => problems.push(e.message))
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text()))

  await gotoHydrated(page, '/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByText(lead.en)).toBeVisible()

  const dialog = await choose(page, 'Deutsch')
  await expect(dialog).toHaveAccessibleName('Einstellungen')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(dialog.getByRole('tab', { name: 'Allgemein' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.getByText(lead.de)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Werkzeuge' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Patronen' })).toBeVisible()
  // a count with the plural of the language
  await expect(
    page
      .locator('.home-count')
      .getByText(/^\d+ Datensätze?$/)
      .first(),
  ).toBeVisible()

  // remembered: the next visit starts English (the server's page), then shows the stored language
  await page.reload()
  await expect(page.getByText(lead.de)).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')

  await choose(page, 'English')
  await expect(page.getByText(lead.en)).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  expect(problems).toEqual([])
})

test.describe('offline', () => {
  // the offline layer's worker answers the reload
  test.use({ serviceWorkers: 'allow' })

  test('the German interface opens offline after a visit', async ({ page, context }) => {
    await gotoHydrated(page, '/')
    await choose(page, 'Deutsch')
    await page.keyboard.press('Escape')
    await expect(page.getByText(lead.de)).toBeVisible()
    await page.evaluate(() => navigator.serviceWorker.ready)
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

    await context.setOffline(true)
    await page.reload()
    await expect(page.getByText(lead.de)).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await context.setOffline(false)
  })
})
