import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { putRecords } from './user-store.ts'
import { applyExampleLoad } from './workbench.ts'
import { runLine } from './workbench-run.ts'

// the offline layer's worker answers the reloads of the offline test
test.use({ serviceWorkers: 'allow' })
test.beforeEach(({ page }) => storeUnits(page))

const loadId = '7a2d9c10-5b3e-4f68-9d41-0c8e2b6a1f57'
const load = {
  kind: 'load',
  id: loadId,
  name: 'Range test load',
  saved: '2026-10-20T10:00:00.000Z',
  data: {
    origin: 'user',
    charge: { value: 42.5 },
    analysis: { ladder: { stepCount: 3, step: 0.5, direction: 'around' } },
  },
}

type Stored = {
  kind: string
  id: string
  name: string
  data: { sessions?: string[]; snapshots?: { session: string }[]; strings: Strings[] }
}
type Strings = { load?: string; shots: { velocity: { value: number }; excluded?: string }[] }

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

/** Saves the example load in the workbench as a load of this browser and gives its record. */
async function saveExampleLoad(page: Page) {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () =>
      (await navigator.storage.getDirectory()).getFileHandle('export.json', { create: true })
  })
  await gotoHydrated(page, '/workbench')
  await applyExampleLoad(page)
  await runLine(page)
  await (await barButton(page, 'Save')).click()
  await expect.poll(async () => (await stored(page, 'load')).length).toBe(1)
  const [record] = await stored(page, 'load')
  if (!record) throw new Error('the load was not saved')
  return record
}

/** Opens the saved load in the workbench and runs it. */
async function openSaved(page: Page, name: string) {
  await gotoHydrated(page, '/workbench')
  await (await barButton(page, 'Open')).click()
  await page.getByRole('menuitem', { name: /^Saved loads/ }).click()
  await page.getByRole('button', { name, exact: true }).click()
  await expect(page.locator('.file-state')).toContainText('Saved')
  await runLine(page)
}

/** Opens the range page for the seeded load. */
async function openRange(page: Page, id = loadId) {
  await gotoHydrated(page, `/range?load=${id}`)
  await expect(page.getByRole('group', { name: 'Number pad' })).toBeVisible()
}

/** Types a velocity into the entry field and adds it as a shot with Enter. */
async function shoot(page: Page, velocity: number) {
  const field = page.getByLabel(/^Velocity/)
  await field.fill(String(velocity))
  await field.press('Enter')
  await expect(field).toHaveValue('')
}

test('a 10-shot string entered offline survives reloads and is on the Measurements tab online', async ({
  page,
  context,
}) => {
  const saved = await saveExampleLoad(page)
  await openRange(page, saved.id)
  // the worker is active and controls the page, so the reloads below are answered from its caches
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await expect(page.getByText('Online', { exact: true })).toBeVisible()

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText('Offline, saved on this device')).toBeVisible()
  await expect(page.getByLabel('Saved load')).toHaveValue(saved.id)
  await page.getByRole('group', { name: 'Ladder step' }).getByRole('button').first().click()

  const speeds = [854, 861, 858, 849, 863, 857, 852, 860, 855, 859]
  for (const v of speeds.slice(0, 2)) await shoot(page, v)
  // the pad: 8 5 8
  for (const k of ['8', '5', '8']) await page.getByRole('button', { name: k, exact: true }).click()
  await page.getByRole('button', { name: 'Add shot' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Shot 3 saved' })).toBeVisible()
  for (const v of speeds.slice(3)) await shoot(page, v)
  const shots = page.getByRole('region', { name: 'Shots of this step' }).getByRole('listitem')
  await expect(shots).toHaveCount(10)

  // excluding a shot removes it from the statistics and keeps it in the data
  await page.getByRole('button', { name: 'Exclude shot 5' }).click()
  await expect(page.getByRole('button', { name: 'Exclude shot 5' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByText('Shots counted').locator('xpath=following-sibling::dd')).toHaveText(
    '9',
  )

  // conditions and a note are kept with the string
  await page.getByLabel(/^Air temperature/).fill('11.5')
  await page.getByRole('textbox', { name: 'Note', exact: true }).fill('light rain')

  await page.reload()
  await expect(shots).toHaveCount(10)
  await expect(page.getByRole('button', { name: 'Exclude shot 5' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByLabel(/^Air temperature/)).toHaveValue('11.5')
  await expect(page.getByRole('textbox', { name: 'Note', exact: true })).toHaveValue('light rain')

  await context.setOffline(false)
  const [session] = await stored(page, 'session')
  expect(session?.data.strings).toHaveLength(1)
  expect(session?.data.strings[0]?.load).toBe(`user:${saved.id}`)
  expect(session?.data.strings[0]?.shots).toHaveLength(10)
  expect(session?.data.strings[0]?.shots[4]?.excluded).toBeTruthy()
  // the saved load names the session
  const [after] = await stored(page, 'load')
  expect(after?.data.sessions).toEqual([`user:${session?.id}`])

  // at home: the load opens in the workbench and its Measurements tab lists the session
  await openSaved(page, saved.name)
  await page.getByRole('tab', { name: 'Measurements', exact: true }).click()
  await expect(page.locator('legend.series-name')).toContainText('range')
  await expect(page.getByLabel(/^String 1: /)).toBeAttached()
  await expect(page.getByText('light rain')).toBeVisible()
})

test('two tabs entering shots for one load lose none, and a Save of the load in a tab opened earlier keeps the session', async ({
  context,
  page,
}) => {
  // the workbench has the load open, then the range page adds a session to it
  const saved = await saveExampleLoad(page)
  const a = await context.newPage()
  const b = await context.newPage()
  await Promise.all([openRange(a, saved.id), openRange(b, saved.id)])
  await Promise.all([shoot(a, 850), shoot(b, 851)])
  await expect
    .poll(async () => (await stored(page, 'session'))[0]?.data.strings[0]?.shots.length)
    .toBe(2)
  expect(await stored(page, 'session')).toHaveLength(1)
  // the page opened first does not know the session: a change there and Save keep it
  await page.getByRole('tab', { name: 'Notes', exact: true }).click()
  await page.getByLabel('Powder lot', { exact: true }).fill('LOT-1')
  await (await barButton(page, 'Save')).click()
  // the load changed in another tab: the workbench asks, and keeps the session when overwritten
  const ask = page.getByRole('dialog', { name: 'Overwrite the newer copy?' })
  await ask.getByRole('button', { name: 'Overwrite' }).click()
  await expect(page.locator('.file-state[data-dirty]')).toHaveCount(0)
  const [session] = await stored(page, 'session')
  const [after] = await stored(page, 'load')
  expect(after?.data.snapshots?.[0]?.session).toBe(`user:${session?.id}`)
  expect(after?.data.sessions).toEqual([`user:${session?.id}`])
})

test('every control fits a thumb at 390 px and the page has no axe violation with a load open', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoHydrated(page, '/range')
  await putRecords(page, [load])
  await openRange(page)
  await shoot(page, 850)
  const small = await page
    .locator('main')
    .locator('button, a[href], input, textarea, select')
    .evaluateAll((els) =>
      els.flatMap((el) => {
        const r = el.getBoundingClientRect()
        const hidden = r.width === 0 || r.height === 0
        return !hidden && (r.width < 44 || r.height < 44)
          ? [`${el.tagName} ${el.textContent?.slice(0, 30) ?? ''} ${r.width}x${r.height}`]
          : []
      }),
    )
  expect(small).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(violations.map((v) => v.id)).toEqual([])
  }
})
