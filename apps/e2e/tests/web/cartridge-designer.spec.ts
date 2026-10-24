import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'

// Metric (SI): lengths in mm
test.beforeEach(({ page }) => storeUnits(page))

// one figure of both sides with the views (the record page draws a figure per side)
const drawing = (page: Page) => page.locator('svg[aria-labelledby="designer-drawing-title"]')
const desc = (page: Page) => page.locator('#designer-drawing-desc')
const field = (page: Page, label: string, unit = 'mm') =>
  page.getByRole('textbox', { name: `${label} (${unit})`, exact: true })

test('the cartridge list and page link to the designer, which starts from the record', async ({
  page,
}) => {
  await page.goto('/cartridges')
  await page.getByRole('link', { name: 'New cartridge' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cartridge designer')
  // no back link and no lead
  await expect(field(page, 'Cartridge R1')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to the cartridge list' })).toHaveCount(0)
  // Enter chooses the only match, none highlighted
  const search = page.getByRole('combobox', { name: 'Start from a record' })
  await search.fill('308 Win')
  await expect(page.getByRole('option', { name: /CIP table/ })).toHaveCount(1)
  await search.press('Enter')
  await expect(page.getByText('Started from CIP 308 Win.')).toBeVisible()

  await page.goto('/cartridges/308-win')
  await page.getByRole('link', { name: 'Open in designer' }).click()
  await expect(page).toHaveURL(/\/cartridges\/designer\?from=308-win$/)
  await expect(field(page, 'Cartridge L3')).toHaveValue('51.18')
  await expect(field(page, 'Cartridge L3')).toHaveAccessibleDescription(
    'Case length. From the record.',
  )
  await expect(field(page, 'Chamber G1')).toHaveValue('7.87')
  await expect(page.getByText('Started from CIP 308 Win.')).toBeVisible()
  // the chosen record shows in the search field
  await expect(page.getByRole('combobox', { name: 'Start from a record' })).toHaveAttribute(
    'placeholder',
    'CIP 308 Win.',
  )
  await expect(drawing(page)).toBeVisible()
  // the views Cartridge, Chamber and Combined; both sides given, Combined first
  for (const view of ['Cartridge', 'Chamber', 'Combined'])
    await expect(page.getByRole('radio', { name: view })).toBeEnabled()
  await expect(page.getByRole('radio', { name: 'Combined' })).toBeChecked()
})

test('a change redraws, is marked with the record value and undoes', async ({ page }) => {
  await page.goto('/cartridges/designer?from=308-win')
  await expect(desc(page)).toContainText('L1 39.62 mm')
  await field(page, 'Cartridge L1').fill('39')
  await expect(desc(page)).toContainText('L1 39 mm')
  // the outline note on the shoulder angle shows in the L1 help, not as an error
  await expect(field(page, 'Cartridge L1')).toHaveAccessibleDescription(
    /^Head to the shoulder start \(P2\)\. Changed; record 39\.62 mm\. .*differs from the .* degrees of the shoulder/,
  )
  await expect(field(page, 'Cartridge L1')).not.toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('.derived-line')).toContainText('Cartridge shoulder angle')
  // a CIP plausibility finding at both fields, the drawing kept
  await field(page, 'Cartridge P1').fill('12.5')
  await expect(field(page, 'Cartridge P1')).toHaveAccessibleDescription(
    /cartridge P1 = 12\.5 mm exceeds chamber P1 = 11\.99 mm/,
  )
  await expect(field(page, 'Chamber P1')).toHaveAccessibleDescription(/exceeds chamber P1/)
  await expect(page.getByText('Drawing for earlier inputs.')).toHaveCount(0)
  await (await barButton(page, 'Undo')).click()
  await (await barButton(page, 'Undo')).click()
  await expect(field(page, 'Cartridge L1')).toHaveValue('39.62')
  await expect(desc(page)).toContainText('L1 39.62 mm')
})

test('a refused input shows its reason at the field and keeps the last drawing', async ({
  page,
}) => {
  await page.goto('/cartridges/designer?from=308-win')
  await expect(desc(page)).toContainText('L1 39.62 mm')
  await field(page, 'Cartridge L1').fill('-1')
  await expect(field(page, 'Cartridge L1')).toHaveAttribute('aria-invalid', 'true')
  await expect(field(page, 'Cartridge L1')).toHaveAccessibleDescription(
    /Cartridge L1 must be at least 0 mm\./,
  )
  await expect(page.getByText('Drawing for earlier inputs. Fix Cartridge L1:')).toBeVisible()
  await expect(drawing(page)).toBeVisible()
  await expect(desc(page)).toContainText('L1 39.62 mm')
  await field(page, 'Cartridge L1').fill('39.5')
  await expect(page.getByText('Drawing for earlier inputs.')).toHaveCount(0)
  await expect(desc(page)).toContainText('L1 39.5 mm')
})

test('a new cartridge without its base values gives a reason, not an empty page', async ({
  page,
}) => {
  await page.goto('/cartridges/designer')
  // before an edit: no error styling, the instruction once, in the drawing pane
  await expect(field(page, 'Cartridge R1')).toBeVisible()
  await expect(page.locator('main [aria-invalid="true"]')).toHaveCount(0)
  await expect(page.getByText(/R1, R, P1, L3 and H2/)).toHaveCount(1)
  await expect(page.locator('.workspace-results').getByText(/R1, R, P1, L3 and H2/)).toBeVisible()
  await expect(page.getByText('Drawing for earlier inputs')).toHaveCount(0)
  // the first edit shows the reason at the field
  await field(page, 'Cartridge R').fill('1.3')
  await expect(
    page.getByText(/Fix Cartridge R1: Cartridge not drawn: missing R1, P1, L3, H2/),
  ).toBeVisible()
  await expect(field(page, 'Cartridge R1')).toHaveAttribute('aria-invalid', 'true')
  for (const [symbol, value] of [
    ['R1', '12'],
    ['R', '1.3'],
    ['P1', '11.9'],
    ['L3', '50'],
    ['H2', '8.7'],
  ])
    await field(page, `Cartridge ${symbol}`).fill(value)
  // without a record there is no chamber: Chamber and Combined disabled
  await expect(drawing(page)).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Cartridge' })).toBeChecked()
  for (const view of ['Chamber', 'Combined'])
    await expect(page.getByRole('radio', { name: view })).toBeDisabled()
  await expect(desc(page)).toContainText('L3 50 mm')
})

/** The places of every input of the form and of the drawing, relative to their columns. */
const places = (page: Page) =>
  page.locator('form').evaluate((form) => {
    const top = form.getBoundingClientRect().top
    // hidden inputs (the sliders' values) have no box
    return [...form.querySelectorAll('input:not([type="hidden"])')].map((i) => {
      const r = i.getBoundingClientRect()
      return [r.left, r.top - top, r.width].map(Math.round)
    })
  })
const drawingTop = (page: Page) =>
  page.locator('.designer-drawing').evaluate((d) => {
    const pane = d.closest('.workspace-results') as HTMLElement
    return Math.round(d.getBoundingClientRect().top - pane.getBoundingClientRect().top)
  })

test('a change, a check and a refusal move no field and not the drawing', async ({ page }) => {
  await page.goto('/cartridges/designer?from=308-win')
  await expect(drawing(page)).toBeVisible()
  // the seating controls come with their own chunk (`SeatingPreview`, client only) and add three
  // inputs below the form: measured only once they are there, else a slow chunk moves the baseline
  await expect(field(page, 'Case capacity (H₂O)', 'cm³')).toBeVisible()
  const before = await places(page)
  const top = await drawingTop(page)
  // changed (with an outline note in the help), then a check at both P1 fields
  await field(page, 'Cartridge L1').fill('39')
  await field(page, 'Cartridge P1').fill('12.5')
  await expect(field(page, 'Chamber P1')).toHaveAttribute('aria-invalid', 'true')
  expect(await places(page)).toEqual(before)
  await field(page, 'Cartridge L1').fill('-1')
  await expect(page.getByText('Drawing for earlier inputs. Fix Cartridge L1:')).toBeVisible()
  expect(await places(page)).toEqual(before)
  expect(await drawingTop(page)).toBe(top)
})

test('keyboard: arrow keys step the field, no slider, changes are announced', async ({ page }) => {
  await page.goto('/cartridges/designer?from=308-win')
  await expect(field(page, 'Cartridge L1')).toHaveValue('39.62')
  await expect(page.getByRole('slider')).toHaveCount(0)
  await field(page, 'Cartridge L1').press('ArrowUp')
  await expect(field(page, 'Cartridge L1')).toHaveValue('39.63')
  const status = page.getByRole('status').filter({ hasText: 'Drawing updated' })
  await expect(status).toContainText(
    /Cartridge L1 39\.63\. Drawing updated\. .*Cartridge neck length 7\.70 mm/,
  )
  // for screen readers only: not shown and not printed
  expect((await status.boundingBox())?.width).toBeLessThanOrEqual(1)
  // no unit menu in the grid: Tab goes on to the chamber's L1 in the same row
  await page.keyboard.press('Tab')
  await expect(field(page, 'Chamber L1')).toBeFocused()
})

test('print shows the life-size drawing and the values, not the form', async ({ page }) => {
  await page.goto('/cartridges/designer?from=308-win')
  await expect(drawing(page)).toBeVisible()
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('svg[aria-labelledby="designer-drawing-print-title"]')).toBeVisible()
  await expect(drawing(page)).toBeHidden()
  // the Combined view on screen: print still gives the cartridge and the chamber dimensioned
  for (const side of ['cartridge', 'chamber'])
    await expect(
      page.locator(`svg.drawing-print .dims-${side}`).locator('visible=true'),
    ).toHaveCount(1)
  const values = page.getByRole('table', { name: 'Values of the design' })
  await expect(values).toBeVisible()
  await expect(values.getByRole('row', { name: /^Cartridge L3 51\.18 mm/ })).toBeVisible()
  await expect(field(page, 'Cartridge L3')).toBeHidden()
  await expect(page.getByRole('combobox', { name: 'Start from a record' })).toBeHidden()
  await expect(page.getByRole('radio', { name: 'Combined' })).toBeHidden()
})

test('the designer has no axe violation in light and dark, and fits 390 px', async ({ page }) => {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await page.goto('/cartridges/designer?from=308-win')
    await expect(field(page, 'Cartridge L3')).toHaveValue('51.18')
    // a changed field, a check and a refusal on screen too
    await field(page, 'Cartridge P1').fill('12.5')
    await field(page, 'Cartridge L1').fill('-1')
    await expect(field(page, 'Cartridge L1')).toHaveAttribute('aria-invalid', 'true')
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(violations.map((v) => `${colorScheme} ${v.id} ${v.nodes.map((n) => n.target)}`)).toEqual(
      [],
    )
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/cartridges/designer?from=308-win')
  await expect(field(page, 'Cartridge L3')).toHaveValue('51.18')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
  // the live region speaks on the phone too
  await field(page, 'Cartridge L1').fill('39')
  await expect(page.getByRole('status').filter({ hasText: 'Drawing updated' })).toContainText(
    'Cartridge L1 39. Drawing updated.',
  )
  // the drawing stays in view above the field being edited
  await expect(drawing(page)).toBeInViewport()
  await expect(field(page, 'Cartridge L1')).toBeInViewport()
  await field(page, 'Chamber F').fill('7.7')
  await expect(drawing(page)).toBeInViewport()
  await expect(field(page, 'Chamber F')).toBeInViewport()
})

test('the designer shows no load-data notice; the caption says how changes are drawn', async ({
  page,
}) => {
  await page.goto('/cartridges/designer?from=308-win')
  await expect(drawing(page)).toBeVisible()
  await expect(page.locator('main')).not.toContainText('not load data')
  await expect(page.locator('main')).not.toContainText('simulations')
  await expect(page.locator('.designer-drawing figcaption').first()).toContainText(
    "Changed values are drawn as entered, without the record's tolerances.",
  )
})

/** A bullet design with a hollow base in the browser store, as the bullet designer saves it. */
async function seedHollowBaseDesign(page: Page) {
  await page.evaluate(async () => {
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
      kind: 'bullet',
      id: '6f0f4d3e-0a43-4a43-9a3d-3a2f2e1f0c22',
      name: 'Hollow base',
      saved: '2026-10-20T00:00:00.000Z',
      data: {
        origin: 'user',
        manufacturerName: '',
        overrides: {
          name: 'Hollow base',
          diameter: { value: 7.823 },
          mass: { value: 10.886 },
          length: { value: 30.5 },
          noseLength: { value: 16 },
          bearingLength: { value: 10.7 },
          baseToOgive: { value: 14.5 },
          base: {
            type: 'conical-hollow-base',
            length: { value: 3.8 },
            diameter: { value: 6.62 },
            angle: { value: 9 },
            cavityDiameter: { value: 4 },
          },
          ogive: { form: 'tangent' },
        },
      },
    })
    await new Promise((ok) => {
      tx.oncomplete = ok
    })
    db.close()
  })
}

test('a chosen bullet seats at the entered COAL in the designed case, and the seating moves the volume', async ({
  page,
}) => {
  await gotoHydrated(page, '/cartridges/designer?from=308-win')
  await expect(field(page, 'Cartridge L3')).toHaveValue('51.18')
  const row = (term: string) =>
    page.locator('.seating-row').filter({ has: page.getByText(term, { exact: true }) })
  const number = async (term: string) =>
    Number.parseFloat((await row(term).locator('.num').textContent()) ?? '')
  const seated = page.locator('.seating-figure svg')
  // no bullet and no length: nothing seated, no default filled in
  await expect(seated).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Search bullets by manufacturer or name' }).fill('168')
  await page.getByRole('option', { name: /168 gr/ }).click()
  await expect(page.getByText('Bullet: Demo Bullets 30 Cal 168 gr HPBT Demo')).toBeVisible()
  await expect(seated).toHaveCount(0)
  await page.getByRole('textbox', { name: /^COAL/ }).fill('71')
  await expect(seated).toBeVisible()
  await expect(seated).toHaveAccessibleDescription(/seated at COAL 71\.00 mm/)
  // from the design's case length: 51.18 - (71 - 30.5)
  expect(await number('Seating depth')).toBeCloseTo(10.68, 2)
  // what the design or the inputs lack is not given, with no number
  for (const term of ['Case volume to the mouth', 'Volume behind the bullet'])
    await expect(row(term)).toContainText('not given')
  await expect(row('Travel to the muzzle')).toContainText('not given')
  // a measured capacity gives the volume, and deeper seating takes more of it
  await page.getByRole('textbox', { name: /^Case capacity/ }).fill('3.5')
  const shallow = await number('Volume behind the bullet')
  expect(shallow).toBeGreaterThan(0)
  await page.getByRole('slider', { name: 'Slide to change COAL' }).press('Home')
  await expect.poll(() => number('Volume behind the bullet')).toBeLessThan(shallow)
  // the figure takes the case from the design, not from the record
  await page.getByRole('textbox', { name: /^COAL/ }).fill('71')
  await field(page, 'Cartridge L3').fill('52.18')
  await expect.poll(() => number('Seating depth')).toBeCloseTo(11.68, 2)
  // a chamber without the leade gives no jump, and says what it lacks
  await field(page, 'Chamber s').fill('')
  await field(page, 'Chamber G').fill('')
  await expect(row('Jump to the leade')).toContainText('not given')
  await expect(row('Jump to the leade')).toContainText('chamber')
  // a bullet design of this browser seats too: its hollow base makes the volume approximate
  await seedHollowBaseDesign(page)
  // the list is read when the select takes the focus
  const designs = page.getByRole('combobox', { name: 'Or a bullet design' })
  await designs.focus()
  await designs.selectOption({ label: 'Hollow base' })
  await expect(page.getByText('Bullet: Hollow base (user design')).toBeVisible()
  await expect(row('Volume behind the bullet')).toContainText('approximate')
  await expect(seated).toHaveAccessibleDescription(/seated at COAL 71\.00 mm/)
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    // retried: the controls' colours fade to the new scheme
    await expect
      .poll(async () => {
        const { violations } = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze()
        return violations.map((v) => `${colorScheme} ${v.id} ${v.nodes.map((n) => n.target)}`)
      })
      .toEqual([])
  }
})

test('a design whose base record is gone opens read only with the reason', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
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
      id: '6f0f4d3e-0a43-4a43-9a3d-3a2f2e1f0c23',
      name: 'Orphan',
      saved: '2026-10-24T00:00:00.000Z',
      data: { origin: 'user', basedOn: 'catalogue:no-such-cartridge-1', overrides: { table: 'I' } },
    })
    await new Promise((ok) => {
      tx.oncomplete = ok
    })
    db.close()
  })
  await gotoHydrated(page, '/cartridges/designer?record=6f0f4d3e-0a43-4a43-9a3d-3a2f2e1f0c23')
  await expect(page.getByText(/no-such-cartridge-1 is no longer in the catalogue/)).toBeVisible()
  await expect(field(page, 'Cartridge L3')).toBeDisabled()
})
