import { expect, type Locator, type Page, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { applyExampleLoad, loadForm } from './workbench.ts'

test.beforeEach(({ page }) => storeUnits(page))

// the pinned row above the cards: each choice follows the cartridge it depends on, a lot follows
// its component
const row = [
  ['combobox', 'Search cartridges by name'],
  ['button', 'Browse cartridges'],
  ['combobox', 'Primer'],
  ['textbox', 'Primer lot'],
  ['combobox', 'Brass record'],
  ['textbox', 'Case lot'],
  ['combobox', 'Case capacity record'],
] as const
const names = row.map(([, name]) => name)

const rowControls = (page: Page) =>
  row.map(([role, name]) => loadForm(page).getByRole(role, { name, exact: true }))

/** Pairs of `controls` whose visual order (top, then left) is the reverse of their order in the list. */
async function inversions(controls: Locator[]) {
  const boxes = await Promise.all(controls.map(async (c) => (await c.boundingBox()) ?? undefined))
  let count = 0
  boxes.forEach((a, i) => {
    for (const b of boxes.slice(i + 1)) {
      if (!a || !b) throw new Error('a control of the row has no box')
      if (b.y < a.y - 2 || (Math.abs(b.y - a.y) <= 2 && b.x < a.x)) count++
    }
  })
  return count
}

for (const [width, height] of [
  [1280, 650],
  [1366, 657],
  [390, 844],
] as const)
  test(`at ${width} x ${height} the pinned row holds the cartridge, primer, brass, their lots and capacity in keyboard, visual and reading order`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await gotoHydrated(page, '/workbench')
    await applyExampleLoad(page)
    const controls = rowControls(page)
    if (width > 390) for (const c of controls) await expect(c).toBeInViewport()
    expect(await inversions(controls)).toBe(0)

    // a disabled select (no capacity record) takes no keyboard stop
    const stops: Locator[] = []
    for (const c of controls) if (await c.isEnabled()) stops.push(c)
    await stops[0]?.focus()
    for (const c of stops.slice(1)) {
      await page.keyboard.press('Tab')
      await expect(c).toBeFocused()
    }

    const tree = await page.locator('.pinned-row').ariaSnapshot()
    const at = names.map((name) => tree.indexOf(`"${name}"`))
    expect(at.every((i) => i >= 0)).toBe(true)
    expect(at).toEqual([...at].sort((a, b) => a - b))
  })

test("the Cartridge card's More holds no primer, brass or capacity select", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 650 })
  await gotoHydrated(page, '/workbench')
  await applyExampleLoad(page)
  await page.getByRole('button', { name: 'More of Cartridge' }).click()
  const more = page.locator('.more-fields[data-panel="cartridge"]')
  await expect(more.getByText('COAL, CIP maximum L6')).toBeVisible()
  for (const name of ['Primer', 'Brass record', 'Case capacity record'])
    await expect(more.getByRole('combobox', { name, exact: true })).toHaveCount(0)
})
