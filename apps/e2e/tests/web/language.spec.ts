import AxeBuilder from '@axe-core/playwright'
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
  await dialog.getByRole('tab', { name: 'Einheiten' }).click()
  await expect(dialog.getByRole('radiogroup', { name: 'Voreinstellung' })).toBeVisible()
  await expect(dialog).toHaveCSS('opacity', '1')
  expect(
    (
      await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze()
    ).violations,
  ).toEqual([])
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.getByText(lead.de)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Werkzeuge' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Patronen' })).toBeVisible()
  // the page and the dialog in German have no accessibility violation, the page language included
  const axe = () =>
    new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
  expect((await axe().analyze()).violations).toEqual([])
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

test('the Database list and a record page in German have no accessibility violation', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('language', 'de'))
  const axe = () =>
    new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])

  await gotoHydrated(page, '/cartridges/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.getByRole('heading', { level: 1, name: 'Patronen' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Treibladungspulver' })).toBeVisible()
  await expect(page.getByRole('searchbox')).toHaveAttribute('placeholder', /Alias/)
  expect((await axe().analyze()).violations).toEqual([])

  await gotoHydrated(page, '/cartridges/308-win/')
  await expect(page.getByRole('link', { name: 'In der Werkbank verwenden' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /^Quellen/ })).toBeVisible()
  expect((await axe().analyze()).violations).toEqual([])
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

test.describe('Safety notice', () => {
  // a first visit: nothing accepted yet
  test.use({ storageState: { cookies: [], origins: [] } })

  test('German stands beside the English text, each with the line that English is binding', async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem('language', 'de'))
    const dialog = page.getByRole('dialog', { name: 'Sicherheitshinweis und Haftungsausschluss' })
    const english = dialog.locator('[lang="en"]').first()
    const german = dialog.locator('[lang="de"]').first()
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/')
      await expect(dialog).toBeVisible()
      await expect(dialog).toHaveCSS('opacity', '1')
      await expect(english).toContainText('Reloading ammunition is dangerous.')
      await expect(english).toContainText('The English text is binding.')
      await expect(german).toContainText('Wiederladen von Munition')
      await expect(german).toContainText('verbindlich')
      const [e, g] = await Promise.all([english.boundingBox(), german.boundingBox()])
      // side by side on a wide screen, the translation below the English text on a narrow one
      if (width > 800) expect(g?.x).toBeGreaterThan((e?.x ?? 0) + (e?.width ?? 0) - 1)
      else expect(g?.y).toBeGreaterThan((e?.y ?? 0) + (e?.height ?? 0) - 1)
      // the first focus stays on the text
      await expect(dialog.locator('.safety-text')).toBeFocused()
      expect(
        (
          await new AxeBuilder({ page })
            .include('[role="dialog"]')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze()
        ).violations,
      ).toEqual([])
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Ich akzeptiere' }).click()
    await expect(dialog).toBeHidden()
  })
})
