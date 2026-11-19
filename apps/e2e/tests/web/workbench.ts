import { expect, type Page } from '@playwright/test'
import { barButton } from './bar.ts'
import { putRecords } from './user-store.ts'

/** The workbench's input column: panels Cartridge, Bullet, Powder, Gun and the Run bar. */
export const loadForm = (page: Page, name = 'Load') => page.getByRole('form', { name })

/** The text of every field of the load form. */
export const formValues = (page: Page) =>
  loadForm(page)
    .getByRole('textbox')
    .evaluateAll((els) =>
      els.map((e) => [e.getAttribute('aria-label') ?? '', (e as HTMLInputElement).value]),
    )

/** A rifle of the browser store with one scope, as the firearm library saves it. */
export const fixtureRifle = {
  kind: 'firearm',
  id: '3b7e6d1c-5a2f-4e0b-8c94-1d6f0a9b2e57',
  name: 'Club rifle, 308 Win.',
  saved: '2026-10-14T00:00:00.000Z',
  data: {
    origin: 'user',
    name: 'Club rifle, 308 Win.',
    cartridge: 'catalogue:308-win',
    barrelLength: { value: 609.6 },
    twist: { value: 305 },
    twistHand: 'right',
    firearmMass: { value: 7000 },
    optics: [{ id: 'scope', kind: 'scope', name: 'Club scope' }],
    configurations: [
      {
        id: 'bench',
        name: 'Bench',
        mounts: [{ optic: 'scope', sightHeight: { value: 50 }, zeroRange: { value: 100000 } }],
      },
    ],
    active: 'bench',
  },
}

/** A load of the demo records in the fixture rifle, as the workbench saves it. */
export const fixtureLoad = {
  kind: 'load',
  id: '2392880e-2b81-4ea6-971b-ca8f779e6f76',
  name: 'Club load 308',
  saved: '2026-11-14T18:22:41.596Z',
  data: {
    origin: 'user',
    cartridge: 'catalogue:308-win',
    firearm: `user:${fixtureRifle.id}`,
    bullet: 'catalogue:demo-bullet-168',
    powder: 'catalogue:demo-powder-dp40',
    charge: { value: 2.4 },
    seating: { by: 'overallLength', value: { value: 71.12 } },
    analysis: {
      overrides: {
        boreDiameter: 7.62,
        boreArea: 47.51,
        twist: 305,
        propellantTemperature: 15,
        startPressure: 300,
      },
      ladder: { stepCount: 5, step: 0.012959782, direction: 'down' },
    },
    case: { record: 'catalogue:demo-case-308-brass' },
  },
}

/** Opens the stored fixture load from the Open menu's Saved loads drawer. */
export async function chooseSavedLoad(page: Page, language: 'en' | 'de' = 'en') {
  const de = language === 'de'
  const item = page.getByRole('menuitem', {
    name: de ? /^Gespeicherte Laborierungen/ : /^Saved loads/,
  })
  const name = page.getByRole('button', { name: fixtureLoad.name, exact: true })
  const drawer = page.getByRole('dialog', {
    name: de ? 'Gespeicherte Laborierungen' : 'Saved loads',
  })
  // retried: the menu can close again before the item's click while the page still hydrates; an open drawer's overlay blocks the menu, so then only its list is awaited
  await expect(async () => {
    if (!(await drawer.isVisible())) {
      if (!(await item.isVisible()))
        await (await barButton(page, de ? 'Öffnen' : 'Open')).click({ timeout: 1000 })
      await item.click({ timeout: 1000 })
    }
    await name.waitFor({ timeout: 2000 })
  }).toPass({ timeout: 15_000 })
  await name.click()
}

/** Stores the fixture load and rifle (or `firearm` under the rifle's id), opens the load from the Open menu of the fresh workbench and waits until it is complete, so a run sees all its values. */
export async function openSavedLoad(
  page: Page,
  language: 'en' | 'de' = 'en',
  firearm: typeof fixtureRifle = fixtureRifle,
) {
  const de = language === 'de'
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' })
  await putRecords(page, [firearm, fixtureLoad])
  // the workbench reads the firearms as it mounts
  await page.reload()
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' })
  // the result tabs measure their row with the web fonts in place
  await page.evaluate(() => document.fonts.ready)
  await chooseSavedLoad(page, language)
  // complete once its bullet is seated: volume and travel follow the seating
  await expect(
    loadForm(page, de ? 'Laborierung' : 'Load').locator('.field-flag-seating'),
  ).toHaveCount(2)
}
