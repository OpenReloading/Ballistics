import { expect, type Page, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { storeUnits } from './units.ts'
import { loadForm } from './workbench.ts'

// Metric (SI): lengths in mm
test.beforeEach(({ page }) => storeUnits(page))

/**
 * A cartridge design in the browser store, as the designer saves it (no base record, so every value
 * is an override): the values of a record's sides without the chamber's bore diameter F, bore area Q and twist u.
 */
async function seedDesign(page: Page) {
  await page.evaluate(async () => {
    const record = await (await fetch('/api/cartridges/308-win')).json()
    const lacking = ['F', 'Q', 'u']
    const values = record.values.filter(
      (v: { side?: string; symbol: string; variant?: string }) =>
        v.side && !v.variant && !(v.side === 'chamber' && lacking.includes(v.symbol)),
    )
    const db: IDBDatabase = await new Promise((ok, no) => {
      const r = indexedDB.open('openreloading-user-data')
      r.onupgradeneeded = () => {
        for (const n of ['records', 'handles', 'files'])
          if (!r.result.objectStoreNames.contains(n))
            r.result.createObjectStore(n, n === 'records' ? { keyPath: 'id' } : undefined)
      }
      r.onsuccess = () => ok(r.result)
      r.onerror = () => no(r.error)
    })
    const tx = db.transaction('records', 'readwrite')
    tx.objectStore('records').put({
      kind: 'cartridge',
      id: '6f0f4d3e-0a43-4a43-9a3d-3a2f2e1f0c21',
      name: 'Mine 7.8',
      saved: '2026-10-24T00:00:00.000Z',
      data: { origin: 'user', overrides: { table: record.table, values } },
    })
    await new Promise((ok) => {
      tx.oncomplete = ok
    })
    db.close()
  })
}

test('a cartridge design fills the fields it covers, draws the figure and is named in the results and the print', async ({
  page,
}) => {
  await page.goto('/workbench')
  await seedDesign(page)
  await page.reload()
  await page.getByRole('button', { name: 'Enter values by hand' }).click()
  const form = loadForm(page)
  const field = (name: RegExp) => form.getByRole('textbox', { name })

  const cartridges = form.getByRole('combobox', { name: 'Search cartridges by name' })
  // a record's values go with the record when the design replaces it
  await cartridges.fill('308 Win')
  await page
    .getByRole('option', { name: /^308 Win/ })
    .first()
    .click()
  await expect(field(/^Bore area/)).not.toHaveValue('')
  await cartridges.fill('Mine')
  await page.getByRole('option', { name: 'Mine 7.8 (your design)' }).click()
  // the design's own volume and nothing from a record: the bore area and twist stay empty
  await expect(field(/^Usable case volume/)).not.toHaveValue('')
  await expect(field(/^Bore diameter/)).toHaveValue('')
  await expect(field(/^Bore area/)).toHaveValue('')
  await expect(field(/^Twist/)).toHaveValue('')
  await expect(field(/^Usable case volume/)).toHaveAccessibleDescription(/user design Mine 7\.8/)
  // the figure draws the design's case and chamber
  await expect(page.locator('.seating-figure svg[aria-labelledby]').first()).toHaveAccessibleName(
    /user design Mine 7\.8/,
  )

  // the run and the print name the design
  await form.getByRole('combobox', { name: /^Search bullets/ }).fill('168')
  await page.getByRole('option', { name: /168 gr/ }).click()
  await form.getByRole('combobox', { name: /^Search powders/ }).fill('DP40')
  await page.getByRole('option', { name: /DP40/ }).click()
  await field(/^Charge mass/).fill('2.4')
  await field(/^Bullet travel/).fill('600')
  await field(/^Twist/).fill('305')
  await field(/^Charge mass/).press('Control+Enter')
  await expect(page.getByText(/^Simulation done\. /)).toBeAttached({ timeout: 15_000 })
  await expect(page.locator('.note.user-design')).toContainText(
    'Case values from the user design Mine 7.8, not a catalogue record.',
  )
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.report-sub')).toContainText('user design Mine 7.8')
  await expect(page.locator('.report-inputs')).toContainText('Mine 7.8 (user design)')
})

test('a load saved on a design keeps the design by reference and reopens with it', async ({
  page,
}) => {
  // a native picker cannot be driven: the file goes to the origin private file system
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () =>
      (await navigator.storage.getDirectory()).getFileHandle('export.json', { create: true })
  })
  await page.goto('/workbench')
  await seedDesign(page)
  await page.reload()
  await page.getByRole('button', { name: 'Enter values by hand' }).click()
  const form = loadForm(page)
  await form.getByRole('combobox', { name: 'Search cartridges by name' }).fill('Mine')
  await page.getByRole('option', { name: 'Mine 7.8 (your design)' }).click()
  await form.getByRole('textbox', { name: /^Charge mass/ }).fill('2.4')
  await (await barButton(page, 'Save')).click()
  const stored = () =>
    page.evaluate(async () => {
      const db: IDBDatabase = await new Promise((ok, no) => {
        const r = indexedDB.open('openreloading-user-data')
        r.onsuccess = () => ok(r.result)
        r.onerror = () => no(r.error)
      })
      const all: { kind: string; name: string; data: { cartridge?: string } }[] = await new Promise(
        (ok, no) => {
          const r = db.transaction('records').objectStore('records').getAll()
          r.onsuccess = () => ok(r.result)
          r.onerror = () => no(r.error)
        },
      )
      db.close()
      return all.filter((r) => r.kind === 'workbenchState')
    })
  await expect
    .poll(async () => (await stored())[0]?.data.cartridge)
    .toBe('user:6f0f4d3e-0a43-4a43-9a3d-3a2f2e1f0c21')
  const [{ name }] = await stored()

  // another load, then the saved one: the design is back, from the design's own values
  await page.goto('/workbench')
  await (await barButton(page, 'Open')).click()
  await page.getByRole('menuitem', { name: /^Saved loads/ }).click()
  await page.getByRole('button', { name, exact: true }).click()
  const field = (label: RegExp) => form.getByRole('textbox', { name: label })
  await expect(page.locator('.seating-figure svg[aria-labelledby]').first()).toHaveAccessibleName(
    /user design Mine 7\.8/,
  )
  await expect(field(/^Bore area/)).toHaveValue('')
})
