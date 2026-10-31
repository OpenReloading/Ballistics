import { expect, type Page } from '@playwright/test'
import { barButton } from './bar.ts'
import { gotoHydrated } from './nav.ts'
import { putRecords } from './user-store.ts'
import { applyExampleLoad } from './workbench.ts'
import { runLine } from './workbench-run.ts'

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

/** A tab of the results: on the phone layout behind the Results tab, below 62em maybe in the More menu. */
async function openTab(page: Page, name: string) {
  const results = page.getByRole('tab', { name: 'Results', exact: true })
  const direct = page.getByRole('tab', { name, exact: true })
  const more = page.getByRole('button', { name: 'More', exact: true })
  await expect(results.or(direct).or(more).first()).toBeVisible()
  if (await results.isVisible()) await results.click()
  await expect(direct.or(more).first()).toBeVisible()
  if (await direct.isVisible()) await direct.click()
  else {
    await more.click()
    await page.getByRole('menuitem', { name }).click()
  }
  await expect(page.getByRole('tabpanel', { name })).toBeVisible()
}

/**
 * A ladder of five steps with three groups each, the shots linked to their chronograph strings
 * but those of the first group of each of the first three steps, on the Groups tab with its
 * ladder panel open.
 */
export async function openLadderGroups(page: Page) {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () =>
      (await navigator.storage.getDirectory()).getFileHandle('export.json', { create: true })
  })
  await gotoHydrated(page, '/workbench')
  await applyExampleLoad(page)
  await runLine(page)
  await openTab(page, 'Measurements')
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
  await openTab(page, 'Groups')
  await page.getByRole('button', { name: 'Expand', exact: true }).click()
  const ladder = page.locator('.ladder-groups')
  // the compact layout folds the panels behind a strip, which opens on the Group tab
  const strip = page.locator('.sheet-strip').locator('visible=true')
  await expect(ladder.or(strip).first()).toBeVisible()
  if (await strip.count()) {
    await strip.click()
    await page.getByRole('tab', { name: 'Ladder', exact: true }).click()
  }
  await expect(ladder).toBeVisible()
  return ladder
}
