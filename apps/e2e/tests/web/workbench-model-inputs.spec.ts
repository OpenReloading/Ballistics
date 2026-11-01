import { expect, type Page, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { putRecords } from './user-store.ts'
import { loadForm } from './workbench.ts'

test.beforeEach(({ page }) => storeUnits(page))

const saved = '2026-10-26T10:00:00.000Z'

/** A firearm of the library with measured bore and groove diameters and freebore, mm. */
const measuredRifle = {
  kind: 'firearm',
  id: 'firearm-measured',
  name: 'Measured rifle',
  saved,
  data: {
    origin: 'user',
    name: 'Measured rifle',
    cartridge: 'catalogue:308-win',
    barrelLength: { value: 610 },
    twistHand: 'right',
    boreDiameter: { value: 7.65 },
    grooveDiameter: { value: 7.85 },
    freebore: { value: 1.5 },
    optics: [],
    configurations: [],
  },
}

/** A brass group with a measured trim length, mm. */
const trimmedBrass = {
  kind: 'case',
  id: '6e7f8091-2b3c-4d5e-9f60-7a8b9c0d1e2f',
  name: 'Trimmed brass',
  saved,
  data: {
    origin: 'user',
    name: 'Trimmed brass',
    cartridge: 'catalogue:308-win',
    material: 'brass',
    trimLength: { value: 50.8 },
  },
}

const field = (page: Page, name: RegExp) => loadForm(page).getByRole('textbox', { name })
const row = (page: Page, term: string) =>
  page.locator('.seating-row').filter({ has: page.getByText(term, { exact: true }) })

test("a firearm's measured bore diameter and freebore and a brass group's trim length reach the load", async ({
  page,
}) => {
  await gotoHydrated(page, '/firearms')
  await putRecords(page, [measuredRifle, trimmedBrass])
  await gotoHydrated(page, '/workbench?cartridge=308-win&bullet=demo-bullet-168')
  const more = page.getByRole('button', { name: 'More of Cartridge' })
  await more.click()
  const jump = row(page, 'Jump to the leade')
  await expect(jump).toBeVisible()
  const chamberJump = await jump.textContent()
  await page.keyboard.press('Escape')

  await loadForm(page).getByRole('combobox', { name: 'Firearm from your library' }).click()
  await page.getByRole('option', { name: 'Measured rifle' }).click()
  // the measured bore diameter replaces the CIP F, which the mark names
  const bore = field(page, /^Bore diameter/)
  await expect(bore).toHaveValue('7.65')
  await expect(bore).toHaveAccessibleDescription(
    /From your firearm Measured rifle\. The cartridge record gives 7\.62 mm\./,
  )
  // the leade starts at the freebore: the jump moves and the notes say why
  await more.click()
  await expect(jump).not.toHaveText(chamberJump ?? '')
  await expect(page.getByText(/measured freebore past the chamber L3/).first()).toBeVisible()
  await page.keyboard.press('Escape')

  // the brass group's trim length is the case length, marked with the CIP L3
  await page.getByRole('combobox', { name: 'Brass record' }).click()
  await page.getByRole('option', { name: 'Trimmed brass (your brass)' }).click()
  const caseLength = field(page, /^Case length L3/)
  await expect(caseLength).toHaveValue('50.80')
  await expect(caseLength).toHaveAccessibleDescription(
    /Trim length of your brass group Trimmed brass\. The CIP L3 is 51\.18 mm\./,
  )
})

test('the powder choosers hide powders without burn values until the filter is off, and such a powder cannot run', async ({
  page,
}) => {
  await gotoHydrated(page, '/workbench?cartridge=308-win')
  const search = loadForm(page).getByRole('combobox', { name: /^Search powders/ })
  await search.fill('Titewad')
  await expect(page.getByText('No powder found')).toBeVisible()

  await loadForm(page).getByRole('button', { name: 'Browse powders' }).click()
  const dialog = page.getByRole('dialog', { name: 'Choose a powder' })
  const box = dialog.getByRole('combobox', { name: 'Search powders' })
  await box.fill('Titewad')
  await expect(dialog.getByRole('option')).toHaveCount(0)
  const filter = dialog.getByRole('switch', { name: 'Complete records only' })
  await expect(filter).toBeChecked()
  await filter.click({ force: true })
  const option = dialog.getByRole('option').filter({ hasText: 'Titewad' })
  await expect(option).toContainText('Values missing')
  await option.click()

  // the card names what is missing and the two ways on; Run refuses with the same reason
  await expect(page.getByText(/Titewad has no burn values, so it cannot run\./)).toBeVisible()
  await expect(
    loadForm(page).getByRole('link', { name: 'Choose a similar powder on the burn-rate chart' }),
  ).toHaveAttribute('href', /\/powders\/burn-rates/)
  await page.getByRole('button', { name: 'Run simulation' }).click()
  await expect(page.getByText(/on the tuning page\.$/).first()).toBeVisible()

  // the filter is kept per browser
  await page.reload()
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' })
  await loadForm(page).getByRole('button', { name: 'Browse powders' }).click()
  await expect(dialog.getByRole('switch', { name: 'Complete records only' })).not.toBeChecked()
})
