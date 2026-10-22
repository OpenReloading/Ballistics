import { expect, type Page, test } from '@playwright/test'

const light = 'rgb(255, 255, 255)'
const dark = 'rgb(22, 22, 22)'

// the body background as first computed, at DOMContentLoaded, before any client code runs
const recordFirstPaint = (page: Page) =>
  page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      ;(window as unknown as { firstBg: string }).firstBg = getComputedStyle(
        document.body,
      ).backgroundColor
    })
  })
const firstBg = (page: Page) =>
  page.evaluate(() => (window as unknown as { firstBg: string }).firstBg)
const bg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
const storeDark = (page: Page) =>
  page.addInitScript(() => {
    localStorage.setItem('theme', 'dark')
  })
const themeSwitch = (page: Page) => page.getByRole('button', { name: 'Dark theme' })

test('with nothing stored the system setting decides', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/cartridges/308-win')
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBeNull()
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'dark')
  expect(await bg(page)).toBe(dark)
  await expect(themeSwitch(page)).toHaveAttribute('aria-pressed', 'true')
  await page.emulateMedia({ colorScheme: 'light' })
  // the provider follows the system change in a media query listener
  await expect.poll(() => bg(page)).toBe(light)
  await expect(themeSwitch(page)).toHaveAttribute('aria-pressed', 'false')
})

test('the switch overrides the system setting and the choice survives a reload', async ({
  page,
}) => {
  await recordFirstPaint(page)
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(themeSwitch(page)).toHaveAttribute('aria-pressed', 'true')
  await themeSwitch(page).click()
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'light')
  expect(await bg(page)).toBe(light)
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(
    'light',
  )
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'light')
  expect(await firstBg(page)).toBe(light)
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('light')
  await expect(themeSwitch(page)).toHaveAttribute('aria-pressed', 'false')
})

test('a stored dark applies before the first paint', async ({ page }) => {
  await storeDark(page)
  await recordFirstPaint(page)
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/workbench')
  expect(await firstBg(page)).toBe(dark)
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'dark')
  await expect(themeSwitch(page)).toHaveAttribute('aria-pressed', 'true')
})

test('print with system dark and nothing stored is light', async ({ page }) => {
  await page.goto('/cartridges/308-win')
  await page.emulateMedia({ media: 'print', colorScheme: 'dark' })
  expect(await bg(page)).toBe(light)
  await expect(themeSwitch(page)).toBeHidden()
})

test('print with dark stored is light', async ({ page }) => {
  await storeDark(page)
  await page.goto('/cartridges/308-win')
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'dark')
  await page.emulateMedia({ media: 'print' })
  expect(await bg(page)).toBe(light)
  expect(await page.evaluate(() => getComputedStyle(document.body).color)).toBe('rgb(26, 26, 26)')
})

test('the switch is reachable by keyboard and exposes its name and pressed state', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  // pressed only once hydrated: the server renders it not pressed
  await expect(themeSwitch(page)).toHaveAttribute('aria-pressed', 'true')
  // the skip link, the top bar's wordmark, Report an issue and the repository link where the build
  // has a repository URL, then the switch (the sidebar follows)
  const stops = process.env.NEXT_PUBLIC_REPOSITORY_URL?.trim() ? 5 : 3
  for (let i = 0; i < stops; i++) await page.keyboard.press('Tab')
  await expect(themeSwitch(page)).toBeFocused()
  await page.keyboard.press('Space')
  await expect(themeSwitch(page)).toHaveAttribute('aria-pressed', 'false')
  expect(await bg(page)).toBe(light)
  await page.keyboard.press('Enter')
  await expect(themeSwitch(page)).toHaveAttribute('aria-pressed', 'true')
  expect(await bg(page)).toBe(dark)
})

for (const scheme of ['light', 'dark'] as const)
  test(`the header shows the ${scheme} wordmark as the home link`, async ({ page }) => {
    await page.addInitScript((s) => localStorage.setItem('theme', s), scheme)
    await page.goto('/cartridges/308-win')
    const logo = page
      .getByRole('banner')
      .getByRole('link', { name: 'OpenReloading Ballistics' })
      .getByRole('img', { name: 'OpenReloading Ballistics' })
    // one visible wordmark: the top bar's
    await expect(logo).toHaveCount(1)
    await expect(logo).toBeVisible()
    await expect(logo).toHaveAttribute('src', new RegExp(`ballistics-${scheme}`))
    expect(
      await logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth),
    ).toBeGreaterThan(0)
  })

test('icons are served as PNG, no social image without the origin', async ({ page, request }) => {
  await page.goto('/cartridges/308-win')
  // first(): Next.js may stream the metadata again into the head
  const head = page.locator('head')
  const hrefs = [
    await head.locator('link[rel="icon"]').first().getAttribute('href'),
    await head.locator('link[rel="apple-touch-icon"]').first().getAttribute('href'),
  ]
  await expect(head.locator('meta[property="og:image"], meta[name="twitter:image"]')).toHaveCount(0)
  for (const href of hrefs) {
    const { pathname, search } = new URL(href ?? '', page.url())
    const res = await request.get(pathname + search)
    expect(res.status(), href ?? 'missing').toBe(200)
    expect(res.headers()['content-type']).toBe('image/png')
  }
})
