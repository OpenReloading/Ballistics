import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { applyExampleLoad, loadForm } from './workbench.ts'

test.beforeEach(({ page }) => storeUnits(page))

type Stored = { kind: string; id: string; name: string; data: Record<string, unknown> }

const storedKind = (page: import('@playwright/test').Page, kind: string) =>
  page.evaluate(async (kind) => {
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
    return all.filter((r) => r.kind === kind)
  }, kind)

const storedLoads = (page: import('@playwright/test').Page) => storedKind(page, 'load')

test('a saved load reopens with every field as it was and nothing unsaved', async ({ page }) => {
  // a native picker cannot be driven: the file goes to the origin private file system
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () =>
      (await navigator.storage.getDirectory()).getFileHandle('export.json', { create: true })
  })
  await page.goto('/workbench')
  await applyExampleLoad(page)
  const form = loadForm(page)
  // the example's brass gives the capacity, flagged as the record's
  const capacity = form.getByRole('textbox', { name: /^Case capacity/ })
  await expect(capacity).toHaveValue('')
  await expect(capacity).toHaveAttribute('placeholder', /^3\.6/)
  await expect(capacity).toHaveAccessibleDescription(
    /From the brass record Demo Cases 308 Win\. Brass Demo: 3\.6 g water\./,
  )
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
  expect(data.case).toEqual({ record: 'catalogue:demo-case-308-brass' })
  expect(data).not.toHaveProperty('capacity')

  await page.goto('/workbench')
  await (await barButton(page, 'Open')).click()
  await page.getByRole('menuitem', { name: /^Saved loads/ }).click()
  await page.getByRole('button', { name, exact: true }).click()
  await expect.poll(values).toEqual(before)
  // the brass is chosen again and gives the capacity
  await expect(capacity).toHaveAttribute('placeholder', /^3\.6/)
  await expect(page.getByRole('combobox', { name: 'Brass record' })).toHaveAttribute(
    'placeholder',
    /308 Win\. Brass Demo/,
  )
  await expect(page.locator('.file-state')).toContainText('Saved')
  await expect(page.locator('.file-state[data-dirty]')).toHaveCount(0)
})

test('a diameter and length typed over the bullet record are saved as typed values and follow the record again when emptied', async ({
  page,
}) => {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () =>
      (await navigator.storage.getDirectory()).getFileHandle('export.json', { create: true })
  })
  await page.goto('/workbench')
  await applyExampleLoad(page)
  const form = loadForm(page)
  const [diameter, length] = [
    form.getByRole('textbox', { name: /^Diameter/ }),
    form.getByRole('textbox', { name: /^Length/ }),
  ]
  // the record's values, in muted text until typed over
  const record = await diameter.inputValue()
  expect(record).not.toBe('')
  await expect(diameter).toHaveClass(/field-default/)
  const volume = form.getByRole('textbox', { name: /^Usable case volume/ })
  const seated = await volume.inputValue()
  await diameter.fill('7.84')
  await length.fill('31.00')
  await expect(diameter).not.toHaveClass(/field-default/)
  // the seated bullet is bigger: the volume behind it moves and settles before the fields are read
  await expect(volume).not.toHaveValue(seated)
  await expect
    .poll(async () => {
      const first = await volume.inputValue()
      await page.waitForTimeout(500)
      return first === (await volume.inputValue())
    })
    .toBe(true)
  const values = () =>
    form.getByRole('textbox').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))
  const before = await values()
  await (await barButton(page, 'Save')).click()
  await expect.poll(async () => (await storedLoads(page)).length).toBe(1)
  const [{ name, data }] = await storedLoads(page)
  const overrides = (data.analysis as { overrides?: Record<string, number> } | undefined)?.overrides
  expect(overrides).toMatchObject({ bulletDiameter: 7.84, bulletLength: 31 })
  expect(overrides).not.toHaveProperty('bulletMass')
  expect(overrides).not.toHaveProperty('bulletBcG7')

  await page.goto('/workbench')
  await (await barButton(page, 'Open')).click()
  await page.getByRole('menuitem', { name: /^Saved loads/ }).click()
  await page.getByRole('button', { name, exact: true }).click()
  await expect.poll(values).toEqual(before)
  await expect(page.locator('.file-state[data-dirty]')).toHaveCount(0)
  // an emptied field follows the record again once it is left
  await diameter.fill('')
  await diameter.blur()
  await expect(diameter).toHaveValue(record)
  await expect(diameter).toHaveClass(/field-default/)
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

test('the file downloaded for the API runs through the load file route and the saved load keeps the typed keys', async ({
  page,
  request,
}) => {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () =>
      (await navigator.storage.getDirectory()).getFileHandle('export.json', { create: true })
  })
  await gotoHydrated(page, '/workbench')
  await applyExampleLoad(page)
  await loadForm(page)
    .getByRole('textbox', { name: /^Charge mass/ })
    .fill('2.45')
  await (await barButton(page, 'Save options')).click()
  const download = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Download for the API' }).click()
  const file = JSON.parse(await readFile(await (await download).path(), 'utf8'))
  const api = process.env.API_URL ?? 'http://localhost:3000'
  const res = await request.post(`${api}/v1/interior/load-file`, { data: file })
  expect(res.status(), await res.text()).toBe(200)
  expect((await res.json()).summary.peakPressure).toBeGreaterThan(0)

  await (await barButton(page, 'Save')).click()
  await expect.poll(async () => (await storedLoads(page)).length).toBe(1)
  const [{ data }] = await storedLoads(page)
  expect(data.charge).toEqual({ value: 2.45 })
  expect(data.analysis).not.toHaveProperty('overrides.gamma')
})
