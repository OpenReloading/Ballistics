import AxeBuilder from '@axe-core/playwright'
import { expect, type Locator, type Page, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { settingsEntry, storeUnits } from './units.ts'

// Settings is a dialog only, no page: every entry is a button opening it over the page, on every
// route

test.beforeEach(({ page }) => storeUnits(page))

const sidebarSettings = settingsEntry
const unitsButton = (page: Page) => page.getByRole('button', { name: /^Units: / })
const stored = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('units') ?? '{}').preset)

/** Opens the dialog from `entry` and waits for it to be in view: it fades in. */
async function openFrom(page: Page, entry: Locator) {
  await expect(entry).toHaveAttribute('aria-haspopup', 'dialog')
  await entry.click()
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  await dialog.getByRole('radiogroup', { name: 'Preset' }).waitFor()
  await expect(dialog).toHaveCSS('opacity', '1')
  return dialog
}

async function choose(dialog: Locator, name: string) {
  await dialog.getByRole('radiogroup', { name: 'Preset' }).getByText(name, { exact: true }).click()
  await expect(dialog.getByRole('radio', { name, exact: true })).toBeChecked()
}

for (const path of ['/cartridges/308-win', '/firearms'])
  test(`on ${path} the sidebar Settings opens the dialog over the page`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(path)
    // the page behind keeps its place and width (its height follows content loaded after mounting)
    const place = () =>
      page.locator('main#main').evaluate((m) => {
        const r = m.getBoundingClientRect()
        return [r.left, r.top, r.width]
      })
    const before = await place()
    const dialog = await openFrom(page, sidebarSettings(page))
    expect(await place()).toEqual(before)
    await choose(dialog, 'US customary')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(path)
    await expect(sidebarSettings(page)).toBeFocused()
    expect(await stored(page)).toBe('us')
    if (path === '/firearms')
      await expect(unitsButton(page)).toHaveAccessibleName('Units: US customary')
  })

for (const path of ['/session', '/firearms'])
  test(`on ${path} the Units button opens the dialog over the page`, async ({ page }) => {
    await page.goto(path)
    const dialog = await openFrom(page, unitsButton(page))
    await choose(dialog, 'Metric, common use')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(path)
    await expect(unitsButton(page)).toBeFocused()
    await expect(unitsButton(page)).toHaveAccessibleName('Units: Metric, common use')
  })

test('Settings has no page: /settings answers 404 and no entry is a link', async ({ page }) => {
  const response = await page.goto('/settings')
  expect(response?.status()).toBe(404)
  await page.goto('/session')
  for (const entry of [sidebarSettings(page), unitsButton(page)])
    await expect(entry).not.toHaveAttribute('href')
  await expect(page.locator('a[href="/settings"]')).toHaveCount(0)
})

test('at 390 px Settings in the drawer closes the drawer, then opens the dialog', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/powders')
  const button = page.getByRole('button', { name: 'Navigation', exact: true })
  await button.click()
  await page.getByRole('dialog').getByRole('button', { name: 'Settings', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL('/powders')
  await expect(button).toBeFocused()
})

test('with unsaved firearm edits Settings and Units open the dialog without a question', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const asked: string[] = []
  page.on('dialog', (d) => {
    asked.push(d.message())
    return d.dismiss()
  })
  await page.goto('/firearms')
  await (await barButton(page, 'New firearm')).click()
  const name = page.getByRole('textbox', { name: /^Name/ })
  await name.fill('Range rifle')
  await expect(page.locator('.file-state')).toHaveText('Unsaved changes, not saved to a file')
  for (const entry of [sidebarSettings(page), unitsButton(page)]) {
    const dialog = await openFrom(page, entry)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    // nor the app's confirm dialog
    await expect(page.getByRole('dialog', { name: /\?/ })).toHaveCount(0)
  }
  await expect(page).toHaveURL('/firearms')
  await expect(name).toHaveValue('Range rifle')
  expect(asked).toEqual([])
})

test('the settings dialog over a document page passes axe in light and dark', async ({ page }) => {
  test.setTimeout(2 * 30_000)
  for (const colorScheme of ['light', 'dark'] as const)
    await test.step(
      colorScheme,
      async () => {
        await page.emulateMedia({ colorScheme })
        await page.setViewportSize({ width: 1280, height: 900 })
        await page.goto('/cartridges/308-win')
        await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', colorScheme)
        const dialog = await openFrom(page, sidebarSettings(page))
        // every tab
        for (const tab of ['Units', 'Workbench defaults', 'Appearance', 'Offline']) {
          await dialog.getByRole('tab', { name: tab }).click()
          await expect(dialog.getByRole('tabpanel', { name: tab })).toBeVisible()
          if (tab === 'Offline')
            await expect(dialog.getByRole('tabpanel', { name: tab })).toContainText(
              'Add to Home Screen',
            )
          const { violations } = await new AxeBuilder({ page })
            .include('[role="dialog"]')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze()
          expect(
            violations.map((v) => `${tab}: ${v.id} ${v.nodes.map((n) => n.target).join(' ')}`),
          ).toEqual([])
        }
      },
      { timeout: 30_000 },
    )
})

test('the tabs Units, Workbench defaults, Appearance and Offline are each reached by keyboard', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/powders')
  const dialog = await openFrom(page, sidebarSettings(page))
  const tabs = dialog.getByRole('tablist', { name: 'Settings' })
  await expect(tabs).toHaveAttribute('aria-orientation', 'vertical')
  const names = ['Units', 'Workbench defaults', 'Appearance', 'Offline']
  await expect(tabs.getByRole('tab')).toHaveText(names)
  await tabs.getByRole('tab', { name: 'Units' }).focus()
  for (const name of names.slice(1)) {
    await page.keyboard.press('ArrowDown')
    const tab = tabs.getByRole('tab', { name })
    await expect(tab).toBeFocused()
    await expect(tab).toHaveAttribute('aria-selected', 'true')
    await expect(dialog.getByRole('tabpanel', { name })).toBeVisible()
  }
  // the Units button opens the Units tab again
  await page.keyboard.press('Escape')
  await page.goto('/session')
  const again = await openFrom(page, unitsButton(page))
  await expect(again.getByRole('tab', { name: 'Units' })).toHaveAttribute('aria-selected', 'true')
})

test('Appearance stores the theme as System, Light or Dark', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/powders')
  const dialog = await openFrom(page, sidebarSettings(page))
  await dialog.getByRole('tab', { name: 'Appearance' }).click()
  const theme = dialog.getByRole('radiogroup', { name: 'Theme' })
  await expect(theme.getByRole('radio', { name: 'System' })).toBeChecked()
  const html = page.locator('html')
  await theme.getByText('Light', { exact: true }).click()
  await expect(html).toHaveAttribute('data-mantine-color-scheme', 'light')
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('light')
  await theme.getByText('Dark', { exact: true }).click()
  await expect(html).toHaveAttribute('data-mantine-color-scheme', 'dark')
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark')
  // System follows the system setting again
  await theme.getByText('System', { exact: true }).click()
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(html).toHaveAttribute('data-mantine-color-scheme', 'light')
  expect(await page.evaluate(() => localStorage.getItem('theme'))).not.toMatch(/^(light|dark)$/)
})
