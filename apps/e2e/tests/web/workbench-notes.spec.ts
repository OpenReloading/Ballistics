import { expect, type Page, test } from '@playwright/test'
import { choosePreset, storeUnits } from './units.ts'
import { loadForm } from './workbench.ts'
import { runExample } from './workbench-run.ts'

test.beforeEach(({ page }) => storeUnits(page))

const notes = (page: Page) => page.locator('.result-notes')
// the sampled band's note belongs to the step shown first
const band = (page: Page) => notes(page).locator('li', { hasText: /(Velocity|Sampled)/ })

/** Where the content below the notes starts: the ladder strip and the result tabs, unrounded. */
const below = (page: Page) =>
  page.evaluate(() =>
    ['.workbench-centre > .ladder-strip', '.workbench-results [role="tablist"]'].map(
      (s) => document.querySelector(s)?.getBoundingClientRect().top,
    ),
  )

test('switching steps, changing an input and the units move nothing below the notes', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await runExample(page)
  const form = loadForm(page)
  await form.getByLabel(/^Ladder steps/).fill('5')
  await form.getByLabel(/^Step size/).fill('0.15')
  await form.getByLabel(/^Step size/).press('Control+Enter')
  const steps = page.getByRole('group', { name: 'Charge ladder' }).getByRole('radio')
  await expect(steps).toHaveCount(5, { timeout: 15_000 })
  await expect(band(page)).toHaveCount(1, { timeout: 10_000 })
  const before = await below(page)
  expect(before.every((top) => typeof top === 'number')).toBe(true)

  // another step has no band: its note goes, nothing moves
  const shown = await steps.evaluateAll((radios) =>
    radios.findIndex((r) => (r as HTMLInputElement).checked),
  )
  await steps.nth(shown === 0 ? 1 : 0).check({ force: true })
  await expect(band(page)).toHaveCount(0)
  expect(await below(page)).toEqual(before)
  await steps.nth(shown).check({ force: true })
  await expect(band(page)).toHaveCount(1)
  expect(await below(page)).toEqual(before)

  // an input change marks the result stale
  await form.getByLabel(/^Charge mass/).fill('2.5')
  await expect(page.getByText('Inputs changed', { exact: true }).first()).toBeAttached()
  expect(await below(page)).toEqual(before)

  // the units of the notes change with the preset
  await choosePreset(page, 'US customary')
  await expect(band(page)).toContainText(/ft\/s|Sampled/)
  expect(await below(page)).toEqual(before)
})

test('More shows the count, its dialog lists every note, traps the focus and returns it', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await runExample(page)
  await page.getByRole('tab', { name: 'Results', exact: true }).click()
  const items = notes(page).locator('li[data-kind]')
  await expect(band(page)).toHaveCount(1, { timeout: 10_000 })
  const lines = (await items.allTextContents()).map((l) => l.replace(/^\w+: /, ''))
  expect(lines.length).toBeGreaterThan(0)
  // the count and the most important entry for screen readers
  await expect(notes(page).locator('p.visually-hidden')).toContainText(
    `${lines.length} result note`,
  )
  const more = notes(page).getByRole('button', { name: `More (${lines.length})` })
  await more.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Result notes' })
  await expect(dialog).toBeVisible()
  for (const line of lines) await expect(dialog).toContainText(line)
  await expect(dialog.locator('li')).toHaveCount(lines.length)
  // the focus stays in the dialog
  for (let k = 0; k < 4; k++) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(more).toBeFocused()
})
