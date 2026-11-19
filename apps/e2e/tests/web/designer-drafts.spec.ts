import { expect, type Page, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { putRecords } from './user-store.ts'

// The bullet and cartridge designers and the brass group editor keep every change in the browser, as the powder and target designers do: a reload loses nothing, and New asks nothing. Metric (SI): lengths in mm
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
const stored = (page: Page) =>
  page.evaluate(
    (id) =>
      new Promise<{ note?: string; capacities: number[] }>((ok, no) => {
        const open = indexedDB.open('rangefoundry-user-data')
        open.onerror = () => no(open.error)
        open.onsuccess = () => {
          const all = open.result.transaction('records').objectStore('records').getAll()
          all.onsuccess = () =>
            ok({
              note: all.result.find((r) => r.id === id)?.data.note,
              capacities: all.result
                .filter((r) => r.kind === 'caseCapacity')
                .map((r) => r.data.waterCapacity.value),
            })
        }
      }),
    caseId,
  )

test('the brass group editor keeps an edit of a stored group through a reload', async ({
  page,
}) => {
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
