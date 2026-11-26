import { expect, type Page, test } from '@playwright/test'
import { AxeBuilder, tall } from './a11y.ts'
import { storeUnits } from './units.ts'

// proof only: target-size of the designer at scroll offsets of the fields' scroll box around the one the fills leave

test.beforeEach(({ page }) => storeUnits(page))

const field = (page: Page, label: string, unit = 'mm') =>
  page.getByRole('textbox', { name: `${label} (${unit})`, exact: true })

for (const height of [720, tall])
test(`designer target-size by the scroll of the fields, window ${height} px`, async ({ page }) => {
  test.setTimeout(240_000)
  await page.setViewportSize({ width: 1280, height })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('./cartridges/designer?from=308-win')
  await expect(field(page, 'Cartridge L3')).toHaveValue('51.18')
  await field(page, 'Cartridge P1').fill('12.5')
  await field(page, 'Cartridge L1').fill('-1')
  await expect(field(page, 'Cartridge L1')).toHaveAttribute('aria-invalid', 'true')
  const scroller = await field(page, 'Cartridge L1').evaluate((input) => {
    let el: Element | null = input.parentElement
    while (el) {
      const y = getComputedStyle(el).overflowY
      if ((y === 'auto' || y === 'scroll') && el.scrollHeight > el.clientHeight) {
        el.setAttribute('data-proof-scroller', '')
        return `${el.localName}.${[...el.classList].join('.')}`
      }
      el = el.parentElement
    }
    document.scrollingElement?.setAttribute('data-proof-scroller', '')
    return 'document'
  })
  const box = page.locator('[data-proof-scroller]')
  const fits = await page
    .locator('.designer .workspace-inputs')
    .evaluate((el) => `${el.scrollHeight} ${el.clientHeight}`)
  const at = await box.evaluate((el) => el.scrollTop)
  const start = await page
    .locator('.designer-start')
    .evaluate((el) => JSON.stringify(el.getBoundingClientRect()))
  const results: string[] = []
  for (let d = -64; d <= 64; d += 8) {
    await box.evaluate((el, y) => {
      el.scrollTop = y
    }, at + d)
    const { violations } = await new AxeBuilder({ page }).withRules(['target-size']).analyze()
    results.push(
      `${d}: ${violations.flatMap((v) => v.nodes.map((n) => `${n.target} ${n.html.slice(0, 120)} ${JSON.stringify(n.any.map((c) => c.data))}`)).join(' | ')}`,
    )
  }
  expect({ fits, scroller, at, start, results }).toEqual({})
})
