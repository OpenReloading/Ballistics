import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'

// An older (version 1) store holding a record the current format rejects.
const old = {
  kind: 'bulletDesign',
  id: 'old-1',
  name: 'Old design',
  saved: '2026-10-13T10:00:00.000Z',
  data: 'not an object',
}

test.beforeEach(async ({ page }) => {
  await storeUnits(page)
  // a native picker cannot be driven: the file goes to the origin private file system
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () =>
      (await navigator.storage.getDirectory()).getFileHandle('export.json', { create: true })
  })
  await page.goto('/')
  await page.evaluate(async (record) => {
    await new Promise<void>((done, fail) => {
      const r = indexedDB.deleteDatabase('openreloading-user-data')
      r.onsuccess = () => done()
      r.onerror = () => fail(r.error)
    })
    const db = await new Promise<IDBDatabase>((done, fail) => {
      const r = indexedDB.open('openreloading-user-data', 1)
      r.onupgradeneeded = () => r.result.createObjectStore('records', { keyPath: 'id' })
      r.onsuccess = () => done(r.result)
      r.onerror = () => fail(r.error)
    })
    await new Promise<void>((done) => {
      const tx = db.transaction('records', 'readwrite')
      tx.objectStore('records').put(record)
      tx.oncomplete = () => done()
    })
    db.close()
  }, old)
})

test('an invalid record of an older store is listed, downloadable and in Export all', async ({
  page,
}) => {
  await gotoHydrated(page, '/bullets/designer')
  await (await barButton(page, 'Open')).click()
  await page.getByRole('menuitem', { name: 'Invalid records (1)…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Invalid records in this browser' })
  await expect(dialog.getByText('Old design')).toBeVisible()
  await expect(dialog.getByText('data')).toBeVisible()
  const download = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Download raw' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('invalid-old-1.json')
  expect(JSON.parse(await readFile(await file.path(), 'utf8'))).toEqual(old)
  await page.keyboard.press('Escape')

  await (await barButton(page, 'Save options')).click()
  await page.getByRole('menuitem', { name: 'Export all…' }).click()
  await expect(page.getByText('1 invalid record is in it as stored.')).toBeVisible()
  const text = await page.evaluate(async () => {
    const dir = await navigator.storage.getDirectory()
    return (await (await dir.getFileHandle('export.json')).getFile()).text()
  })
  expect(JSON.parse(text).invalid).toEqual([old])
})
