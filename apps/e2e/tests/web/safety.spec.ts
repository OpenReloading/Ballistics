import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { safetyAck } from './nav.ts'

// a first visit: nothing accepted yet
test.use({ storageState: { cookies: [], origins: [] } })

test('the Safety notice must be accepted on the first visit and stays accepted', async ({
  page,
}) => {
  await page.goto('/workbench')
  const dialog = page.getByRole('dialog', { name: /Safety notice and disclaimer/ })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'I accept' }).click()
  await expect(dialog).toBeHidden()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Load workbench' })).toBeVisible()
  await expect(dialog).toBeHidden()
})

test('an acceptance of the earlier Safety text asks again', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('safety-ack', '2'))
  await page.goto('/')
  const dialog = page.getByRole('dialog', { name: /Safety notice and disclaimer/ })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Reloading ammunition is dangerous.')
  // English only: no translation, no line about which text binds
  await expect(dialog.locator('[lang="de"]')).toHaveCount(0)
  await expect(dialog).not.toContainText('binding')
})

test('the first focus is on the text: Enter neither accepts nor declines', async ({ page }) => {
  await page.goto('/cartridges')
  const dialog = page.getByRole('dialog', { name: /Safety notice and disclaimer/ })
  const text = dialog.locator('.safety-text')
  await expect(text).toBeFocused()
  await expect(text).toContainText('By selecting I accept')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/cartridges\/$/)
  await expect(dialog).toBeVisible()
  await expect(text).toBeFocused()
  await page.reload()
  await expect(dialog).toBeVisible()
})

test('Decline leaves the site for the empty page, naming no other site', async ({ page }) => {
  await page.goto('/')
  const origin = new URL(page.url()).origin
  const away: string[] = []
  page.on('request', (r) => {
    if (!r.url().startsWith(origin)) away.push(r.url())
  })
  await page.getByRole('button', { name: 'Decline' }).click()
  await expect(page).toHaveURL('about:blank')
  expect(away).toEqual([])
})

test('the yellow Safety button of the top bar opens the Safety notice; print hides it', async ({
  page,
}) => {
  await page.addInitScript((value) => localStorage.setItem('safety-ack', value), safetyAck)
  const dialog = page.getByRole('dialog', { name: /Safety notice and disclaimer/ })
  // the page bar from 75em, named by its text; the phone top bar below, icon only
  for (const [width, bar, name, label] of [
    [1280, '.page-bar', 'Safety', 'Safety'],
    [390, 'header', 'Safety notice', ''],
  ] as const) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/cartridges')
    const button = page
      .locator(bar)
      .getByRole('button', { name, exact: true })
      .locator('visible=true')
    await expect(button).toHaveText(label)
    // light yellow, the caution note's colours: no longer the filled yellow of I accept
    await expect(button).toHaveCSS('background-color', 'rgb(255, 243, 191)')
    await expect(button).toHaveCSS('color', 'rgb(92, 68, 0)')
    await page.emulateMedia({ media: 'print' })
    await expect(button).toHaveCount(0)
    await page.emulateMedia({ media: 'screen' })
    await button.click()
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Reloading ammunition is dangerous.')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  }
})

test('at 390 x 640 I accept and Decline are in view without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 })
  await page.goto('/')
  const dialog = page.getByRole('dialog', { name: /Safety notice and disclaimer/ })
  await expect(dialog).toHaveCSS('opacity', '1')
  for (const name of ['I accept', 'Decline'])
    await expect(dialog.getByRole('button', { name })).toBeInViewport({ ratio: 1 })
})

test('the buttons of the Safety notice pass the axe contrast check in light and dark', async ({
  page,
}) => {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await page.goto('/powders')
    await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', colorScheme)
    const dialog = page.getByRole('dialog', { name: /Safety notice and disclaimer/ })
    await expect(dialog.getByRole('button', { name: 'I accept' })).toBeVisible()
    // the opening transition ends at full opacity: axe measures the final colours
    await expect(dialog).toHaveCSS('opacity', '1')
    const { violations, passes } = await new AxeBuilder({ page })
      .include('[role="dialog"] .mantine-Group-root')
      .withRules(['color-contrast'])
      .analyze()
    expect(violations.map((v) => `${colorScheme}: ${v.id}`)).toEqual([])
    expect(passes.map((p) => p.id)).toContain('color-contrast')
  }
})

test('the Safety buttons pass the axe contrast check in light and dark at 1280 and 390 px', async ({
  page,
}) => {
  await page.addInitScript((value) => localStorage.setItem('safety-ack', value), safetyAck)
  for (const colorScheme of ['light', 'dark'] as const)
    for (const width of [1280, 390]) {
      await page.emulateMedia({ colorScheme })
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/powders')
      await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', colorScheme)
      const { violations, passes } = await new AxeBuilder({ page })
        .include('.safety-light')
        .withRules(['color-contrast'])
        .analyze()
      expect(violations.map((v) => `${colorScheme} ${width}: ${v.id}`)).toEqual([])
      // the labelled button's text was checked, not skipped
      if (width === 1280) expect(passes.map((p) => p.id)).toContain('color-contrast')
    }
})
