import { expect, test } from '@playwright/test'

// no storeUnits: nothing is stored, so the default shows whatever the browser language is
test.use({ locale: 'en-US' })

test('an en-US browser with nothing stored gets Metric, common use', async ({ page }) => {
  await page.goto('./firearms')
  await expect(page.getByRole('button', { name: /^Units: / })).toHaveAccessibleName(
    'Units: Metric, common use',
  )
})
