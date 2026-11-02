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
      .getByText('Your own record; a club or authority decides whether to accept it.'),
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
  await expect(sheet).toContainText('Your own record; a club or authority decides')
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

test('the yearly summary shows only the entries of its year, the same numbers in print and CSV', async ({
  page,
}) => {
  await page.goto('/firearms/log')
  await seed(page)
  const entry = (n: number, date: string, firearm: string, rounds: number) => ({
    kind: 'shootingLogEntry',
    id: `00000000-0000-4000-8000-00000000000${n}`,
    name: date,
    saved: '2026-10-20T00:00:00.000Z',
    data: { date, firearm: `user:${firearm}`, ammunition: 'Maker', rounds },
  })
  await putRecords(page, [
    entry(1, '2025-06-01', pistol, 50),
    entry(2, '2026-03-14', rifle, 30),
    entry(3, '2026-03-28', pistol, 25),
    entry(4, '2026-07-01', rifle, 20),
  ])
  await page.reload()
  const summary = page.locator('section.log-summary')
  // the latest year first
  await expect(summary).toContainText('2026: 3 entries, 75 rounds')
  const firearms = summary.locator('table', { hasText: 'Rounds per firearm' })
  await expect(firearms.locator('tbody tr')).toHaveText(['Bench rifle502', 'Club pistol251'])
  // factory ammunition: under the firearm only
  await expect(summary).toContainText(
    '75 rounds of entries without a saved load are under their firearms only.',
  )
  const months = summary.locator('table', { hasText: 'Range days per month' })
  await expect(months.locator('tbody tr').nth(2)).toHaveText('March2')
  await expect(months.locator('tbody tr').nth(6)).toHaveText('July1')

  await summary.getByRole('combobox', { name: 'Summary year' }).click()
  await page.getByRole('option', { name: '2025' }).click()
  await expect(summary).toContainText('2025: 1 entry, 50 rounds')
  await expect(firearms.locator('tbody tr')).toHaveText(['Club pistol501'])

  // print: the summary sheet alone, with the numbers of the screen
  await page.evaluate(() => {
    document.documentElement.dataset.print = 'log-summary'
  })
  await page.emulateMedia({ media: 'print' })
  const sheet = page.locator('.log-summary-sheet')
  await expect(sheet).toBeVisible()
  await expect(page.locator('.log-sheet')).toBeHidden()
  await expect(sheet).toContainText('2025: 1 entry, 50 rounds')
  await page.emulateMedia({ media: 'screen' })
  await page.evaluate(() => {
    delete document.documentElement.dataset.print
  })

  const [csv] = await Promise.all([
    page.waitForEvent('download'),
    summary.getByRole('button', { name: 'Export summary CSV' }).click(),
  ])
  expect(csv.suggestedFilename()).toBe('openreloading-shooting-log-2025-summary.csv')
  const lines = (await readFile(await csv.path(), 'utf8')).replace(/^﻿/, '').trim().split('\n')
  expect(lines.slice(0, 3)).toEqual([
    'Year,2025',
    'Section,Name,Rounds,Entries',
    'Firearm,Club pistol,50,1',
  ])
  expect(lines).toContain('Without a load,,50,')
  expect(lines).toContain('Month,2025-06,,1')
  expect(lines.at(-1)).toBe('Total,,50,1')
})

test('an entry linked to a competition event shows the event, and the summary of its year lists the event once', async ({
  page,
}) => {
  await page.goto('/firearms/log')
  await seed(page)
  const match = '9c3e5a71-2b4d-4e6f-8a1c-3d5e7f9a1b2c'
  await putRecords(page, [
    {
      kind: 'event',
      id: match,
      name: 'LM Luftpistole',
      saved: '2026-10-20T00:00:00.000Z',
      data: {
        date: '2026-06-14',
        eventType: 'catalogue:dsb-meisterschaft',
        level: 'Landesmeisterschaft',
        state: 'completed',
        results: { method: 'rings', series: [{ total: 95 }, { total: 97 }] },
      },
    },
    // a second entry of the same event, already linked
    {
      kind: 'shootingLogEntry',
      id: '00000000-0000-4000-8000-000000000009',
      name: '2026-06-14',
      saved: '2026-10-20T00:00:00.000Z',
      data: { date: '2026-06-14', rounds: 10, event: `user:${match}` },
    },
  ])
  await page.reload()

  await (await barButton(page, 'New entry')).click()
  const form = page.locator('section.log-editor')
  await form.getByLabel('Date').fill('2026-06-14')
  await form.getByLabel('Rounds fired').fill('40')
  await form.getByRole('combobox', { name: 'Competition event' }).click()
  await page.getByRole('option', { name: /LM Luftpistole/ }).click()
  // an empty result takes the event's total
  await expect(form.getByLabel('Result')).toHaveValue('192')
  await form.getByRole('button', { name: 'Save entry' }).click()

  const rows = page.locator('.directory table tbody tr')
  await expect(rows).toHaveCount(2)
  await expect(rows.filter({ hasText: '192' })).toContainText('LM Luftpistole')

  const summary = page.locator('section.log-summary')
  await expect(summary.locator('.log-summary-events li')).toHaveCount(1)
  await expect(summary.locator('.log-summary-events li')).toContainText(
    'LM Luftpistole · 192 · 2 entries',
  )
})
