import { expect, type Page, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { storeUnits } from './units.ts'
import { putRecords } from './user-store.ts'
import { applyExampleLoad } from './workbench.ts'
import { runLine } from './workbench-run.ts'

test.beforeEach(({ page }) => storeUnits(page))

const STEPS = 5
const GROUPS = 3

/** A chronograph file with one string of five shots per group, in the order step 0 group 0, 1, 2, step 1 group 0 ... */
const file = [
  'string,velocity,velocityUnit',
  ...Array.from({ length: STEPS * GROUPS }, (_, k) =>
    Array.from(
      { length: 5 },
      (_, i) => `S${k + 1},${2700 + 25 * Math.floor(k / GROUPS) + 3 * i},fps`,
    ).join('\n'),
  ),
].join('\n')

const stored = (page: Page, kind: string) =>
  page.evaluate(async (kind) => {
    const db: IDBDatabase = await new Promise((ok, no) => {
      const r = indexedDB.open('openreloading-user-data')
      r.onsuccess = () => ok(r.result)
      r.onerror = () => no(r.error)
    })
    const all: { kind: string; id: string }[] = await new Promise((ok, no) => {
      const r = db.transaction('records').objectStore('records').getAll()
      r.onsuccess = () => ok(r.result)
      r.onerror = () => no(r.error)
    })
    db.close()
    return all.filter((r) => r.kind === kind)
  }, kind)

test('linking a chronograph string to a ladder group completes the point of impact per charge', async ({
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
  await expect(page.getByRole('status').filter({ hasText: 'Read day1.csv' })).toBeVisible()
  await (await barButton(page, 'Save')).click()
  await expect.poll(async () => (await stored(page, 'load')).length).toBe(1)
  await expect.poll(async () => (await stored(page, 'session')).length).toBe(1)
  const [load] = await stored(page, 'load')
  const [session] = await stored(page, 'session')
  if (!load || !session) throw new Error('nothing stored')
  // three groups of five shots per ladder step, each linked to its string but the first group of the first three steps
  const groups = Array.from({ length: STEPS * GROUPS }, (_, k) => ({
    id: `g${k + 1}`,
    name: `Group ${k + 1}`,
    colour: '#c0392b',
    distance: 100,
    aim: { x: 0, y: 0 },
    ladderStep: Math.floor(k / GROUPS),
    shots: Array.from({ length: 5 }, (_, i) => ({
      x: 0.001 * i,
      y: 0.003 * Math.floor(k / GROUPS) + 0.0002 * i,
      placement: 'placed',
      ...(!(k < 9 && k % 3 === 0) && {
        chrono: { session: `user:${session.id}`, string: k, shot: i },
      }),
    })),
  }))
  await putRecords(page, [
    {
      kind: 'targetSheet',
      id: '6f1c2c1e-0d6b-4d0e-9a52-3b0a52d7c001',
      name: 'Ladder groups',
      saved: new Date().toISOString(),
      data: { references: [], targetRotation: 0, groups, load: load.id },
    },
  ])
  await page.getByRole('tab', { name: 'Groups', exact: true }).click()
  await page.getByRole('button', { name: 'Expand', exact: true }).click()
  const ladder = page.locator('.ladder-groups')
  const picker = ladder.getByLabel(/^Chronograph, Group 7,/)
  await expect(ladder.getByText(/needs three charges/)).toBeVisible()
  await picker.selectOption({ label: 'day1.csv, String 7: S7, 5 shots' })
  await expect(ladder.getByRole('group', { name: 'Point of impact per charge' })).toBeVisible()
  await expect(ladder.getByText(/changes with the charge by more than/)).toBeVisible()
  await expect(ladder.getByText(/The drop slope is simulated/)).toBeVisible()
  await picker.selectOption({ label: 'None' })
  await expect(ladder.getByText(/needs three charges/)).toBeVisible()
})
