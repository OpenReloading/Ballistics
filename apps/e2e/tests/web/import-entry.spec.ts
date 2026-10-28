import { expect, type Page, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { gotoHydrated } from './nav.ts'

// invented bullets, no maker's catalogue
const header = 'Name,Maker,Diameter (mm),Weight (gr),BC G1'
const rows = [
  'Alpha 150,Invented Arms,7.82,150,0.40',
  'Alpha 168,Invented Arms,7.82,168,0.45',
  'Beta 55,Other Works,5.70,55,0.25',
]
const csv = (lines: string[], head = header) => Buffer.from([head, ...lines].join('\n'))

test.beforeEach(async ({ page }) => {
  // the file input stands in for the native picker, which a test cannot drive
  await page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>).showOpenFilePicker
  })
})

/** Opens Import… and picks `buffer` as `name`: the click that chooses the file. */
async function pick(page: Page, name: string, buffer: Buffer) {
  await (await barButton(page, 'Open')).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('menuitem', { name: 'Import…' }).click()
  await (await chooser).setFiles({ name, mimeType: 'text/csv', buffer })
  return page.getByRole('dialog', { name: 'Tables to read' })
}

test('one clean table imports in two clicks and a typed source, and a second import adds nothing', async ({
  page,
}) => {
  await gotoHydrated(page, '/bullets/designer')
  const entry = await pick(page, 'bullets.csv', csv(rows))
  await expect(entry.getByTestId('import-verdict')).toHaveText('Table of bullets (high)')
  await expect(entry.getByTestId('import-counts')).toContainText('3 accepted')
  const button = entry.getByRole('button', { name: 'Import 3 valid rows' })
  await expect(button).toBeDisabled()
  await entry.getByRole('textbox', { name: 'Source' }).fill('Invented catalogue')
  await button.click()
  await expect(entry.getByRole('status')).toHaveText('Imported 3 records.')
  await expect(entry.getByTestId('import-counts')).toContainText('already here 3')
  await page.keyboard.press('Escape')

  const again = await pick(page, 'bullets.csv', csv(rows))
  await expect(again.getByTestId('import-counts')).toContainText('New 0, already here 3')
  await again.getByRole('textbox', { name: 'Source' }).fill('Invented catalogue')
  await expect(again.getByRole('button', { name: 'Import 0 valid rows' })).toBeDisabled()
  await page.keyboard.press('Escape')

  const edited = [rows[0] ?? '', 'Alpha 168,Invented Arms,7.82,168,0.47', rows[2] ?? '']
  const changed = await pick(page, 'bullets.csv', csv(edited))
  await expect(changed.getByTestId('import-counts')).toContainText('changed 1')
  await expect(changed.getByTestId('import-counts')).toContainText('New 0, already here 2')
})

// invented powders and cartridges, the example files of the table import docs page
const others = [
  {
    kind: 'powders',
    header: 'Name,Maker,Grain form,Base,Bulk density (g/cm3)',
    rows: [
      'Gamma 120,Invented Powders,extruded,single,0.89',
      'Gamma 140,Invented Powders,ball,double,0.98',
      'Delta 30,Other Mills,flake,double,0.62',
    ],
  },
  {
    kind: 'cartridges',
    header: 'Name,Case length (mm),COAL (mm),Bullet diameter (mm),Pmax (bar)',
    rows: [
      'Invented 7x50,50.0,72.0,7.21,4000',
      'Invented 6x40,40.0,58.5,6.20,3800',
      'Invented 9x20,20.0,29.0,9.02,2400',
    ],
  },
]

for (const { kind, header: head, rows: lines } of others) {
  test(`a table of ${kind} imports through the same entry`, async ({ page }) => {
    await gotoHydrated(page, '/bullets/designer')
    const entry = await pick(page, `${kind}.csv`, csv(lines, head))
    await expect(entry.getByTestId('import-verdict')).toHaveText(`Table of ${kind} (high)`)
    await expect(entry.getByTestId('import-counts')).toContainText('3 accepted')
    await entry.getByRole('textbox', { name: 'Source' }).fill('Invented catalogue')
    await entry.getByRole('button', { name: 'Import 3 valid rows' }).click()
    await expect(entry.getByRole('status')).toHaveText('Imported 3 records.')
    await expect(entry.getByTestId('import-counts')).toContainText('already here 3')
  })
}
