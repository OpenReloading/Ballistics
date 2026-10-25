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
  data: { sessions?: string[]; strings: { variation?: { kind: string }; load?: string }[] }
}

const stored = (page: Page, kind: string) =>
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

const file = [
  'string,velocity,velocityUnit,coldBore,excluded',
  'A,2795,fps,yes,',
  'A,2810,fps,,',
  'B,2831,fps,,',
].join('\n')

test('a chronograph file on the Measurements tab is a stored session that the saved load names and reopens', async ({
  page,
}) => {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () =>
      (await navigator.storage.getDirectory()).getFileHandle('export.json', { create: true })
  })
  await page.goto('/workbench')
  await applyExampleLoad(page)
  await runLine(page)
  await page.getByRole('tab', { name: 'Measurements', exact: true }).click()
  await page
    .locator('input[type="file"]#measurements-file')
    .setInputFiles({ name: 'day1.csv', mimeType: 'text/csv', buffer: Buffer.from(file) })
  await expect(
    page.getByRole('status').filter({ hasText: 'Read day1.csv, 2 strings' }),
  ).toBeVisible()
  // the session is a record of its own as soon as it is read, with no string mapped yet
  await expect.poll(async () => (await stored(page, 'session')).length).toBe(1)
  // string k takes step k of the run; the second string is set to not used
  await page.getByLabel(/^String 2: B/).selectOption({ label: 'Not used' })
  await expect
    .poll(async () => (await stored(page, 'session'))[0].data.strings.map((s) => s.variation?.kind))
    .toEqual(['charge', undefined])

  await (await barButton(page, 'Save')).click()
  await expect.poll(async () => (await stored(page, 'load')).length).toBe(1)
  const [load] = await stored(page, 'load')
  const [session] = await stored(page, 'session')
  expect(load.data.sessions).toEqual([`user:${session.id}`])
  expect(session.name).toBe('day1.csv')
  // Save names the load on the mapped string only
  await expect
    .poll(async () => (await stored(page, 'session'))[0].data.strings.map((s) => s.load))
    .toEqual([`user:${load.id}`, undefined])

  await page.goto('/workbench')
  await (await barButton(page, 'Open')).click()
  await page.getByRole('menuitem', { name: /^Saved loads/ }).click()
  await page.getByRole('button', { name: load.name, exact: true }).click()
  await expect(page.locator('.file-state')).toContainText('Saved')
  await runLine(page)
  await page.getByRole('tab', { name: 'Measurements', exact: true }).click()
  await expect(page.getByLabel(/^String 1: A/)).toBeAttached()
  await expect(page.locator('legend.series-name').filter({ hasText: 'day1.csv' })).toBeVisible()
  // the strings come back with their mapping: string 1 on a step, string 2 not used
  await expect(page.getByLabel(/^String 1: A/)).not.toHaveValue('')
  await expect(page.getByLabel(/^String 2: B/)).toHaveValue('')
  await expect(page.locator('.file-state[data-dirty]')).toHaveCount(0)
})
