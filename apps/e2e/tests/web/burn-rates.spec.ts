import { expect, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'

test('the overlay draws a powder of the address, named as the powder list names it', async ({
  page,
}) => {
  await gotoHydrated(page, '/powders/burn-rates?add=demo-powder-dp40')
  const overlay = page.getByRole('region', { name: 'Overlay' })
  await expect(overlay.getByText('Demo Powder Co. DP40')).toBeVisible()
  await expect(
    page.getByRole('img', { name: /Dynamic vivacity of the chosen powders/ }),
  ).toBeVisible()
})
