import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { loadForm } from './workbench.ts'

// the Bullet card's search dialog over the two invented demo bullets (both .308, 150 and 168 gr)

const browse = (page: Page) => loadForm(page).getByRole('button', { name: 'Browse bullets' })
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Choose a bullet' })
const box = (page: Page) => dialog(page).getByRole('combobox', { name: 'Search bullets' })

test('the keyboard finds, highlights and chooses a bullet', async ({ page }) => {
  await gotoHydrated(page, '/workbench?cartridge=308-win')
  await browse(page).focus()
  await page.keyboard.press('Enter')
  await expect(box(page)).toBeFocused()
  const options = dialog(page).getByRole('option')
  await expect(options).toHaveCount(2)

  // a caliber and a weight the names do not carry as typed, a weight in grams
  for (const typed of ['308 168', '.308 168gr', '10.9g']) {
    await box(page).fill(typed)
    await expect(options).toHaveCount(1)
    await expect(options.first()).toContainText('168 gr HPBT')
  }

  await box(page).fill('demo')
  await expect(options).toHaveCount(2)
  await expect(options.first()).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowDown')
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true')
  await expect(box(page)).toHaveAttribute(
    'aria-activedescendant',
    (await options.nth(1).getAttribute('id')) ?? '',
  )
  await expect(dialog(page).getByLabel('Highlighted bullet')).toContainText('168 gr HPBT')

  // Escape leaves the choice as it was and the focus on the button
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toBeHidden()
  await expect(browse(page)).toBeFocused()
  await expect(loadForm(page).getByRole('combobox', { name: /^Search bullets/ })).toHaveAttribute(
    'placeholder',
    'Search bullets',
  )

  await page.keyboard.press('Enter')
  await box(page).fill('demo')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(dialog(page)).toBeHidden()
  await expect(loadForm(page).getByRole('combobox', { name: /^Search bullets/ })).toHaveAttribute(
    'placeholder',
    'Demo Bullets 30 Cal 168 gr HPBT Demo',
  )
})

test('Sort by reorders the result and the focus returns to the search box', async ({ page }) => {
  await gotoHydrated(page, '/workbench?cartridge=308-win')
  await browse(page).click()
  const options = dialog(page).getByRole('option')
  await expect(options).toHaveCount(2)
  const sortBy = dialog(page).getByRole('combobox', { name: 'Sort by' })
  await sortBy.click()
  await page.getByRole('option', { name: 'Heaviest first' }).click()
  await expect(options.first()).toContainText('168 gr HPBT')
  await expect(box(page)).toBeFocused()
  await sortBy.click()
  await page.getByRole('option', { name: 'Manufacturer and name' }).click()
  await expect(options.first()).toContainText('150 gr')
  await expect(box(page)).toBeFocused()
})

test("the card's own field finds a bullet by the same words as the dialog", async ({ page }) => {
  await gotoHydrated(page, '/workbench?cartridge=308-win')
  const field = loadForm(page).getByRole('combobox', { name: /^Search bullets/ })
  for (const typed of ['308 168', 'hpbt demo 10.9g'] as const) {
    await field.fill(typed)
    const options = page.getByRole('listbox', { name: 'Matches' }).getByRole('option')
    await expect(options).toHaveCount(1)
    await expect(options.first()).toContainText('168 gr HPBT')
  }
})

for (const [width, height] of [
  [1280, 800],
  [390, 844],
] as const)
  test(`the dialog has no axe violation in light and dark at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      await gotoHydrated(page, '/workbench?cartridge=308-win')
      await browse(page).click()
      await expect(dialog(page).getByRole('option')).toHaveCount(2)
      // axe reads the colours once the dialog has faded in
      await expect(dialog(page)).toHaveCSS('opacity', '1')
      // the narrow layout keeps the filters behind their button: open them too
      const filters = dialog(page).getByRole('button', { name: /^Filters/ })
      if (await filters.isVisible()) await filters.click()
      const { violations } = await new AxeBuilder({ page })
        // the page behind the dialog is no part of it
        .include('[role="dialog"]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
      expect(
        violations.map((v) => `${colorScheme} ${v.id} ${v.nodes.map((n) => n.target)}`),
      ).toEqual([])
    }
  })
