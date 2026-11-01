import { expect, type Locator, type Page, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'

// a powder record: its figure and values columns are each taller than a 650 px window
const record = '/powders/demo-powder-dp40'

const box = async (l: Locator) => {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

/** The popover shown, once driver.js has scrolled to its target and placed it. */
async function popover(page: Page, title: string) {
  const p = page.locator('.driver-popover')
  await expect(p.locator('.driver-popover-title')).toHaveText(title)
  await expect(page.locator('.driver-active-element')).toBeVisible()
  // placed after the target's scroll: two equal boxes in a row
  let last = ''
  await expect
    .poll(async () => {
      const now = JSON.stringify(await box(p))
      const same = now === last
      last = now
      return same
    })
    .toBe(true)
  return p
}

test('from 75em a popover beside a target taller than the window starts below the top bar', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 650 })
  await gotoHydrated(page, record)
  await page.locator('.record-values').waitFor()
  await page.locator('.page-bar').getByRole('button', { name: 'Tour' }).click()
  const bar = await box(page.locator('.mantine-AppShell-header'))
  const actions = await box(page.locator('.page-bar-actions'))
  for (const [title, side] of [
    ['Figure', 'right'],
    ['Values', 'left'],
  ] as const) {
    const p = await popover(page, title)
    const target = await box(page.locator('.driver-active-element'))
    expect(target.height).toBeGreaterThan(650)
    // the target's top below the bar, so the popover beside it is too and leaves the actions free
    expect(target.y).toBeGreaterThanOrEqual(bar.y + bar.height)
    const at = await box(p)
    expect(at.y).toBeGreaterThanOrEqual(bar.y + bar.height)
    expect(at.y).toBeGreaterThan(actions.y + actions.height)
    // beside its target: the Values column is the right one, its popover left of it
    if (side === 'left') expect(at.x + at.width).toBeLessThanOrEqual(target.x)
    else expect(at.x).toBeGreaterThanOrEqual(target.x + target.width)
    if (title === 'Figure') {
      // a scroll during the tour places it again, still below the bar
      const scrolled = await page.evaluate(() => window.scrollY)
      await page.mouse.wheel(0, 300)
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrolled)
      // the target starts under the bar now, and driver.js places the popover again on the scroll
      await expect
        .poll(async () => (await box(page.locator('.driver-active-element'))).y)
        .toBeLessThan(bar.y + bar.height)
      await expect.poll(async () => (await box(p)).y).toBeGreaterThanOrEqual(bar.y + bar.height)
      // back to where the tour placed it, whatever room the page has below
      await page.evaluate((y) => window.scrollTo(0, y), scrolled)
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrolled)
    }
    await p.getByRole('button', { name: 'Next' }).click()
  }
})

for (const [width, height] of [
  [1280, 650],
  [1920, 900],
  [390, 844],
] as const)
  test(`at ${width} px the unseen dot sits on the Tour button`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await gotoHydrated(page, record)
    // below 75em the button is in the Page actions panel
    if (width < 1200) await page.getByRole('button', { name: 'Page actions' }).click()
    const tour = page.locator('.page-bar').getByRole('button', { name: 'Tour' })
    const dot = page.locator('.page-bar .mantine-Indicator-indicator')
    await expect(dot).toBeVisible()
    const [b, d] = [await box(tour), await box(dot)]
    // the dot's centre on the button's top right corner, within the dot's size
    expect(Math.abs(d.x + d.width / 2 - (b.x + b.width))).toBeLessThanOrEqual(8)
    expect(Math.abs(d.y + d.height / 2 - b.y)).toBeLessThanOrEqual(8)
  })
