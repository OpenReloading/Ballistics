import { expect, type Page } from '@playwright/test'
import { applyExampleLoad, loadForm } from './workbench.ts'

/** Runs the shown load and gives the result line: step, charge, peak pressure and muzzle velocity. */
export async function runLine(page: Page) {
  await loadForm(page)
    .getByLabel(/^Charge mass/)
    .press('Control+Enter')
  const line = page.locator('.result').getByText(/^Simulation done\. /)
  await expect(line).toBeAttached({ timeout: 15_000 })
  return line.textContent()
}

/** Opens the workbench, applies the example load and runs it. */
export async function runExample(page: Page) {
  await page.goto('/workbench')
  await applyExampleLoad(page)
  await loadForm(page)
    .getByLabel(/^Charge mass/)
    .press('Control+Enter')
  await expect(page.getByText(/^Result of /)).toBeAttached({ timeout: 15_000 })
}
