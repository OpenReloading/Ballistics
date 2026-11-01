import { readFile } from 'node:fs/promises'
import { expect, type Page, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { putRecords } from './user-store.ts'

const rifle = '3f1c2b4e-9a7d-4c1e-8b25-6d0f4a9e7c13'
const pistol = '7a2d9c10-5b3e-4f68-9d41-0c8e2b6a1f57'

/** Two firearms with a round count, as the library saves them. */
const seed = (page: Page) =>
  putRecords(
    page,
    [
      [rifle, 'Bench rifle', 100],
      [pistol, 'Club pistol', 50],
    ].map(([id, name, roundCount]) => ({
      kind: 'firearm',
      id,
      name,
      saved: '2026-10-20T00:00:00.000Z',
      data: {
        origin: 'user',
        name,
        twistHand: 'right',
        optics: [],
        configurations: [],
        roundCount,
      },
    })),
  )

/** The stored records of `kind`, as written. */
const stored = (page: Page, kind: string) =>
  page.evaluate(async (kind) => {
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
    return all.filter((r) => r.kind === kind).sort((a, b) => a.id.localeCompare(b.id))
  }, kind)

const roundCount = async (page: Page, id: string) =>
  (await stored(page, 'firearm')).find((r) => r.id === id)?.data.roundCount

/** Fills and saves one entry, answering the round count question with `answer`. */
async function addEntry(
  page: Page,
  e: { date: string; firearm: string; ammunition: string; rounds: number },
  answer: 'Add' | 'Cancel',
) {
  await (await barButton(page, 'New entry')).click()
  const form = page.locator('section.log-editor')
  await form.getByLabel('Date').fill(e.date)
  await form.getByLabel('Place').fill('Club range')
  await form.getByRole('combobox', { name: 'Firearm' }).click()
  await page.getByRole('option', { name: e.firearm }).click()
  await form.getByLabel('Factory ammunition').fill(e.ammunition)
  await form.getByLabel('Rounds fired').fill(String(e.rounds))
  await form.getByRole('button', { name: 'Save entry' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add to the round count?' })
  await expect(dialog).toContainText(
    `Add ${e.rounds} rounds of this entry to the round count of ${e.firearm}?`,
  )
  await dialog.getByRole('button', { name: answer }).click()
}

test('the shooting log adds entries, counts rounds only after the confirm, prints a range and round-trips its JSON', async ({
  page,
}) => {
  await page.goto('/firearms/log')
  await seed(page)
  await page.reload()
  await expect(page.locator('.page-bar-status .bar-count')).toHaveText('0 entries')
  await expect(
    page
      .locator('.log-own-record')
      .getByText(
        'The shooting log is your own record. Whether a club or an authority accepts it is up to them.',
      ),
  ).toBeVisible()

  await addEntry(
    page,
    { date: '2026-03-14', firearm: 'Bench rifle', ammunition: 'Maker 308', rounds: 30 },
    'Add',
  )
  await expect(
    page.getByRole('status').filter({ hasText: 'Round count of Bench rifle: 130.' }),
  ).toBeVisible()
  expect(await roundCount(page, rifle)).toBe(130)

  // declining leaves the count as it was
  await addEntry(
    page,
    { date: '2026-04-02', firearm: 'Club pistol', ammunition: 'Maker 9 mm', rounds: 50 },
    'Cancel',
  )
  await expect(page.getByText('The round count of Club pistol is unchanged.')).toBeVisible()
  expect(await roundCount(page, pistol)).toBe(50)

  await addEntry(
    page,
    { date: '2026-05-20', firearm: 'Bench rifle', ammunition: 'Maker 308', rounds: 20 },
    'Add',
  )
  await expect(page.getByText('Round count of Bench rifle: 150.')).toBeVisible()
  await expect(page.locator('.page-bar-status .bar-count')).toHaveText('3 entries')

  // the firearm filter is kept in the address
  const filter = page.locator('.log-filters')
  await filter.getByRole('combobox', { name: 'Firearm' }).click()
  await page.getByRole('option', { name: 'Club pistol' }).click()
  await expect(page.locator('.page-bar-status .bar-count')).toHaveText('1 of 3 entries')
  await expect(page).toHaveURL(new RegExp(`[?&]firearm=${pistol}`))
  await filter.getByRole('combobox', { name: 'Firearm' }).click()
  await page.getByRole('option', { name: 'Club pistol' }).click()
  await expect(page.locator('.page-bar-status .bar-count')).toHaveText('3 entries')

  // a date range: two entries
  await filter.getByRole('textbox', { name: 'From', exact: true }).fill('2026-03-01')
  await filter.getByRole('textbox', { name: 'To', exact: true }).fill('2026-04-30')
  await expect(page.locator('.page-bar-status .bar-count')).toHaveText('2 of 3 entries')

  // print: the sheet alone, one line per entry and a blank signature column
  await page.emulateMedia({ media: 'print' })
  const sheet = page.locator('.log-sheet')
  await expect(sheet).toBeVisible()
  await expect(page.locator('.shooting-log')).toBeHidden()
  await expect(sheet.locator('tbody tr')).toHaveCount(2)
  await expect(sheet.locator('thead th').last()).toHaveText('Signature')
  await expect(sheet.locator('tbody td.log-signature').first()).toHaveText('')
  await expect(sheet).toContainText('The shooting log is your own record.')
  await expect(sheet).toContainText('2 entries, 80 rounds')
  await page.emulateMedia({ media: 'screen' })

  const [csv] = await Promise.all([
    page.waitForEvent('download'),
    (await barButton(page, 'Export CSV')).click(),
  ])
  expect(csv.suggestedFilename()).toMatch(/^openreloading-shooting-log-\d{4}-\d{2}-\d{2}\.csv$/)
  const lines = (await readFile(await csv.path(), 'utf8')).replace(/^﻿/, '').trim().split('\n')
  expect(lines[0]).toBe(
    'Date,Place,Discipline,Firearm,Load or ammunition,Rounds,Result,Notes,Confirmed by,Confirmed on',
  )
  expect(lines.slice(1)).toEqual([
    '2026-03-14,Club range,,Bench rifle,Maker 308,30,,,,',
    '2026-04-02,Club range,,Club pistol,Maker 9 mm,50,,,,',
  ])

  // the whole log as JSON, imported again into an empty log
  await filter.getByRole('textbox', { name: 'From', exact: true }).fill('')
  await filter.getByRole('textbox', { name: 'To', exact: true }).fill('')
  const [json] = await Promise.all([
    page.waitForEvent('download'),
    (await barButton(page, 'Export JSON')).click(),
  ])
  const path = await json.path()
  const before = await stored(page, 'shootingLogEntry')
  expect(before).toHaveLength(3)
  expect(JSON.parse(await readFile(path, 'utf8')).records).toHaveLength(3)
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
  await expect(page.locator('.page-bar-status .bar-count')).toHaveText('0 entries')
  await page.locator('input[type="file"]').setInputFiles(path)
  await expect(
    page.getByText('3 entries added, 0 already in this browser, 0 replaced.'),
  ).toBeVisible()
  await expect(page.locator('.page-bar-status .bar-count')).toHaveText('3 entries')
  expect(await stored(page, 'shootingLogEntry')).toEqual(before)
  // the import changes no round count
  expect(await roundCount(page, rifle)).toBe(150)
})
