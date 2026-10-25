import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { storeUnits } from './units.ts'
import { putRecords } from './user-store.ts'
import { runExample } from './workbench-run.ts'

/** Firearms in the browser store, as the library saves them; ids `firearm-<first>` on. */
async function seed(page: Page, names: string[], extra: object = {}, first = 0) {
  await putRecords(
    page,
    names.map((name, i) => ({
      kind: 'firearm',
      id: `firearm-${first + i}`,
      name,
      saved: '2026-10-20T00:00:00.000Z',
      data: {
        origin: 'user',
        name,
        cartridge: 'catalogue:308-win',
        barrelLength: { value: 610 },
        twist: { value: 254 },
        twistHand: 'right',
        optics: [],
        configurations: [],
        ...extra,
      },
    })),
  )
}

const status = (page: Page) => page.locator('.page-bar-status .bar-count')

test('the firearm library searches its table, counts the example and offers to clear a search without a match', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('safety-ack', '3')
  })
  await page.goto('/firearms')
  await seed(page, ['Bench rifle', 'Hunting rifle'])
  await page.reload()
  await expect(status(page)).toHaveText('3 firearms')
  // the browser's firearms first, the example load's rifle last
  await expect(page.locator('tbody tr[data-row]').last()).toContainText(
    'Example rifle, 308 Win. Example',
  )
  const search = page.getByRole('searchbox', { name: 'Search' })
  await search.fill('bench')
  await expect(status(page)).toHaveText('1 of 3 firearms')
  await expect(page).toHaveURL(/[?&]q=bench/)
  await expect(page.getByRole('link', { name: 'Bench rifle', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Hunting rifle', exact: true })).toHaveCount(0)
  await search.fill('zzz')
  await expect(page.getByText('No firearms match these filters.')).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).last().click()
  await expect(status(page)).toHaveText('3 firearms')
  // the example is the OpenReloading source, the browser's firearms are Mine
  await page.getByRole('button', { name: /^Source: / }).click()
  await page
    .getByRole('dialog', { name: /^Source: / })
    .getByRole('checkbox', { name: /^OpenReloading/ })
    .uncheck()
  await expect(status(page)).toHaveText('2 of 3 firearms')
  await expect(page).toHaveURL(/[?&]src=user/)
  await page.keyboard.press('Escape')
  await search.fill('example')
  await expect(page.getByText('Mine only, matching "example".', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).last().click()
  await expect(status(page)).toHaveText('3 firearms')
  // a row's link opens the firearm in the editor beside the cards
  await page.getByRole('link', { name: 'Bench rifle', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Bench rifle', level: 2 })).toBeVisible()
  await expect(page.locator('.library-list li')).toHaveCount(3)
  // the example opens read-only; Copy to edit starts an editable copy
  await page
    .locator('.library-list')
    .getByRole('button', { name: 'Example rifle, 308 Win.', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Example rifle, 308 Win.', level: 2 }),
  ).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Copy to edit' }).click()
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue(
    'Example rifle, 308 Win. copy',
  )
})

test('a record link does not put its loading status in the alert line', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('safety-ack', '3')
    const seen = { loading: false }
    Object.assign(window, { seen })
    new MutationObserver(() => {
      if (document.body?.innerText.includes('Loading the record')) seen.loading = true
    }).observe(document, { subtree: true, childList: true, characterData: true })
  })
  await page.goto('/firearms')
  await seed(page, ['Bench rifle'])
  await page.goto('/firearms?record=firearm-0')
  await expect(page.getByRole('textbox', { name: 'Name' }).first()).toHaveValue('Bench rifle')
  expect(
    await page.evaluate(() => (window as unknown as { seen: { loading: boolean } }).seen.loading),
  ).toBe(false)
})

test('the zero air and drag factor of a mount fill the trajectory form with the factor shown with its source', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await storeUnits(page)
  await page.addInitScript(() => {
    localStorage.setItem('safety-ack', '3')
  })
  await page.goto('/firearms')
  await seed(page, ['Truing rifle'], {
    optics: [{ id: 'o1', kind: 'scope', name: 'Scope' }],
    configurations: [
      {
        id: 'c1',
        name: 'Summer',
        mounts: [
          {
            optic: 'o1',
            sightHeight: { value: 50 },
            zeroRange: { value: 100000 },
            zeroTemperature: { value: 35 },
            zeroPressure: { value: 0.95 },
            zeroHumidity: { value: 40 },
            dragFactor: 1.034,
            dragFactorSource: 'Truing session of 2026-09-14',
          },
        ],
      },
    ],
    active: 'c1',
  })
  await seed(
    page,
    ['Plain rifle'],
    {
      optics: [{ id: 'o1', kind: 'scope', name: 'Scope' }],
      configurations: [
        {
          id: 'c1',
          name: 'Summer',
          mounts: [{ optic: 'o1', sightHeight: { value: 50 }, zeroRange: { value: 100000 } }],
        },
      ],
    },
    1,
  )
  await runExample(page)
  await page.getByRole('tab', { name: 'Trajectory', exact: true }).click()
  await expect(page.getByRole('table', { name: /^Trajectory: / })).toBeVisible()
  // the load's firearm fills the trajectory form's sight, zero air and drag factor
  // anchored: the unit switch of a field is named after it too
  const field = (name: string) =>
    page.getByLabel(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
  const gun = page.getByRole('combobox', { name: 'Firearm from your library' })
  await gun.click()
  await page.getByRole('option', { name: 'Truing rifle' }).click()
  await expect(field('Zero temperature')).toHaveValue('35')
  await expect(field('Zero pressure')).toHaveValue('950')
  await expect(field('Zero humidity')).toHaveValue('40')
  await expect(field('Drag factor')).toHaveValue('103.4')
  await expect(page.getByText('Drag factor source: Truing session of 2026-09-14')).toBeVisible()
  // the result names what it applied, on screen and on the printed range card
  await expect(page.getByText(/^Drag factor applied: 103.4 %, Truing session/)).toBeVisible()
  await expect(
    page.getByText(/^Zero air: 35 °C, station pressure 950 hPa, humidity 40 %/),
  ).toBeVisible()
  await expect(page.locator('.range-card')).toContainText('103.4 %, Truing session of 2026-09-14')
  // an edited factor is no longer the one the source names
  await field('Drag factor').fill('105')
  await expect(page.getByText('Drag factor source:')).toHaveCount(0)
  await expect(page.getByText(/^Drag factor applied: 105 %$/)).toBeVisible()
  // a firearm without them empties the fields
  await gun.click()
  await page.getByRole('option', { name: 'Plain rifle' }).click()
  await expect(field('Drag factor')).toHaveValue('')
  await expect(field('Zero temperature')).toHaveValue('')
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    const { violations } = await new AxeBuilder({ page }).include('.trajectory-view form').analyze()
    expect(violations).toEqual([])
  }
})
