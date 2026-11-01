import { expect, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { storeUnits } from './units.ts'
import { applyExampleLoad, loadForm } from './workbench.ts'
import { runLine } from './workbench-run.ts'

test.beforeEach(({ page }) => storeUnits(page))

test('a copied link runs the same load where its bullet and powder records are missing', async ({
  page,
  context,
}) => {
  await page.goto('/workbench')
  await applyExampleLoad(page)
  const withRecords = await runLine(page)
  expect(withRecords).toMatch(/peak \d+ bar, .* \d+ m\/s/)
  await (await barButton(page, 'Copy link')).click()
  // the values travel in the fragment, so they never reach the server
  const link = new URL(page.url())
  expect(link.search).toBe('')
  expect(link.hash).toMatch(/^#units=/)
  expect(link.href.length).toBeLessThan(2000)

  // a deploy without the demo bullet and powder records (the example's fitted powder)
  const missing = await context.newPage()
  await storeUnits(missing)
  for (const record of ['bullets/demo-bullet-168', 'powders/demo-powder-dp40'])
    await missing.route(`**/api/${record}.json`, (r) => r.fulfill({ status: 404, body: '{}' }))
  await missing.goto(link.href)
  const form = loadForm(missing)
  await expect(form.getByLabel(/^Charge mass/)).toHaveValue('2.40')
  // a card's record name is its search field's prompt
  await expect(form.getByRole('combobox', { name: /^Search bullets/ })).toHaveAttribute(
    'placeholder',
    'Demo Bullets 30 Cal 168 gr HPBT Demo (from the link)',
  )
  await expect(form.getByRole('combobox', { name: /^Search powders/ })).toHaveAttribute(
    'placeholder',
    'Demo Powder Co. DP40 (from the link)',
  )
  // the cartridge record's limit is read from its file after the page loads
  await expect(form.getByRole('textbox', { name: /^Pmax/ })).toHaveValue('4150')
  expect(await runLine(missing)).toBe(withRecords)
})
