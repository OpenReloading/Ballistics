import { expect, test } from '@playwright/test'
import { sections } from '../../../web/src/lib/sections.ts'
import { exported, followNav, gotoHydrated } from './nav.ts'

const pages = sections.flatMap((s) => s.pages)
// a tool page and a data page: the links all come from `sections`, the lists below check every one
const visited = pages.filter(({ href }) => href === '/workbench' || href === '/cartridges')
// the value the web app was built with: set, the shell shows Report an issue and the repository link
const repository = process.env.NEXT_PUBLIC_REPOSITORY_URL?.trim()

test('at 1280 px a tool page and a data page are one sidebar click from a record page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/cartridges/308-win')
  expect(visited).toHaveLength(2)
  for (const { href, label } of visited) {
    await followNav(page, label)
    await expect(page).toHaveURL(exported(href))
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  }
})

test('at 390 px the drawer lists every section page under its section, and two pages are two clicks away', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/cartridges')
  const button = page.getByRole('button', { name: 'Navigation', exact: true })
  await button.click()
  const drawer = page.getByRole('dialog')
  const nav = drawer.getByRole('navigation', { name: 'Main' })
  // the sidebar's groups in order, each page under its group
  for (const s of sections)
    await expect(
      nav.getByRole('list', { name: s.title, exact: true }).getByRole('link'),
    ).toHaveText(s.pages.map((p) => p.label))
  // Search first and Settings last: no pages, buttons opening their dialogs
  await expect(nav.getByRole('button')).toHaveText([
    'Search',
    'Settings',
    ...(repository ? ['Report an issue'] : []),
  ])
  await page.keyboard.press('Escape')
  expect(visited).toHaveLength(2)
  for (const { href, label } of visited) {
    await button.click()
    await page.getByRole('dialog').getByRole('link', { name: label, exact: true }).click()
    await expect(page).toHaveURL(exported(href))
    await expect(page.getByRole('dialog')).toBeHidden()
  }
})

test('the home page lists the tools and the library with its counts, and opens the tools', async ({
  page,
}) => {
  await gotoHydrated(page, '/')
  const [tools, library] = sections
  const toolPanel = page.getByRole('region', { name: tools.title, exact: true })
  await expect(toolPanel.getByRole('heading', { level: 3 })).toHaveText(
    tools.pages.map((p) => p.label),
  )
  const libraryPanel = page.getByRole('region', { name: library.title, exact: true })
  await expect(libraryPanel.getByRole('heading', { level: 3 })).toHaveText(
    library.pages.map((p) => p.label),
  )
  // the record counts are the API's, at build time
  for (const label of ['Cartridges', 'Bullets', 'Powders', 'Targets', 'Disciplines'])
    await expect(
      libraryPanel
        .locator('.home-tabs > li')
        .filter({ has: page.getByRole('link', { name: label }) }),
    ).toContainText(/\b[1-9]\d* records?$/)
  await toolPanel.getByRole('link', { name: 'Open load workbench' }).click()
  await expect(page).toHaveURL(exported('/workbench'))
})

test('a cartridge, after a search, and a report are two clicks from the home page', async ({
  page,
}) => {
  await gotoHydrated(page, '/')
  await page
    .getByRole('region', { name: 'Library', exact: true })
    .getByRole('link', { name: 'Cartridges' })
    .click()
  await expect(page).toHaveURL(exported('/cartridges'))
  // the directory shows the rows in view: a search finds the record
  const link = page.locator('a[href="/cartridges/308-win/"]')
  await page.getByRole('searchbox', { name: 'Search' }).fill('308 win')
  await expect(link).toBeVisible()
  await link.click()
  await expect(page).toHaveURL(exported('/cartridges/308-win'))
})

test('the Database tabs follow the tabs pattern and carry the search to the next kind', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await gotoHydrated(page, '/cartridges')
  const tabs = page.getByRole('tablist', { name: 'Database' })
  await expect(tabs.getByRole('tab')).toHaveText([
    'Firearms',
    'Cartridges',
    'Brass',
    'Primers',
    'Powders',
    'Bullets',
    'Targets',
    'Disciplines',
    'Federations',
  ])
  await expect(tabs.getByRole('tab', { selected: true })).toHaveText('Cartridges')
  await page.getByRole('searchbox', { name: 'Search' }).fill('win')
  // the arrow key moves the focus only: Enter opens the tab
  await tabs.getByRole('tab', { selected: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(tabs.getByRole('tab', { name: 'Brass' })).toBeFocused()
  await expect(page).toHaveURL(/\/cartridges\/\?q=win$/)
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(exported('/cases?q=win'))
  await expect(page.getByRole('tab', { selected: true })).toHaveText('Brass')
  // the sidebar names the Database as the current page on every tab
  await expect(
    page.getByRole('navigation', { name: 'Main' }).locator('[aria-current="page"]'),
  ).toHaveAccessibleName('Database')
})

test('Report an issue opens a dialog whose link is a new issue of the repository', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await gotoHydrated(page, '/cartridges/308-win')
  const button = page.getByRole('button', { name: 'Report an issue' })
  if (!repository) return expect(button).toHaveCount(0)
  await button.click()
  const link = page
    .getByRole('dialog', { name: 'Report an issue' })
    .getByRole('link', { name: 'Open on GitHub' })
  await expect(link).toHaveAttribute('target', '_blank')
  const href = await link.getAttribute('href')
  expect(
    href?.startsWith(`${repository.replace(/\/+$/, '')}/issues/new?template=user-report.yml&`),
  ).toBe(true)
  const query = new URL(href ?? '').searchParams
  expect(query.get('title')).toMatch(/^Report: Cartridges: Bug: \S/)
  expect(query.get('context')).toContain('- Record: cartridge `308-win`')
})

test('an unknown path answers 404 with the section links', async ({ page }) => {
  const res = await page.goto('/no-such-page')
  expect(res?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found')
  await expect(page.getByText('This page could not be found.')).toBeVisible()
  const main = page.getByRole('main')
  for (const { href, label } of pages)
    await expect(main.getByRole('link', { name: label, exact: true })).toHaveAttribute(
      'href',
      exported(href),
    )
})

test('the drawer marks the current page and its rows are at least 44 px high', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/bullets')
  await page.getByRole('button', { name: 'Navigation', exact: true }).click()
  const nav = page.getByRole('dialog').getByRole('navigation', { name: 'Main' })
  await expect(nav.locator('[aria-current="page"]')).toHaveText(['Database'])
  const rows = nav.locator('a, button')
  await expect(rows).toHaveCount(pages.length + (repository ? 4 : 2))
  for (const box of await rows.evaluateAll((r) => r.map((e) => e.getBoundingClientRect().height)))
    expect(box).toBeGreaterThanOrEqual(44)
})

test('the Alpha badge gives its note by pointer and keyboard, and the open note moves nothing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/session')
  const brand = page.locator('.mantine-AppShell-header .brand')
  const note = page.getByRole('tooltip', {
    name: 'Alpha version: breaking changes are to be expected.',
  })
  await expect(brand).toHaveAccessibleDescription(
    'Alpha version: breaking changes are to be expected.',
  )
  const badge = await brand.locator('.alpha-badge').boundingBox()
  const main = await page.locator('main#main').boundingBox()
  await brand.hover()
  await expect(note).toBeVisible()
  expect(await brand.locator('.alpha-badge').boundingBox()).toEqual(badge)
  expect(await page.locator('main#main').boundingBox()).toEqual(main)
  await page.mouse.move(640, 600)
  await expect(note).toBeHidden()
  // the skip link comes first, then the home link
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(brand).toBeFocused()
  await expect(note).toBeVisible()
})

test('from 75em the top bar buttons follow the page actions in the keyboard order, as on screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 650 })
  await gotoHydrated(page, '/cartridges/308-win')
  const safety = page.locator('.page-bar').getByRole('button', { name: 'Safety', exact: true })
  const after = [...(repository ? ['Report an issue', 'Source code on GitHub'] : []), 'Dark theme']
  await safety.focus()
  let left = (await safety.boundingBox())?.x ?? 0
  for (const name of after) {
    await page.keyboard.press('Tab')
    const focused = page.locator(':focus')
    await expect(focused).toHaveAccessibleName(name)
    // each one right of the one before
    const x = (await focused.boundingBox())?.x ?? 0
    expect(x).toBeGreaterThan(left)
    left = x
  }
  // on the workbench, whose status does not fill the bar, at 1920 px too: Safety stays beside them
  await page.setViewportSize({ width: 1920, height: 900 })
  await gotoHydrated(page, '/workbench')
  const notice = page.locator('.page-bar .page-bar-safety')
  const next = page.locator('.page-bar .top-end').locator('button:visible, a:visible').first()
  const [a, b] = [await notice.boundingBox(), await next.boundingBox()]
  expect((b?.x ?? 0) - ((a?.x ?? 0) + (a?.width ?? 0))).toBeLessThanOrEqual(9)
  // below 75em they stay in the top bar, before the page bar's row
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(
    page.locator('header .top-end').getByRole('button', { name: 'Dark theme' }),
  ).toBeVisible()
})
