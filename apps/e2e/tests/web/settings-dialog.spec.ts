import { expect, type Locator, type Page, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { showGerman } from './german.ts'
import { exported, gotoHydrated } from './nav.ts'
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
    await expect(page).toHaveURL(exported(path))
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
    await expect(page).toHaveURL(exported(path))
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
  await expect(page).toHaveURL(exported('/powders'))
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
  await expect(page.locator('.file-state')).toHaveText('Unsaved')
  for (const entry of [sidebarSettings(page), unitsButton(page)]) {
    const dialog = await openFrom(page, entry)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    // nor the app's confirm dialog
    await expect(page.getByRole('dialog', { name: /\?/ })).toHaveCount(0)
  }
  await expect(page).toHaveURL(exported('/firearms'))
  await expect(name).toHaveValue('Range rifle')
  expect(asked).toEqual([])
})

test('the Manufacturers section of General deletes a user manufacturer that no record or open field names', async ({
  page,
}) => {
  // the catalogue's list answered: a name is committed at once, not after a retry
  const listed = page.waitForResponse((r) => r.url().endsWith('/api/catalogue/index.json'))
  await gotoHydrated(page, '/bullets/designer')
  await (await listed).finished()
  const field = page.getByRole('combobox', { name: 'Manufacturer' })
  // the first name stays in the browser when the text is changed after leaving the field
  await field.fill('Gone')
  await field.blur()
  await field.fill('Kept')
  await field.blur()
  const dialog = await openFrom(page, sidebarSettings(page))
  await dialog.getByRole('tab', { name: 'General' }).click()
  const panel = dialog.getByRole('region', { name: 'Manufacturers in this browser' })
  await expect(panel).toContainText('Gone unused')
  await expect(panel).toContainText('Kept used by 1')
  await expect(panel.getByRole('button', { name: 'Delete Kept' })).toHaveCount(0)
  await panel.getByRole('button', { name: 'Delete Gone' }).click()
  await expect(panel).not.toContainText('Gone')
  await expect(panel).toContainText('Kept used by 1')
})

test('the tabs General, Units and Workbench are each reached by keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/powders')
  const dialog = await openFrom(page, sidebarSettings(page))
  const tabs = dialog.getByRole('tablist', { name: 'Settings' })
  await expect(tabs).toHaveAttribute('aria-orientation', 'vertical')
  const names = ['General', 'Units', 'Workbench']
  await expect(tabs.getByRole('tab')).toHaveText(names)
  await tabs.getByRole('tab', { name: 'General' }).focus()
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

test('Appearance in General stores the theme as System, Light or Dark', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/powders')
  const dialog = await openFrom(page, sidebarSettings(page))
  await dialog.getByRole('tab', { name: 'General' }).click()
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

test('Settings turns the single-key shortcuts off: "/" and "?" do nothing, the choice stays over a reload', async ({
  page,
}) => {
  await gotoHydrated(page, '/powders')
  const search = page.getByRole('searchbox', { name: 'Search' })
  const help = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
  const press = async (key: string) => {
    await page.locator('body').click({ position: { x: 2, y: 2 } })
    await page.keyboard.type(key)
  }
  await press('/')
  await expect(search).toBeFocused()
  await expect(search).toHaveAttribute('aria-keyshortcuts', '/')

  const dialog = await openFrom(page, sidebarSettings(page))
  await dialog.getByRole('tab', { name: 'General' }).click()
  const box = dialog.getByRole('checkbox', { name: 'Single-key shortcuts' })
  await expect(box).toBeChecked()
  await expect(
    dialog.getByText('Off, they do nothing; the shortcuts with Ctrl or Cmd stay.'),
  ).toBeVisible()
  await box.uncheck()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  await expect(search).not.toHaveAttribute('aria-keyshortcuts')
  await press('/')
  await expect(search).not.toBeFocused()
  await press('?')
  await expect(help).toBeHidden()

  await gotoHydrated(page, '/powders')
  await press('?')
  await expect(help).toBeHidden()

  const again = await openFrom(page, sidebarSettings(page))
  await again.getByRole('tab', { name: 'General' }).click()
  await again.getByRole('checkbox', { name: 'Single-key shortcuts' }).check()
  await page.keyboard.press('Escape')
  await expect(again).toBeHidden()
  await press('?')
  await expect(help).toBeVisible()
})

test('the Units button shows its preset from 105em, an icon below, and its name in German', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 650 })
  await gotoHydrated(page, '/cartridges/308-win')
  const button = page.locator('.page-bar').getByRole('button', { name: /^Units: / })
  // the record's title keeps its room: the button is as wide as the bar's icon buttons
  await expect.poll(() => button.evaluate((b) => b.getBoundingClientRect().width)).toBe(36)
  // its icon in the middle
  const offCentre = await button.evaluate((b) => {
    const [r, i] = [b.getBoundingClientRect(), b.querySelector('svg')?.getBoundingClientRect()]
    return i ? Math.abs(i.left + i.width / 2 - (r.left + r.width / 2)) : Number.POSITIVE_INFINITY
  })
  expect(offCentre).toBeLessThanOrEqual(1)
  await page.setViewportSize({ width: 1920, height: 900 })
  await expect(button).toContainText('Metric (SI)')
  await expect
    .poll(() => button.evaluate((b) => b.getBoundingClientRect().width))
    .toBeGreaterThan(36)
  await showGerman(page)
  await expect(
    page.locator('.page-bar').getByRole('button', { name: /^Einheiten: Metrisch \(SI\)/ }),
  ).toContainText('Metrisch (SI)')
})
