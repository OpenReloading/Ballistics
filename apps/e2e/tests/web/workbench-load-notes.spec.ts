import { expect, type Page, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { storeUnits } from './units.ts'
import { applyExampleLoad } from './workbench.ts'
import { runLine } from './workbench-run.ts'

test.beforeEach(({ page }) => storeUnits(page))

type Stored = {
  kind: string
  id: string
  name: string
  data: { snapshots?: { powderLot?: string; dismissed?: string[] }[] }
}

const storedLoads = (page: Page) =>
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

const file = ['string,velocity,velocityUnit', 'A,2795,fps', 'A,2810,fps', 'A,2802,fps'].join('\n')
const read = (page: Page, name: string) =>
  page
    .locator('input[type="file"]#measurements-file')
    .setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(file) })

test('a changed powder lot between two sessions is a note on the load and its session, dismissed per session and kept', async ({
  page,
}) => {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () =>
      (await navigator.storage.getDirectory()).getFileHandle('export.json', { create: true })
  })
  await page.goto('/workbench')
  await applyExampleLoad(page)
  await runLine(page)
  await page.getByRole('tab', { name: 'Notes', exact: true }).click()
  for (const [label, lot] of [
    ['Powder lot', 'P1'],
    ['Primer lot', 'R1'],
    ['Case lot', 'C1'],
  ])
    await page.getByLabel(label, { exact: true }).fill(lot)
  await page.getByRole('tab', { name: 'Measurements', exact: true }).click()
  await read(page, 'day1.csv')
  await expect(page.getByRole('status').filter({ hasText: 'Read day1.csv' })).toBeVisible()
  await (await barButton(page, 'Save')).click()
  await expect.poll(async () => (await storedLoads(page)).length).toBe(1)

  // the lot of the next session differs; a note shows before the load is saved again
  await page.getByRole('tab', { name: 'Notes', exact: true }).click()
  await page.getByLabel('Powder lot', { exact: true }).fill('P2')
  await page.getByRole('tab', { name: 'Measurements', exact: true }).click()
  await read(page, 'day2.csv')
  await expect(page.getByRole('status').filter({ hasText: 'Read day2.csv' })).toBeVisible()
  const note = 'Powder lot is P2 in day2.csv and was P1 in day1.csv.'
  await expect(page.locator('.measured-series').filter({ hasText: note })).toHaveCount(1)
  await page.getByRole('tab', { name: 'Notes', exact: true }).click()
  const notes = page.getByRole('tabpanel', { name: 'Notes' }).locator('.session-notes')
  await expect(notes.getByText(note)).toBeVisible()
  await expect(notes).not.toContainText(/safe|recommend/i)

  await (await barButton(page, 'Save')).click()
  await expect
    .poll(async () => (await storedLoads(page))[0]?.data.snapshots?.map((s) => s.powderLot))
    .toEqual(['P1', 'P2'])

  await notes.getByRole('button', { name: /^Dismiss the note on day2\.csv/ }).click()
  await expect(notes.getByText(note)).toHaveCount(0)
  await (await barButton(page, 'Save')).click()
  await expect
    .poll(async () => (await storedLoads(page))[0]?.data.snapshots?.[1]?.dismissed)
    .toEqual(['powderLot'])

  // reopened, the lots and the dismissal are back
  await page.goto('/workbench')
  await (await barButton(page, 'Open')).click()
  await page.getByRole('menuitem', { name: /^Saved loads/ }).click()
  await page
    .getByRole('button', { name: (await storedLoads(page))[0]?.name ?? '', exact: true })
    .click()
  await expect(page.locator('.file-state')).toContainText('Saved')
  await runLine(page)
  await page.getByRole('tab', { name: 'Notes', exact: true }).click()
  await expect(page.getByLabel('Powder lot', { exact: true })).toHaveValue('P2')
  await expect(notes.getByText(note)).toHaveCount(0)
  await expect(page.locator('.file-state[data-dirty]')).toHaveCount(0)
})
