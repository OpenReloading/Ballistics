import { expect, type Page, test } from '@playwright/test'
import { sections } from '../../../web/src/lib/sections.ts'
import { gotoHydrated } from './nav.ts'
import { putRecords } from './user-store.ts'

// Ctrl+K on every page: pages, the shell's commands and records; the workbench opens its own
// search with the same pages and commands

const search = (page: Page) => page.getByRole('dialog').filter({ has: page.locator('input') })
const field = (page: Page) =>
  page.getByRole('textbox', { name: 'Search pages, cartridges, bullets, powders and commands' })

async function open(page: Page) {
  await page.keyboard.press('Control+k')
  await expect(field(page)).toBeFocused()
}

for (const path of ['/powders', '/cartridges/308-win'])
  test(`on ${path} Ctrl+K lists the pages and the commands`, async ({ page }) => {
    await gotoHydrated(page, path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await open(page)
    await expect(search(page)).toHaveCount(1)
    const pages = sections.flatMap((s) => s.pages)
    expect(pages.length).toBeGreaterThan(0)
    for (const { label } of pages)
      await expect(search(page).getByRole('button', { name: label, exact: true })).toBeVisible()
    for (const name of ['Settings', 'Safety notice', 'Theme: dark'])
      await expect(search(page).getByRole('button', { name, exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(field(page)).toBeHidden()
  })

test('a page found by Ctrl+K opens', async ({ page }) => {
  await gotoHydrated(page, '/powders')
  await open(page)
  await field(page).fill('shot gr')
  await search(page).getByRole('button', { name: 'Shot groups', exact: true }).click()
  await expect(page).toHaveURL('/groups')
})

test('a record found by Ctrl+K opens its page', async ({ page }) => {
  await gotoHydrated(page, '/powders')
  await open(page)
  await field(page).fill('308 win')
  await search(page)
    .getByRole('button', { name: /^308 Win\., CIP/ })
    .click()
  await expect(page).toHaveURL('/cartridges/308-win')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('308 Win.')
})

test('a bullet design of this browser is found by Ctrl+K and opens in its designer', async ({
  page,
}) => {
  await gotoHydrated(page, '/powders')
  const id = '6f0f4d3e-0a43-4a43-9a3d-3a2f2e1f0c33'
  await putRecords(page, [
    {
      kind: 'bullet',
      id,
      name: 'Slug test design',
      saved: '2026-10-25T00:00:00.000Z',
      data: {
        origin: 'user',
        overrides: {
          name: 'Slug test design',
          diameter: { value: 7.823 },
          mass: { value: 10.886 },
        },
      },
    },
  ])
  await gotoHydrated(page, '/powders')
  await open(page)
  await field(page).fill('slug test')
  await search(page).getByRole('button', { name: 'Slug test design (your design)' }).click()
  await expect(page).toHaveURL(`/bullets/designer?record=${id}`)
})

test('commands found by Ctrl+K open the settings and set the theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await gotoHydrated(page, '/cartridges')
  await open(page)
  await field(page).fill('theme: dark')
  await search(page).getByRole('button', { name: 'Theme: dark', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'dark')
  await open(page)
  await field(page).fill('workbench set')
  await search(page).getByRole('button', { name: 'Workbench settings', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  await expect(dialog.getByRole('tab', { name: 'Workbench' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
})

test('the sidebar Search opens the search; at 390 px the drawer has it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await gotoHydrated(page, '/powders')
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('button', { name: 'Search', exact: true })
    .click()
  await expect(field(page)).toBeFocused()
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Navigation', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Search', exact: true }).click()
  await expect(field(page)).toBeFocused()
})

test('on the workbench Ctrl+K and the sidebar Search open one search, with the pages', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await gotoHydrated(page, '/workbench')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await open(page)
  await expect(field(page)).toHaveCount(1)
  await expect(search(page).getByRole('button', { name: 'Powders', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(field(page)).toBeHidden()
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('button', { name: 'Search', exact: true })
    .click()
  await expect(field(page)).toBeFocused()
  await expect(field(page)).toHaveCount(1)
  await field(page).fill('powders')
  await search(page).getByRole('button', { name: 'Powders', exact: true }).click()
  await expect(page).toHaveURL('/powders')
  // the site search after the workbench: still one
  await open(page)
  await expect(field(page)).toHaveCount(1)
})
