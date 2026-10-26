import { expect, type Page, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { putRecords } from './user-store.ts'
import { loadForm } from './workbench.ts'

test.beforeEach(({ page }) => storeUnits(page))

const firearm = (id: string, name: string, landsBullet: string) => ({
  kind: 'firearm',
  id,
  name,
  saved: '2026-10-26T10:00:00.000Z',
  data: {
    origin: 'user',
    name,
    cartridge: 'catalogue:308-win',
    barrelLength: { value: 610 },
    twistHand: 'right',
    baseToOgiveAtLands: { value: 57 },
    landsBullet,
    optics: [],
    configurations: [],
  },
})

const row = (page: Page, term: string) =>
  page.locator('.seating-row').filter({ has: page.getByText(term, { exact: true }) })

async function chooseFirearm(page: Page, name: string) {
  await loadForm(page).getByRole('combobox', { name: 'Firearm from your library' }).click()
  await page.getByRole('option', { name }).click()
}

test("a firearm's lands contact gives the jump of the bullet it was measured with only", async ({
  page,
}) => {
  await gotoHydrated(page, '/firearms')
  await putRecords(page, [
    firearm('firearm-a', 'Lands rifle', 'catalogue:demo-bullet-168'),
    firearm('firearm-b', 'Other bullet rifle', 'catalogue:demo-bullet-150'),
  ])
  // the editor shows the contact's lengths and the bullet it names
  await gotoHydrated(page, '/firearms?record=firearm-a')
  await expect(page.getByRole('textbox', { name: /^Base to ogive at the lands/ })).toHaveValue('57')
  await expect(page.getByRole('textbox', { name: /^Overall length at the lands/ })).toHaveValue('')
  await expect(page.getByRole('combobox', { name: 'Bullet of the lands contact' })).toHaveAttribute(
    'placeholder',
    '30 Cal 168 gr HPBT Demo',
  )

  await gotoHydrated(page, '/workbench?cartridge=308-win&bullet=demo-bullet-168')
  const more = page.getByRole('button', { name: 'More of Cartridge' })
  await more.click()
  // without a firearm the jump rests on the chamber values
  await expect(row(page, 'Jump to the leade')).toBeVisible()
  await page.keyboard.press('Escape')

  // seated at L6 71.12 mm with a base to ogive of 14.5 mm and a bullet of 30.5 mm: the bullet
  // touches the lands at a CBTO of 57 mm, 1.88 mm further out than the seated 55.12 mm
  await chooseFirearm(page, 'Lands rifle')
  await more.click()
  await expect(row(page, 'Jump to the lands')).toContainText('1.88')
  await expect(row(page, 'Jump to the lands')).toContainText('measured lands contact')
  await page.keyboard.press('Escape')

  // a contact measured with another bullet is not used for this one
  await chooseFirearm(page, 'Other bullet rifle')
  await more.click()
  await expect(row(page, 'Jump to the leade')).toContainText('another bullet')
  await expect(row(page, 'Jump to the lands')).toHaveCount(0)
})
