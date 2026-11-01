import { readFile } from 'node:fs/promises'
import { expect, type Page, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { putRecords } from './user-store.ts'

const pistol = '7a2d9c10-5b3e-4f68-9d41-0c8e2b6a1f57'

/** A firearm with a round count, as the library saves it. */
const seed = (page: Page) =>
  putRecords(page, [
    {
      kind: 'firearm',
      id: pistol,
      name: 'Match pistol',
      saved: '2026-10-20T00:00:00.000Z',
      data: {
        origin: 'user',
        name: 'Match pistol',
        twistHand: 'right',
        optics: [],
        configurations: [],
        roundCount: 1000,
      },
    },
  ])

/** The stored events, as written. */
const storedEvents = (page: Page) =>
  page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((ok, no) => {
      const r = indexedDB.open('openreloading-user-data')
      r.onsuccess = () => ok(r.result)
      r.onerror = () => no(r.error)
    })
    const all: { kind: string; id: string; data: Record<string, unknown> }[] = await new Promise(
      (ok) => {
        const r = db.transaction('records').objectStore('records').getAll()
        r.onsuccess = () => ok(r.result)
      },
    )
    db.close()
    return all.filter((r) => r.kind === 'event').sort((a, b) => a.id.localeCompare(b.id))
  })

/** Picks `option` in the select `name` of `scope`. */
async function pick(page: Page, scope: ReturnType<Page['locator']>, name: string, option: string) {
  await scope.getByRole('combobox', { name }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

const form = (page: Page) => page.locator('section.event-editor')
const count = (page: Page) => page.locator('.page-bar-status .bar-count')

test('a person adds an IPSC event with two stages and a DSB ring event, sees the totals, prints and round-trips them', async ({
  page,
}) => {
  await page.goto('/events')
  await seed(page)
  await page.reload()
  await expect(count(page)).toHaveText('0 events')
  await expect(
    page
      .locator('.log-own-record')
      .getByText('What you enter here is your own record, not an official result.', {
        exact: false,
      }),
  ).toBeVisible()

  // a DSB ring event: one series of shots, one of its total; its rounds go to the firearm's count
  await (await barButton(page, 'New event')).click()
  const ring = form(page)
  await ring.getByRole('textbox', { name: 'Name', exact: true }).fill('LM Luftpistole')
  await ring.getByLabel('Date').fill('2026-06-14')
  await pick(page, ring, 'Event type', 'DSB-Meisterschaft')
  await pick(page, ring, 'Level', 'Landesmeisterschaft')
  await pick(page, ring, 'Firearm', 'Match pistol')
  await ring.getByLabel('Rounds fired').fill('20')
  await ring.getByRole('button', { name: 'Add series' }).click()
  await ring.getByRole('group', { name: 'Series 1' }).getByLabel('Shots').fill('10 9 10.5')
  await ring.getByRole('button', { name: 'Add series' }).click()
  await ring.getByRole('group', { name: 'Series 2' }).getByLabel('Series total').fill('95')
  await expect(ring.getByRole('group', { name: 'Series 1' })).toContainText('Total 29.5')
  await expect(ring.locator('.event-total')).toHaveText('Event total: 124.5')
  await ring.getByRole('button', { name: 'Save event' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add to the round count?' })
  await expect(dialog).toContainText(
    'Add 20 rounds of this event to the round count of Match pistol?',
  )
  await dialog.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByText('Round count of Match pistol: 1020.')).toBeVisible()

  // an IPSC event: two stages, the total from the typed stage points
  await (await barButton(page, 'New event')).click()
  const ipsc = form(page)
  await ipsc.getByRole('textbox', { name: 'Name', exact: true }).fill('Club match')
  await ipsc.getByLabel('Date').fill('2026-07-04')
  await pick(page, ipsc, 'Event type', 'IPSC Handgun')
  await pick(page, ipsc, 'Division', 'Standard')
  for (const [n, A, C, time, points] of [
    [1, '10', '2', '12.5', '100'],
    [2, '8', '0', '10', '80.5'],
  ] as const) {
    await ipsc.getByRole('button', { name: 'Add stage' }).click()
    const stage = ipsc.getByRole('group', { name: `Stage ${n}` })
    await stage.getByLabel('A', { exact: true }).fill(A)
    await stage.getByLabel('C', { exact: true }).fill(C)
    await stage.getByLabel('Time (s)').fill(time)
    await stage.getByLabel('Stage points').fill(points)
  }
  // 10 A at 5 and 2 C at 3 (minor), 56 points in 12.5 s
  await expect(ipsc.getByRole('group', { name: 'Stage 1' })).toContainText(
    '56 points, hit factor 4.4800',
  )
  await expect(ipsc.locator('.event-total')).toHaveText('Event total: 180.5')
  await ipsc.getByRole('button', { name: 'Save event' }).click()
  await expect(count(page)).toHaveText('2 events')
  const table = page.locator('.directory table')
  await expect(table.getByRole('row', { name: /Club match/ })).toContainText('180.5')
  await expect(table.getByRole('row', { name: /LM Luftpistole/ })).toContainText('124.5')

  // print of the open event: its stages and total alone
  await table
    .getByRole('row', { name: /Club match/ })
    .getByRole('link')
    .click()
  await expect(form(page).getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
    'Club match',
  )
  await page.emulateMedia({ media: 'print' })
  const sheet = page.locator('.event-sheet')
  await expect(sheet).toBeVisible()
  await expect(page.locator('.competition-events')).toBeHidden()
  await expect(sheet.locator('tbody tr')).toHaveCount(2)
  await expect(sheet).toContainText('Event total: 180.5')
  await expect(sheet).toContainText('not an official result')
  await page.emulateMedia({ media: 'screen' })
  await form(page).getByRole('button', { name: 'Cancel' }).click()

  // CSV of every event: one row per series or stage
  const [csv] = await Promise.all([
    page.waitForEvent('download'),
    (await barButton(page, 'Export CSV')).click(),
  ])
  expect(csv.suggestedFilename()).toMatch(/^openreloading-events-\d{4}-\d{2}-\d{2}\.csv$/)
  const lines = (await readFile(await csv.path(), 'utf8')).replace(/^﻿/, '').trim().split('\n')
  expect(lines[0]).toMatch(/^Event,Date,Place,Event type,Level,Division,/)
  expect(lines).toHaveLength(5)
  expect(lines.filter((l) => l.startsWith('Club match,'))).toHaveLength(2)

  // JSON of every event, imported again into an empty list
  const [json] = await Promise.all([
    page.waitForEvent('download'),
    (await barButton(page, 'Export JSON')).click(),
  ])
  const path = await json.path()
  const before = await storedEvents(page)
  expect(before).toHaveLength(2)
  await page.evaluate(
    async (ids) => {
      const db: IDBDatabase = await new Promise((ok) => {
        const r = indexedDB.open('openreloading-user-data')
        r.onsuccess = () => ok(r.result)
      })
      const tx = db.transaction('records', 'readwrite')
      for (const id of ids) tx.objectStore('records').delete(id)
      await new Promise((ok) => {
        tx.oncomplete = ok
      })
      db.close()
    },
    before.map((r) => r.id),
  )
  await page.reload()
  await expect(count(page)).toHaveText('0 events')
  await page.locator('input[type="file"]').setInputFiles(path)
  await expect(
    page.getByText('2 events added, 0 already in this browser, 0 replaced.'),
  ).toBeVisible()
  expect(await storedEvents(page)).toEqual(before)
})
