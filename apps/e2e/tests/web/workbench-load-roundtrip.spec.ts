import { expect, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { storeUnits } from './units.ts'
import { applyExampleLoad, loadForm } from './workbench.ts'

test.beforeEach(({ page }) => storeUnits(page))

type Stored = { kind: string; name: string; data: Record<string, unknown> }

const storedLoads = (page: import('@playwright/test').Page) =>
  page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((ok, no) => {
      const r = indexedDB.open('openreloading-user-data')
      r.onsuccess = () => ok(r.result)
      r.onerror = () => no(r.error)
    })
    const all: Stored[] = await new Promise((ok, no) => {
      const r = db.transaction('records').objectStore('records').getAll()
      r.onsuccess = () => ok(r.result)
      r.onerror = () => no(r.error)
    })
    db.close()
    return all.filter((r) => r.kind === 'load')
  })

test('a saved load reopens with every field as it was and nothing unsaved', async ({ page }) => {
  // a native picker cannot be driven: the file goes to the origin private file system
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () =>
      (await navigator.storage.getDirectory()).getFileHandle('export.json', { create: true })
  })
  await page.goto('/workbench')
  await applyExampleLoad(page)
  const form = loadForm(page)
  // a typed value no record gives
  await form.getByRole('textbox', { name: /^Charge mass/ }).fill('2.45')
  await form.getByRole('textbox', { name: /^Bore diameter/ }).fill('7.70')
  const values = () =>
    form
      .getByRole('textbox')
      .evaluateAll((els) =>
        els.map((e) => [e.getAttribute('aria-label') ?? '', (e as HTMLInputElement).value]),
      )
  const before = await values()
  await (await barButton(page, 'Save')).click()
  await expect.poll(async () => (await storedLoads(page)).length).toBe(1)

  const [{ name, data }] = await storedLoads(page)
  const overrides = (data.analysis as { overrides?: Record<string, number> } | undefined)?.overrides
  // only what was typed: the powder and bullet records give the rest
  expect(overrides?.boreDiameter).toBe(7.7)
  expect(overrides).not.toHaveProperty('gamma')
  expect(overrides).not.toHaveProperty('bulletMass')
  expect(data.charge).toEqual({ value: 2.45 })
  expect(data.cartridge).toBe('catalogue:308-win')

  await page.goto('/workbench')
  await (await barButton(page, 'Open')).click()
  await page.getByRole('menuitem', { name: /^Saved loads/ }).click()
  await page.getByRole('button', { name, exact: true }).click()
  await expect.poll(values).toEqual(before)
  await expect(page.locator('.file-state')).toContainText('Saved')
  await expect(page.locator('.file-state[data-dirty]')).toHaveCount(0)
})

test('a load of records keeps only the charge and the travel and reopens with the records filling the rest', async ({
  page,
}) => {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () =>
      (await navigator.storage.getDirectory()).getFileHandle('export.json', { create: true })
  })
  await page.goto('/workbench?cartridge=308-win&bullet=demo-bullet-168&powder=demo-powder-dp40')
  const form = loadForm(page)
  await expect(form.locator('.field-flag-seating')).toHaveCount(1)
  await form.getByRole('textbox', { name: /^Charge mass/ }).fill('2.40')
  await form.getByRole('textbox', { name: /^Bullet travel/ }).fill('533.40')
  const values = () =>
    form.getByRole('textbox').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))
  const before = await values()
  expect(before).toContain('10.89')
  await (await barButton(page, 'Save')).click()
  await expect.poll(async () => (await storedLoads(page)).length).toBe(1)
  const [{ name, data }] = await storedLoads(page)
  expect(data.analysis).toEqual({ overrides: { travel: 533.4 } })
  expect(data.charge).toEqual({ value: 2.4 })

  await page.goto('/workbench')
  await (await barButton(page, 'Open')).click()
  await page.getByRole('menuitem', { name: /^Saved loads/ }).click()
  await page.getByRole('button', { name, exact: true }).click()
  await expect.poll(values).toEqual(before)
  await expect(page.locator('.file-state')).toContainText('Saved')
  await expect(page.locator('.file-state[data-dirty]')).toHaveCount(0)
})
