import { expect, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { settingsEntry } from './units.ts'

// no storeUnits: nothing is stored, so the default shows whatever the browser language is
test.use({ locale: 'en-US' })

test('an en-US browser with nothing stored gets Metric, common use', async ({ page }) => {
  await gotoHydrated(page, '/firearms')
  await settingsEntry(page).click()
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  // the preset form renders only once the stored choice is read, so the checked radio is the applied default, not the first render's
  await expect(
    dialog.getByRole('radiogroup', { name: 'Preset' }).getByRole('radio', {
      name: 'Metric, common use',
      exact: true,
    }),
  ).toBeChecked()
})
