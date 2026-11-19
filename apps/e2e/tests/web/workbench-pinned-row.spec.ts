import { expect, type Locator, type Page, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { loadForm, openKeeping, openSavedLoad } from './workbench.ts'

test.beforeEach(({ page }) => storeUnits(page))

// the Cartridge card's "Primer, brass, lots" row: each choice follows the cartridge it depends on, a lot follows its component
const row = [
  ['combobox', 'Primer'],
  ['button', 'Browse primers'],
  ['textbox', 'Primer lot'],
  ['combobox', 'Brass record'],
  // the fixture load chooses its brass: its clear button takes the place of Browse brass
  ['button', 'Clear the brass record'],
  ['textbox', 'Case lot'],
  ['combobox', 'Case capacity record'],
] as const
const names = row.map(([, name]) => name)

const rowControls = (page: Page) =>
  row.map(([role, name]) => loadForm(page).getByRole(role, { name, exact: true }))

/** Pairs of `controls` whose visual order (center, then left) is the reverse of their order in the list; centers, not tops, as a field's buttons are not as high as the field. */
async function inversions(controls: Locator[]) {
  const boxes = await Promise.all(controls.map(async (c) => (await c.boundingBox()) ?? undefined))
  const middle = (b: { y: number; height: number }) => b.y + b.height / 2
  let count = 0
  boxes.forEach((a, i) => {
    for (const b of boxes.slice(i + 1)) {
      if (!a || !b) throw new Error('a control of the row has no box')
      const dy = middle(b) - middle(a)
      if (dy < -2 || (Math.abs(dy) <= 2 && b.x < a.x)) count++
    }
  })
  return count
}

for (const [width, height] of [
  [1280, 650],
  [1366, 657],
  [390, 844],
] as const)
  test(`at ${width} x ${height} the Cartridge card holds the cartridge search in its head and primer, brass, their lots and capacity in its last row, in keyboard, visual and reading order`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await gotoHydrated(page, '/workbench')
    await openSavedLoad(page)
    const card = loadForm(page).getByRole('region', { name: 'Cartridge', exact: true })
    const search = card.getByRole('combobox', { name: 'Search cartridges by name' })
    await expect(search).toBeVisible()
    await openKeeping(page)
    const controls = [search, ...rowControls(page)]
    if (width > 390) for (const c of controls) await expect(c).toBeInViewport()
    expect(await inversions(controls)).toBe(0)

    // a disabled select (no capacity record) takes no keyboard stop
    const stops: Locator[] = []
    for (const c of controls) if (await c.isEnabled()) stops.push(c)
    await stops[1]?.focus()
    for (const c of stops.slice(2)) {
      await page.keyboard.press('Tab')
      await expect(c).toBeFocused()
    }

    const tree = await card.ariaSnapshot()
    const at = ['Search cartridges by name', ...names].map((name) => tree.indexOf(`"${name}"`))
    expect(at.every((i) => i >= 0)).toBe(true)
    expect(at).toEqual([...at].sort((a, b) => a - b))

    // a click in the middle of the chosen brass field opens its matches and keeps the choice
    const brass = loadForm(page).getByRole('combobox', { name: 'Brass record', exact: true })
    const chosen = await brass.getAttribute('placeholder')
    await brass.click()
    await expect(brass).toBeFocused()
    await expect(brass).toHaveAttribute('placeholder', chosen ?? '')
    await loadForm(page).getByRole('button', { name: 'Clear the brass record' }).click()
    await expect(loadForm(page).getByRole('button', { name: 'Browse brass' })).toBeVisible()
  })

test("the Cartridge card's More holds no primer, brass or capacity select", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 650 })
  await gotoHydrated(page, '/workbench')
  await openSavedLoad(page)
  await page.getByRole('button', { name: 'More of Cartridge' }).click()
  const more = page.locator('.more-fields[data-panel="cartridge"]')
  await expect(more.getByText('COAL, CIP maximum L6')).toBeVisible()
  for (const name of ['Primer', 'Brass record', 'Case capacity record'])
    await expect(more.getByRole('combobox', { name, exact: true })).toHaveCount(0)
})
