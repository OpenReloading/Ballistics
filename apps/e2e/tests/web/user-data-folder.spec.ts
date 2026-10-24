import { expect, type Page, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { storeUnits } from './units.ts'

// The workspace folder of the Save options menu
// Headless Chromium 153 (Playwright's build) crashes the page reading an origin-private directory
// handle back from IndexedDB, so the folder offered on the next visit is not run here.

test.beforeEach(async ({ page }) => {
  await storeUnits(page)
  // a native picker cannot be driven: the folder is one of the origin private file system
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).showDirectoryPicker = async () =>
      (await navigator.storage.getDirectory()).getDirectoryHandle('workspace', { create: true })
  })
})

const state = (page: Page) => page.locator('.file-state')

async function folderItem(page: Page, item: string) {
  await (await barButton(page, 'Save options')).click()
  await page.getByRole('menuitem', { name: item, exact: true }).click()
}

async function saveInFolder(page: Page) {
  await page.goto('/bullets/designer')
  await folderItem(page, 'Choose workspace folder…')
  await expect(state(page)).toHaveText('Not saved to a file, folder workspace')
  await page.getByLabel('Manufacturer').fill('Folder')
  await (await barButton(page, 'Save')).click()
  await expect(state(page)).toHaveText('Saved: folder.json, folder workspace')
}

test('saves go into the folder without a picker; the folder can be forgotten', async ({ page }) => {
  await saveInFolder(page)
  const text = await page.evaluate(async () => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('workspace')
    return (await (await dir.getFileHandle('folder.json')).getFile()).text()
  })
  expect(JSON.parse(text).records[0].data.manufacturer).toMatch(/^user:/)
  await folderItem(page, 'Forget workspace folder')
  await expect(state(page)).toHaveText('Saved: folder.json')
})

test('a folder whose reading crashed the last load is forgotten unread', async ({ page }) => {
  await saveInFolder(page)
  // as left by a load that crashed while reading the stored folder
  await page.evaluate(() => localStorage.setItem('user-data-folder-restoring', '1'))
  await page.reload()
  await expect(page.getByRole('status').filter({ hasText: 'could not be restored' })).toHaveText(
    'The workspace folder could not be restored; choose it again.',
  )
  await expect(state(page)).toHaveText('Not saved to a file')
  await (await barButton(page, 'Save options')).click()
  await expect(page.getByRole('menuitem', { name: 'Choose workspace folder…' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('user-data-folder-restoring'))).toBeNull()
})
