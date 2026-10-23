import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { storeUnits } from './units.ts'
import { runExample } from './workbench-run.ts'

test.beforeEach(({ page }) => storeUnits(page))

test('a run shows the sampled bands with the tolerances-only line, axe clean in light and dark', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1280, height: 650 })
  await runExample(page)
  await expect(page.locator('.band-line')).toHaveText(
    /^Velocity \d+ to \d+ m\/s\. 5th to 95th percentile, input tolerances only\.$/,
  )
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page })
      .include('.readout-keys')
      .include('.band-line')
      .include('.readout-list')
      .analyze()
    expect(violations.map((v) => v.id)).toEqual([])
  }
})
