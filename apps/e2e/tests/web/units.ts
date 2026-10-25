import { expect, type Page } from '@playwright/test'

const defaultOverrides: Record<string, string> = { lineOfSightOffset: 'cm' }

/**
 * Stores a unit choice before every page load unless one is stored, so the specs do not depend on
 * the browser locale. Metric (SI) with drop in cm shows the units of the old metric switch.
 */
export const storeUnits = (page: Page, preset = 'metric-grams', overrides = defaultOverrides) =>
  page.addInitScript(
    ([p, o]) => {
      if (localStorage.getItem('units') === null)
        localStorage.setItem('units', JSON.stringify({ preset: p, overrides: o }))
    },
    [preset, overrides] as const,
  )

/** The Settings entry of the sidebar: a button opening the settings dialog. */
export const settingsEntry = (page: Page) =>
  page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('button', { name: 'Settings', exact: true })

/** Opens the settings dialog from the sidebar and waits for it to be in view: it fades in. */
async function settingsDialog(page: Page) {
  await settingsEntry(page).click()
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  // the form shows once the stored choice is read
  await dialog.getByRole('radiogroup', { name: 'Preset' }).waitFor()
  // checks during the transition would read half-transparent colours
  await expect(dialog).toHaveCSS('opacity', '1')
  return dialog
}

/** The settings dialog in a second tab of the same browser context; the first page follows its changes. */
async function openSettings(page: Page) {
  const settings = await page.context().newPage()
  await settings.goto('/powders')
  await settingsDialog(settings)
  return settings
}

/**
 * Chooses a preset in the settings dialog of a second tab and closes it. The preset is a segmented
 * control: its radio inputs are hidden behind their labels.
 */
export async function choosePreset(page: Page, name: string) {
  const settings = await openSettings(page)
  await settings
    .getByRole('radiogroup', { name: 'Preset' })
    .getByText(name, { exact: true })
    .click()
  await expect(settings.getByRole('radio', { name, exact: true })).toBeChecked()
  await settings.close()
}
