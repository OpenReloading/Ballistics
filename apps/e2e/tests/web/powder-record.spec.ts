import { expect, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'

// The powder record page: its name on a phone, the field names a source covers, the listed
// cartridges as links and the burn-rate order shown once (the strip's card)
const path = '/powders/demo-powder-dp40/'

test('names the powder alone on a phone, with its manufacturer from 48em', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoHydrated(page, path)
  await expect(page.getByRole('heading', { level: 1, name: 'DP40', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 1280, height: 650 })
  await expect(
    page.getByRole('heading', { level: 1, name: 'Demo Powder Co. DP40', exact: true }),
  ).toBeVisible()
})

test('links the listed cartridges and names the fields a source covers', async ({ page }) => {
  await gotoHydrated(page, path)
  const properties = page.getByRole('region', { name: 'Properties' })
  await expect(properties.getByRole('link', { name: '308 Win.' })).toHaveAttribute(
    'href',
    /\/cartridges\/308-win\/?$/,
  )
  const covers = page
    .getByRole('region', { name: /^Sources/ })
    .getByRole('button', { name: '5 fields' })
  await covers.focus()
  await expect(page.getByRole('tooltip')).toHaveText(
    'Name, Form, Base, Listed by the manufacturer for, Model parameters',
  )
})

test('shows the burn-rate order once, in the strip', async ({ page }) => {
  await gotoHydrated(page, path)
  const panel = page.getByRole('region', { name: 'Burn rate (model output)' })
  await expect(panel.getByText('Mean vivacity')).toBeVisible()
  await expect(panel.getByRole('rowheader', { name: 'Burn-rate order' })).toHaveCount(0)
  // the neighbour lists name the unit once, in their headings
  await expect(panel.getByRole('heading', { name: 'Faster (1/(MPa·s))' })).toBeVisible()
})
