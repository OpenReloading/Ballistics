import type { Locator, Page } from '@playwright/test'

/**
 * Opens a popover of the target editor's toolbar unless it is open: Calibrate (references,
 * rotation, origin), Photo (add, replace, remove, contrast, darken) or Overlays.
 */
export async function toolbarPopover(
  scope: Page | Locator,
  name: 'Calibrate' | 'Photo' | 'Overlays',
) {
  const button = scope.getByRole('button', { name, exact: true })
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click()
}
