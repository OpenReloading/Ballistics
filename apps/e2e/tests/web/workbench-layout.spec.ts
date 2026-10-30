import { expect, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { inversions, tabStops } from './tab-order.ts'
import { storeUnits } from './units.ts'
import { applyExampleLoad, loadForm } from './workbench.ts'

test.beforeEach(({ page }) => storeUnits(page))

/** The layout shifts of the workbench inputs, summed by the page. */
type InputShifts = {
  inputShift: number
  addShifts: (l: PerformanceEntryList) => void
  shifts: PerformanceObserver
}

const sizes = [
  [1280, 650],
  [390, 844],
] as const

for (const [width, height] of sizes)
  test(`at ${width} x ${height} the keyboard order of the workbench inputs equals their visual order`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await gotoHydrated(page, '/workbench')
    await applyExampleLoad(page)
    const stops = await tabStops(loadForm(page))
    expect(stops.length).toBeGreaterThan(20)
    expect(inversions(stops)).toEqual([])
  })

for (const [width, height] of sizes)
  test(`at ${width} x ${height} typing the charge shifts none of the workbench inputs`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const w = window as unknown as InputShifts
      w.inputShift = 0
      // every shift, also those right after input: an edit that moves the inputs counts
      w.addShifts = (list) => {
        for (const e of list as unknown as {
          value: number
          sources: { node?: Node }[]
        }[])
          if (
            e.sources.some((s) =>
              (s.node instanceof Element ? s.node : s.node?.parentElement)?.closest(
                '.workspace-inputs',
              ),
            )
          )
            w.inputShift += e.value
      }
      w.shifts = new PerformanceObserver((list) => w.addShifts(list.getEntries()))
      w.shifts.observe({ type: 'layout-shift', buffered: true })
    })
    await page.setViewportSize({ width, height })
    await gotoHydrated(page, '/workbench')
    await applyExampleLoad(page)
    const charge = loadForm(page).getByLabel(/^Charge mass/)
    await page.evaluate(() => {
      ;(window as unknown as { inputShift: number }).inputShift = 0
    })
    for (const text of ['60', '9']) {
      await charge.fill('')
      await charge.pressSequentially(text, { delay: 50 })
      await expect(charge).toHaveValue(new RegExp(`^${text}`))
    }
    expect(
      await page.evaluate(async () => {
        const w = window as unknown as InputShifts
        // once the frame drawn now has rendered, with the entries the observer still queues
        await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
        w.addShifts(w.shifts.takeRecords())
        return w.inputShift
      }),
    ).toBe(0)
  })
