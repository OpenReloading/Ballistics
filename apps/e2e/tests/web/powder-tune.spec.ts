import { expect, type Page, test } from '@playwright/test'
import { problems } from './a11y.ts'
import { gotoHydrated } from './nav.ts'
import { openFit } from './powder-tune-run.ts'
import { storeUnits } from './units.ts'
import { putRecords } from './user-store.ts'
import { applyExampleLoad, loadForm } from './workbench.ts'
import { runLine } from './workbench-run.ts'

// The powder tuning route lists the chronograph strings of the open load per charge and takes more
// typed in; the Measurements tab and the powder designer link to it
// Metric (SI): g, m/s
test.beforeEach(({ page }) => storeUnits(page))

const file = [
  'string,velocity,velocityUnit,coldBore,excluded',
  'A,850,m/s,,',
  'A,854,m/s,,',
  'A,852,m/s,,',
].join('\n')

const table = (page: Page) => page.getByRole('table', { name: 'Strings', exact: true })

const noSideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)

test('the Measurements tab opens the route with the load strings, and an added string joins the table', async ({
  page,
}) => {
  await page.goto('/workbench')
  await applyExampleLoad(page)
  await runLine(page)
  await page.getByRole('tab', { name: 'Measurements', exact: true }).click()
  await page
    .locator('input[type="file"]#measurements-file')
    .setInputFiles({ name: 'day1.csv', mimeType: 'text/csv', buffer: Buffer.from(file) })
  await page.getByRole('link', { name: 'Fit a powder from these strings' }).click()
  // the example load is unsaved work: the page asks before it is left
  await page
    .getByRole('dialog', { name: /^Leave this page\?/ })
    .getByRole('button', { name: 'Leave', exact: true })
    .click()
  await expect(page).toHaveURL(/\/powders\/tune\/?\?session=/)

  const rows = table(page).locator('tbody tr')
  await expect(rows).toHaveCount(1)
  // shots, mean and SD of the string 850, 854, 852 m/s, at the load's temperature
  await expect(rows.first().locator('td').nth(1)).toHaveText('')
  await expect(rows.first().locator('td').nth(2)).toHaveText('3')
  await expect(rows.first().locator('td').nth(3)).toHaveText('852.0')
  await expect(rows.first().locator('td').nth(4)).toHaveText('2.0')
  // the example load is not saved: its strings name no load, so no fit runs
  await expect(page.getByText('Save the load to fit a powder from its strings.')).toBeVisible()
  await expect(page.getByText(/^Fitted vivacity/)).toHaveCount(0)

  // a field that does not read says why on the field, and nothing is added
  const charge = page.getByRole('textbox', { name: 'Charge (g)' })
  const shots = page.getByRole('textbox', { name: /^Shot velocities/ })
  const temperature = page.getByRole('textbox', { name: 'Temperature (°C)' })
  await shots.fill('900 x')
  await temperature.fill('warm')
  await page.getByRole('button', { name: 'Add a string' }).click()
  await expect(charge).toHaveAttribute('aria-invalid', 'true')
  await expect(shots).toHaveAccessibleDescription(/One or more numbers above 0/)
  await expect(temperature).toHaveAccessibleDescription(/A number, or empty/)
  await expect(rows).toHaveCount(1)

  await charge.fill('9.9')
  await expect(charge).not.toHaveAttribute('aria-invalid', 'true')
  await shots.fill('900 904')
  await temperature.fill('5')
  await page.getByRole('button', { name: 'Add a string' }).click()
  await expect(rows).toHaveCount(2)
  await expect(rows.last().locator('td').nth(1)).toHaveText('5.0')
  await expect(rows.last().locator('td').nth(3)).toHaveText('902.0')

  // a string added here can be removed and brought back; the load's has no Remove
  await expect(rows.first().getByRole('button', { name: /^Remove/ })).toHaveCount(0)
  await rows
    .last()
    .getByRole('button', { name: /^Remove the string at 9\.9/ })
    .click()
  await expect(rows).toHaveCount(1)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(rows).toHaveCount(2)
  await expect(
    page.getByText('All values on this screen are simulations, not load data.'),
  ).toBeVisible()

  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    expect(await noSideScroll(page)).toBe(true)
  }
})

/**
 * Milliseconds from each of `moves` arrow key presses on the first hand-tuning slider to the
 * redraw of the curve, measured in the page; half the moves go right, then back left.
 */
const redrawTimes = (page: Page, moves: number) =>
  page.evaluate(async (n) => {
    const thumb = document.querySelector('.hand-tune [role="slider"]')
    const curve = document.querySelector('.tune-chart .curve')
    if (!thumb || !curve) throw new Error('no slider or curve')
    const times: number[] = []
    for (let i = 0; i < n; i++) {
      const before = curve.getAttribute('points')
      const t0 = performance.now()
      const redrawn = new Promise<void>((done) => {
        const o = new MutationObserver(() => {
          if (curve.getAttribute('points') === before) return
          o.disconnect()
          done()
        })
        o.observe(curve, { attributes: true })
      })
      const key = i < n / 2 ? 'ArrowRight' : 'ArrowLeft'
      thumb.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      await Promise.race([
        redrawn,
        new Promise((_, fail) =>
          setTimeout(() => fail(new Error(`move ${i + 1} (${key}): no redraw within 2 s`)), 2000),
        ),
      ])
      times.push(performance.now() - t0)
    }
    return times
  }, moves)

test('the Measurements link of a saved load fits the powder on the load the workbench runs, and its sliders tune it by hand', async ({
  page,
}) => {
  // the fit may take up to 60 s after a run, a save and a navigation, the 30 redraws 2 s each
  test.setTimeout(150_000)
  await openFit(page)
  await expect(page.getByText('Save the load to fit a powder from its strings.')).toHaveCount(0)

  const hand = page.getByRole('group', { name: 'Hand tuning' })
  const mark = hand.getByText('Hand-tuned', { exact: true })
  const back = hand.getByRole('button', { name: 'Back to the fit' })
  await expect(mark).toHaveCount(0)
  await expect(back).toBeDisabled()
  await hand.getByRole('slider', { name: 'Vivacity' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(mark).toBeVisible()
  await expect(
    hand.getByText('Hand-tuned values are yours, not a fit. Simulation, not load data.'),
  ).toBeVisible()
  expect(await problems(page, 'powder tune, hand-tuned', '.hand-tune')).toEqual([])

  const times = (await redrawTimes(page, 30)).sort((a, b) => a - b)
  // parallel workers slow a healthy redraw, so the median bound is wide; each move keeps its 2 s deadline
  expect(times[15]).toBeLessThanOrEqual(500)

  await back.click()
  await expect(mark).toHaveCount(0)
  await expect(back).toBeDisabled()
})

test('the powder designer links to the tuning route, where strings typed without a load say why there is no fit', async ({
  page,
}) => {
  await gotoHydrated(page, '/powders/designer')
  await page.getByRole('link', { name: 'Fit a powder from chronograph strings' }).click()
  await expect(page).toHaveURL(/\/powders\/tune\/?$/)
  await page.getByRole('textbox', { name: 'Charge (g)' }).fill('2.5')
  await page.getByRole('textbox', { name: /^Shot velocities/ }).fill('800 804')
  await page.getByRole('button', { name: 'Add a string' }).click()
  await expect(table(page).locator('tbody tr')).toHaveCount(1)
  await expect(
    page.getByText("No fit: open this page from a saved load's Measurements tab."),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open the workbench' })).toBeVisible()
})

const sessionId = '3c1d4e8f-9a6b-4d2c-8e1f-7a300b5f7a2e'
/** A saved load of the demo powder DP40 with a session whose string is mapped to a charge. */
const savedLadder = [
  {
    kind: 'session',
    id: sessionId,
    name: 'Ladder',
    saved: '2026-10-28T00:00:00.000Z',
    data: {
      origin: 'user',
      device: { kind: 'doppler-radar' },
      strings: [
        {
          variation: { kind: 'charge', value: { value: 2.5 } },
          shots: [{ velocity: { value: 800 } }, { velocity: { value: 804 } }],
        },
      ],
      provenance: { kind: 'measured', sources: [{ title: 'Ladder' }] },
    },
  },
  {
    kind: 'load',
    id: '4d2e5f9a-0b7c-4e3d-9f2a-8b411c6a8b3f',
    name: 'DP40 ladder',
    saved: '2026-10-28T00:00:00.000Z',
    data: {
      origin: 'user',
      powder: 'catalogue:demo-powder-dp40',
      sessions: [`user:${sessionId}`],
    },
  },
]

test('the powder record links to the tuning route, whose powder select lists the saved loads of each powder', async ({
  page,
}) => {
  await gotoHydrated(page, '/powders/demo-powder-dp40/')
  await putRecords(page, savedLadder)
  await page.getByRole('link', { name: 'Tune from strings' }).click()
  await expect(page).toHaveURL(/\/powders\/tune\/?\?powder=catalogue%3Ademo-powder-dp40/)
  const select = page.getByRole('combobox', { name: 'Powder' })
  await expect(select.locator('option:checked')).toHaveText('Demo Powder Co. DP40')
  const loads = page.getByRole('navigation', { name: 'Saved loads with this powder' })
  await expect(loads.getByRole('link', { name: 'DP40 ladder' })).toBeVisible()

  // opened bare, the select asks for a powder and its choice lists the loads
  await gotoHydrated(page, '/powders/tune')
  await expect(select.locator('option:checked')).toHaveText('Choose a powder')
  await select.selectOption({ label: 'Demo Powder Co. DP40' })
  await expect(page).toHaveURL(/\?powder=catalogue%3Ademo-powder-dp40/)
  await expect(loads.getByRole('link', { name: 'DP40 ladder' })).toBeVisible()
})

test('a saved powder design opens the route with the saved loads that use it', async ({ page }) => {
  await gotoHydrated(page, '/powders/designer')
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Tuned')
  await expect(page.getByText('Saved in this browser')).toBeVisible()
  await page.getByRole('link', { name: 'Fit a powder from chronograph strings' }).click()
  await expect(page).toHaveURL(/\/powders\/tune\/?\?powder=user/)
  await expect(page.getByText('No saved load uses this powder.', { exact: false })).toBeVisible()
})

/** A fitted user powder as the tuning screen saves it, in stored units; `previous` names the record it refits. */
const fittedRecord = (id: string, name: string, vivacity: number, previous?: string) => ({
  kind: 'powder',
  id,
  name,
  saved: '2026-10-28T00:00:00.000Z',
  data: {
    origin: 'user',
    provenanceKind: 'fitted',
    draft: {
      interior: {
        model: 'm3',
        fitted: ['vivacity'],
        vivacity: { value: vivacity },
        energy: { value: 3950000 },
        gamma: 1.215,
        covolume: { value: 0.00097 },
        density: { value: 1.6 },
        pressureExponent: 1,
        referencePressure: { value: 0.980665 },
        ignitionPressure: { value: 50 },
        propellantTemperature: { value: 21 },
        burnForm: { kind: 'twoStage', a: { value: 0.05 }, m: 0.5, q: 0.5, z1: 0.8 },
      },
    },
    fit: {
      input: [
        {
          charge: { value: 2.6 },
          muzzleVelocity: { value: 850 },
          shots: 3,
          barrelLength: { value: 600 },
          temperature: { value: 21 },
          caseCapacity: { value: 3.4 },
          bulletMass: { value: 9.5 },
        },
      ],
      parameters: ['burnRate'],
      options: { loss: { kind: 'quadratic' } },
      date: previous ? '2026-10-28T00:00:00.000Z' : '2026-10-27T00:00:00.000Z',
      model: 'm3',
      modelVersion: '0.0.1',
      confidence: 'loose',
      reasons: [],
      sessions: [],
      ...(previous && { previous }),
    },
  },
})

test('a load on a refitted powder says a newer fit exists and moves to it', async ({ page }) => {
  const old = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
  await page.goto('/workbench')
  await putRecords(page, [
    fittedRecord(old, 'DP40', 0.612),
    fittedRecord('8b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d5e', 'DP40 (fit 2)', 0.64, `user:${old}`),
  ])
  await page.reload()
  await page.getByRole('button', { name: 'Enter values by hand' }).click()
  const form = loadForm(page)
  const search = form.getByRole('combobox', { name: /^Search powders/ })
  await search.fill('DP40')
  await page.getByRole('option', { name: 'DP40 (your design)', exact: true }).click()
  const note = page.getByText('A newer fit of this powder exists.')
  await expect(note).toBeVisible()
  await page.getByRole('button', { name: 'Use the refit' }).click()
  // the card head shows the chosen record as the search field's placeholder
  await expect(search).toHaveAttribute('placeholder', 'DP40 (fit 2) (your design)')
  await expect(note).toHaveCount(0)
})
