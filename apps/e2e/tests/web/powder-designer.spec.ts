import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { putRecords } from './user-store.ts'
import { loadForm } from './workbench.ts'

// A powder entered in the designer is checked against the powder schema while it is typed, kept in
// the browser, and chosen in the workbench's Powder card as the user's own design
// Metric (SI): g/cm3, bar, degC, MJ/kg, cm3/g
test.beforeEach(({ page }) => storeUnits(page))

/** The burn law of an invented powder, as the fields show it. */
const burnLaw: [string, string][] = [
  ['Vivacity', '0.612'],
  ['Specific energy', '3.95'],
  ['Gamma', '1.215'],
  ['Covolume', '0.97'],
  ['Grain density', '1.6'],
  ['Pressure exponent', '1'],
  ['Reference pressure', '0.980665'],
  ['Ignition pressure', '50'],
  ['Propellant temperature', '21'],
  ['Form a', '0.05'],
  ['Form m', '0.5'],
  ['Form q', '0.5'],
  ['Form z1', '0.8'],
]

// the accessible name of a number field ends in its unit: `Vivacity (1/s)`
const field = (page: Page, name: string) =>
  page.getByRole('spinbutton', { name: new RegExp(`^${name}( \\(|$)`) })

async function design(page: Page) {
  await gotoHydrated(page, '/powders/designer')
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Mine DP')
  await page.getByLabel('Values came about by').selectOption({ label: 'Fitted to data' })
  await page.getByRole('checkbox', { name: 'Vivacity' }).check()
  for (const [label, value] of burnLaw) await field(page, label).fill(value)
}

/** A design as the designer saves it, in stored units. */
const record = {
  kind: 'powder',
  id: '5d4c3b2a-1f0e-4d9c-8b7a-6a5f4e3d2c1b',
  name: 'Mine DP',
  saved: '2026-10-26T00:00:00.000Z',
  data: {
    origin: 'user',
    provenanceKind: 'fitted',
    draft: {
      grainForm: 'extruded',
      bulkDensity: { value: 0.9 },
      interior: {
        model: 'm3',
        fitted: ['vivacity'],
        vivacity: { value: 0.612 },
        energy: { value: 3950000 },
        gamma: 1.215,
        covolume: { value: 0.00097 },
        density: { value: 1.6 },
        pressureExponent: 1,
        referencePressure: { value: 0.980665 },
        ignitionPressure: { value: 50 },
        propellantTemperature: { value: 21 },
        burnForm: { kind: 'twoStage', a: { value: 0.05 }, m: 0.5, q: 0.5, z1: 0.8 },
      },
    },
  },
}

test('checks the draft against the powder schema at its fields', async ({ page }) => {
  await design(page)
  await expect(page.getByText('Usable in the workbench as Mine DP')).toBeVisible()
  await field(page, 'Gamma').fill('0.9')
  await expect(field(page, 'Gamma')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Usable in the workbench')).toBeHidden()
  await field(page, 'Gamma').fill('1.215')
  await page.getByLabel('Values came about by').selectOption({ label: 'Measured' })
  await expect(page.getByLabel('Values came about by')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Usable in the workbench')).toBeHidden()
})

test('keeps the draft in the browser and reopens it from the Open menu', async ({ page }) => {
  await design(page)
  await expect(page.getByText('Saved in this browser')).toBeVisible()
  await gotoHydrated(page, '/powders/designer')
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('')
  await page.getByRole('button', { name: 'Open' }).click()
  await page.getByRole('menuitem', { name: /Saved powder designs/ }).click()
  await page.getByRole('button', { name: 'Mine DP', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Mine DP')
  await expect(field(page, 'Form z1')).toHaveValue('0.8')
})

test('a powder design fills the model values, is marked and named in the run and the print', async ({
  page,
}) => {
  await page.goto('/workbench')
  await putRecords(page, [record])
  await page.reload()
  await page.getByRole('button', { name: 'Enter values by hand' }).click()
  const form = loadForm(page)
  const input = (name: RegExp) => form.getByRole('textbox', { name })

  await form.getByRole('combobox', { name: /^Search powders/ }).fill('Mine')
  await page.getByRole('option', { name: 'Mine DP (your design)' }).click()
  await page.getByRole('region', { name: 'Powder' }).getByRole('button', { name: 'Show' }).click()
  const vivacity = input(/^Vivacity/)
  await expect(vivacity).toHaveValue('0.612')
  await expect(vivacity).toHaveAccessibleDescription(/user design/)

  await form.getByRole('combobox', { name: /^Search bullets/ }).fill('168')
  await page.getByRole('option', { name: /168 gr/ }).click()
  await form.getByRole('combobox', { name: 'Search cartridges by name' }).fill('308 Win')
  await page
    .getByRole('option', { name: /^308 Win/ })
    .first()
    .click()
  await input(/^Usable case volume/).fill('3.2')
  await input(/^Charge mass/).fill('2.4')
  await input(/^Bullet travel/).fill('600')
  await input(/^Twist/).fill('305')
  await input(/^Charge mass/).press('Control+Enter')
  await expect(page.getByText(/^Simulation done\. /)).toBeAttached({ timeout: 15_000 })
  await expect(page.locator('.result-notes ul')).toContainText(
    'Powder values from the user design Mine DP, not a catalogue record.',
  )
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.report-sub')).toContainText('user design Mine DP')
  await expect(page.locator('.report-inputs')).toContainText('Mine DP (user design)')
})

for (const scheme of ['light', 'dark'] as const) {
  test(`has no accessibility violations in ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await design(page)
    await expect(page.getByText('Usable in the workbench')).toBeVisible()
    const { violations } = await new AxeBuilder({ page }).analyze()
    expect(violations).toEqual([])
  })
}
