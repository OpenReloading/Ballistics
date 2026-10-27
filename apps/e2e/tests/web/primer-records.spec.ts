import { expect, type Page, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { gotoHydrated } from './nav.ts'

const storedLoads = (page: Page) =>
  page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((ok, no) => {
      const r = indexedDB.open('openreloading-user-data')
      r.onsuccess = () => ok(r.result)
      r.onerror = () => no(r.error)
    })
    const all: { kind: string; name: string; data: { primer?: unknown } }[] = await new Promise(
      (ok, no) => {
        const r = db.transaction('records').objectStore('records').getAll()
        r.onsuccess = () => ok(r.result)
        r.onerror = () => no(r.error)
      },
    )
    db.close()
    return all.filter((r) => r.kind === 'load')
  })

test('the primer list opens a primer record with its properties and sources', async ({ page }) => {
  await gotoHydrated(page, '/primers')
  await expect(page.getByRole('link', { name: /Small Pistol Lead-Free Demo/ })).toBeVisible()
  await page.getByRole('link', { name: /Large Rifle Demo/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Large Rifle Demo')
  await expect(page.getByRole('region', { name: 'Properties' })).toContainText('DP-LR')
  await expect(page.getByRole('region', { name: /^Sources/ })).toBeVisible()
})

test('the primer list narrows by search', async ({ page }) => {
  await gotoHydrated(page, '/primers')
  await page.getByRole('searchbox', { name: 'Search' }).fill('pistol')
  await expect(page.getByRole('link', { name: /Large Rifle Demo/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Small Pistol Lead-Free Demo/ })).toBeVisible()
})

test('a primer chosen in the Cartridge card is saved with the load and chosen again on reopening', async ({
  page,
}) => {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () =>
      (await navigator.storage.getDirectory()).getFileHandle('export.json', { create: true })
  })
  await gotoHydrated(page, '/workbench?cartridge=308-win')
  await page.getByRole('button', { name: 'More of Cartridge' }).click()
  const primer = page.getByRole('combobox', { name: 'Primer' })
  await primer.selectOption({ label: 'Demo Primers Large Rifle Demo, large rifle' })
  await (await barButton(page, 'Save')).click()
  await expect
    .poll(async () => (await storedLoads(page)).map((r) => r.data.primer))
    .toEqual([{ record: 'catalogue:demo-primer-large-rifle' }])

  const [{ name }] = await storedLoads(page)
  await gotoHydrated(page, '/workbench')
  await (await barButton(page, 'Open')).click()
  await page.getByRole('menuitem', { name: /^Saved loads/ }).click()
  await page.getByRole('button', { name, exact: true }).click()
  await page.getByRole('button', { name: 'More of Cartridge' }).click()
  await expect(page.getByRole('combobox', { name: 'Primer' })).toHaveValue(
    'demo-primer-large-rifle',
  )
})
