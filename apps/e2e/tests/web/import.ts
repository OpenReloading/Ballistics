import type { Page } from '@playwright/test'
import { barButton } from './bar.ts'

/** Lets the file input stand in for the native picker, which a test cannot drive. */
export const withoutOpenPicker = (page: Page) =>
  page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>).showOpenFilePicker
  })

/** Opens Import… and picks `files` (CSV or text): the click that chooses them. The Import entry. */
export async function pickFiles(page: Page, files: { name: string; buffer: Buffer }[]) {
  await (await barButton(page, 'Open')).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('menuitem', { name: 'Import…' }).click()
  await (await chooser).setFiles(files.map((f) => ({ ...f, mimeType: 'text/csv' })))
  return page.getByRole('dialog', { name: 'Tables to read' })
}
