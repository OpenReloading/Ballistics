import { expect, type Page, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { inversions, type Stop } from './tab-order.ts'
import { putRecords } from './user-store.ts'

const sizes = [
  [1280, 650],
  [390, 844],
] as const

const load = (n: number) => ({
  kind: 'load',
  id: `00000000-0000-4000-8000-00000000000${n}`,
  name: `Home test load ${n}`,
  saved: `2026-10-2${n}T10:00:00.000Z`,
  data: { origin: 'user', charge: { value: 40 + n } },
})

/** Opens the home page with `records` in the browser store and the layout shifts summed from the start. */
async function openHome(page: Page, records: object[]) {
  await page.addInitScript(() => {
    const w = window as unknown as { shift: number }
    w.shift = 0
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number }[]) w.shift += e.value
    }).observe({ type: 'layout-shift', buffered: true })
  })
  await gotoHydrated(page, '/')
  if (records.length > 0) {
    await putRecords(page, records)
    await gotoHydrated(page, '/')
  }
  const strip = page.getByRole('navigation', { name: 'Continue' })
  await expect(strip.locator(records.length > 0 ? 'a' : 'p').first()).toBeVisible()
  // layout shift entries arrive after the frame that moved
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 500))))
  return strip
}

const shift = (page: Page) => page.evaluate(() => (window as unknown as { shift: number }).shift)

for (const [width, height] of sizes)
  for (const seeded of [true, false])
    test(`at ${width} x ${height} the Continue line moves nothing, ${seeded ? 'with' : 'without'} saved loads`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height })
      const strip = await openHome(page, seeded ? [1, 2, 3, 4].map(load) : [])
      expect(await shift(page)).toBe(0)
      await expect(page.getByRole('link', { name: 'Open load workbench' })).toBeInViewport({
        ratio: 1,
      })
      if (seeded)
        expect(await strip.getByRole('link').allTextContents()).toEqual([
          'Home test load 4',
          'Home test load 3',
          'Home test load 2',
        ])
      else await expect(strip).toHaveText('Loads you save show here.')
    })

test('an entry of the Continue line opens its load in the workbench', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const strip = await openHome(page, [load(1), load(2)])
  await strip.getByRole('link', { name: 'Home test load 1' }).click()
  await expect(page).toHaveURL(/\/workbench\/?$/)
  await expect(page.locator('.file-state')).toContainText('Home test load 1')
})

for (const [width, height] of sizes)
  test(`at ${width} x ${height} the keyboard order of the home page equals its visual order`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await openHome(page, [load(1), load(2), load(3)])
    const main = page.locator('main')
    // the first shown stop: below 75em the page bar's labelled Safety button is hidden
    await main.evaluate((m) =>
      [...m.querySelectorAll<HTMLElement>('a, button')].find((e) => e.checkVisibility())?.focus(),
    )
    const stops: Stop[] = []
    for (let i = 0; i < 60; i++) {
      const stop = await main.evaluate((m): Stop | null => {
        const e = document.activeElement as HTMLElement | null
        if (!e || !m.contains(e)) return null
        // the blocks: the Continue line and each card, read card by card; a stop counts the blocks it is in or after
        const block = [...m.querySelectorAll('.home-continue, .home-cards > li')].filter(
          (c) =>
            c.compareDocumentPosition(e) &
            (Node.DOCUMENT_POSITION_FOLLOWING | Node.DOCUMENT_POSITION_CONTAINED_BY),
        ).length
        const r = e.getBoundingClientRect()
        const y = r.top + window.scrollY + r.height / 2
        return {
          name: e.textContent ?? '',
          key: [block, Math.round(y), Math.round(r.left + r.width / 2)],
        }
      })
      if (!stop) break
      stops.push(stop)
      await page.keyboard.press('Tab')
    }
    expect(stops.length).toBeGreaterThan(5)
    expect(inversions(stops)).toEqual([])
  })
