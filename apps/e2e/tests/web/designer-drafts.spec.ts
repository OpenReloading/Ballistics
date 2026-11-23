import { expect, type Page, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { storageName } from './edition.ts'
import { followNav, gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { putRecords } from './user-store.ts'

// The bullet and cartridge designers and the brass group editor keep every change in the browser, as the powder and target designers do: a reload loses nothing, and New, Open and leaving ask only before an edit the browser does not keep goes. Metric (SI): lengths in mm
test.beforeEach(({ page }) => storeUnits(page))

const state = (page: Page) => page.locator('.file-state')
const name = (page: Page) => page.getByRole('textbox', { name: 'Name', exact: true })
const length = (page: Page, label: string) =>
  page.getByRole('textbox', { name: `${label} (mm)`, exact: true })

/** Opens the record `title` from the Open menu's list of the browser's records of `kind`. */
async function openKept(page: Page, kind: string, title: string) {
  await (await barButton(page, 'Open')).click()
  await page.getByRole('menuitem', { name: `Saved ${kind}…` }).click()
  await page.getByRole('button', { name: title, exact: true }).click()
}

test('the bullet designer keeps the draft through a reload, and New starts a blank one', async ({
  page,
}) => {
  await gotoHydrated(page, '/bullets/designer')
  await name(page).fill('Kept 168')
  const diameter = page.getByRole('textbox', { name: /Diameter \(mm\)$/ })
  await diameter.fill('7.82')
  await expect(state(page)).toHaveText('Saved in this browser')
  await gotoHydrated(page, '/bullets/designer')
  await expect(name(page)).toHaveValue('')
  await openKept(page, 'bullet designs', 'Kept 168')
  await expect(name(page)).toHaveValue('Kept 168')
  await expect(diameter).toHaveValue('7.82')
  await name(page).fill('Kept 175')
  await (await barButton(page, 'New bullet')).click()
  await expect(name(page)).toHaveValue('')
})

type Kept = { id: string; kind: string; data: { note?: string; waterCapacity?: { value: number } } }

/** The records the browser holds. */
const records = (page: Page) =>
  page.evaluate(
    (store) =>
      new Promise<Kept[]>((ok, no) => {
        const open = indexedDB.open(store)
        open.onerror = () => no(open.error)
        open.onsuccess = () => {
          const all = open.result.transaction('records').objectStore('records').getAll()
          all.onsuccess = () => ok(all.result)
        }
      }),
    storageName('rangefoundry-user-data'),
  )

/** How many records of `kind` the browser holds. */
const count = async (page: Page, kind: string) =>
  (await records(page)).filter((r) => r.kind === kind).length

test('a bullet started from a catalogue link is kept only from its first edit, also after a reload', async ({
  page,
}) => {
  await gotoHydrated(page, '/bullets/designer')
  await putRecords(page, [])
  const link = '/bullets/designer?from=demo-bullet-168'
  await gotoHydrated(page, link)
  await expect(name(page)).toHaveValue('30 Cal 168 gr HPBT Demo')
  await gotoHydrated(page, link)
  await expect(name(page)).toHaveValue('30 Cal 168 gr HPBT Demo')
  // New writes a draft not yet written: the started bullet, had it counted as an edit
  await (await barButton(page, 'New bullet')).click()
  await expect(name(page)).toHaveValue('')
  await name(page).fill('Edited 168')
  await expect(state(page)).toHaveText('Saved in this browser')
  expect(await count(page, 'bullet')).toBe(1)
})

test('the cartridge designer keeps the draft through a reload', async ({ page }) => {
  await gotoHydrated(page, '/cartridges/designer')
  await name(page).fill('Kept wildcat')
  await length(page, 'Cartridge L3').fill('51.2')
  await expect(state(page)).toHaveText('Saved in this browser')
  await gotoHydrated(page, '/cartridges/designer')
  await expect(name(page)).toHaveValue('')
  await openKept(page, 'cartridge designs', 'Kept wildcat')
  await expect(name(page)).toHaveValue('Kept wildcat')
  await expect(length(page, 'Cartridge L3')).toHaveValue('51.2')
})

const caseId = '3e5a7c90-2b4d-4f61-8a3c-5d7e9f1a2b4c'

/** The note of the stored group `caseId` and the water capacities (g) of the stored capacity records. */
const stored = async (page: Page) => {
  const all = await records(page)
  return {
    note: all.find((r) => r.id === caseId)?.data.note,
    capacities: all
      .filter((r) => r.kind === 'caseCapacity')
      .map((r) => r.data.waterCapacity?.value),
  }
}

/** Stores the brass group Lot 7 and opens it in the brass group editor. */
async function openLot7(page: Page) {
  await gotoHydrated(page, '/cases/editor')
  await putRecords(page, [
    {
      kind: 'case',
      id: caseId,
      name: 'Lot 7',
      saved: '2026-10-26T10:00:00.000Z',
      data: { origin: 'user', name: 'Lot 7', cartridge: 'catalogue:308-win', material: 'brass' },
    },
  ])
  await gotoHydrated(page, '/cases/editor')
  await openKept(page, 'brass groups', 'Lot 7')
  // the opened group remounts the form
  await expect(name(page)).toHaveValue('Lot 7')
}

test('the brass group editor keeps an edit of a stored group through a reload', async ({
  page,
}) => {
  await openLot7(page)
  const notes = page.getByRole('textbox', { name: 'Notes' })
  const capacity = page.getByRole('textbox', { name: /^Water capacity/ })
  await notes.fill('Annealed')
  await capacity.fill('3.55')
  // the group names its capacity, a record of its own, in g of water: 3.55 cm3
  await expect.poll(() => stored(page)).toEqual({ note: 'Annealed', capacities: [3.54361] })
  await gotoHydrated(page, '/cases/editor')
  await expect(notes).toHaveValue('')
  await openKept(page, 'brass groups', 'Lot 7')
  await expect(notes).toHaveValue('Annealed')
  await expect(capacity).toHaveValue('3.55')
})

test('the brass group editor asks before New drops an edit the browser does not keep', async ({
  page,
}) => {
  await openLot7(page)
  const notes = page.getByRole('textbox', { name: 'Notes' })
  // a group without a name is not a record: the note is not kept
  await name(page).fill('')
  await notes.fill('Annealed')
  await expect(state(page)).toHaveText('Not saved in this browser')
  await (await barButton(page, 'New brass group')).click()
  await page
    .getByRole('dialog', { name: /^Discard the unsaved changes/ })
    .getByRole('button', { name: 'Cancel', exact: true })
    .click()
  await expect(notes).toHaveValue('Annealed')
})

test('the brass group editor asks before a new group without a cartridge is left', async ({
  page,
}) => {
  await gotoHydrated(page, '/cases/editor')
  await name(page).fill('Lot 8')
  await followNav(page, 'Database')
  await expect(page.getByRole('dialog', { name: /^Leave this page\?/ })).toBeVisible()
})
