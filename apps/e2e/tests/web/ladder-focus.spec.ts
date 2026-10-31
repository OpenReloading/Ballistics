import { expect, type Locator, test } from '@playwright/test'
import { storeUnits } from './units.ts'
import { loadForm } from './workbench.ts'
import { runExample } from './workbench-run.ts'

test.beforeEach(({ page }) => storeUnits(page))

/** How far the chip's focus ring reaches past each side of the strip's padding box, in px. */
const ringOverflow = (chip: Locator) =>
  chip.evaluate((label) => {
    const strip = label.closest('.ladder-cells') as HTMLElement
    const s = getComputedStyle(label)
    const reach = Number.parseFloat(s.outlineWidth) + Number.parseFloat(s.outlineOffset)
    const c = label.getBoundingClientRect()
    const r = strip.getBoundingClientRect()
    const [left, top] = [r.left + strip.clientLeft, r.top + strip.clientTop]
    return {
      style: s.outlineStyle,
      left: left - (c.left - reach),
      top: top - (c.top - reach),
      right: c.right + reach - (left + strip.clientWidth),
      bottom: c.bottom + reach - (top + strip.clientHeight),
    }
  })

for (const width of [1280, 390])
  test(`at ${width} px the focused ladder chip shows its whole focus ring`, async ({ page }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width, height: 800 })
    await runExample(page)
    const form = loadForm(page)
    await form.getByLabel(/^Ladder steps/).fill('5')
    await form.getByRole('radio', { name: 'Charge', exact: true }).check()
    await form.getByLabel(/^Step size/).fill('0.15')
    await form.getByLabel(/^Step size/).press('Control+Enter')
    // the phone layout keeps the run's ladder behind its Results tab
    const results = page.getByRole('tab', { name: 'Results', exact: true })
    if (await results.isVisible()) await results.click()
    const steps = page.getByRole('group', { name: 'Charge ladder' }).getByRole('radio')
    await expect(steps).toHaveCount(5, { timeout: 15_000 })
    const chips = page.locator('.ladder-cells > .ladder-cell')

    // the selection alone draws no outline: only the focus does
    expect(
      await page
        .locator('.ladder-cell[data-selected]')
        .evaluate((e) => getComputedStyle(e).outlineStyle),
    ).toBe('none')

    // keyboard focus, so :focus-visible applies: Home and End move to the first and the last step
    await page.locator('.ladder-cells input:checked').focus()
    for (const [key, chip] of [
      ['Home', chips.first()],
      ['End', chips.last()],
    ] as const) {
      await page.keyboard.press(key)
      await expect(chip).toHaveAttribute('data-selected')
      const ring = await ringOverflow(chip)
      expect(ring.style, key).toBe('solid')
      for (const side of ['left', 'top', 'right', 'bottom'] as const)
        expect(ring[side], `${key}: ${side}`).toBeLessThanOrEqual(0.5)
    }
  })
