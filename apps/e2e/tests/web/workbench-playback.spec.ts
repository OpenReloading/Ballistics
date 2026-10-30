import { expect, type Page, test } from '@playwright/test'
import { storeUnits } from './units.ts'
import { runExample } from './workbench-run.ts'

test.beforeEach(({ page }) => storeUnits(page))

/** Runs the example load and gives the playback's Play button. */
async function runPlayback(page: Page) {
  await runExample(page)
  // the strip draws once the seated figure of the cartridge preview has arrived
  await expect(page.locator('.strip-bullet')).toBeAttached()
  return page.getByRole('button', { name: 'Play', exact: true })
}

/** The bullet's left edge and the right edge of the chart box it flies in, px. */
const edges = (page: Page) =>
  page.evaluate(() => {
    const bullet = document.querySelector('.strip-bullet')?.getBoundingClientRect()
    const box = document.querySelector('.rail-strip')?.getBoundingClientRect()
    return { bullet: bullet?.left ?? Number.NaN, box: box?.right ?? Number.NaN }
  })

test('on Play the bullet flies out of the chart box past the muzzle; the slider and values stay at the muzzle', async ({
  page,
}) => {
  // the frame loop reads the fake clock: the flight ends on a clock jump, not in real time
  await page.clock.install()
  const play = await runPlayback(page)
  const slider = page.getByRole('slider', { name: /^(Bullet position|Time from ignition)$/ })
  // the end of the slider is muzzle exit: the bullet is still in the chart box there
  await slider.focus()
  await slider.press('End')
  const muzzle = await slider.getAttribute('aria-valuetext')
  let at = await edges(page)
  expect(at.bullet).toBeLessThan(at.box)

  await page.getByRole('button', { name: /^Slow-down factor/ }).click()
  await page.getByRole('menuitem', { name: '1000×' }).click()
  await play.click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await page.clock.runFor(15_000)
  await expect(play).toBeVisible()
  at = await edges(page)
  expect(at.bullet).toBeGreaterThanOrEqual(at.box)
  await expect(slider).toHaveValue('1000')
  await expect(slider).toHaveAttribute('aria-valuetext', muzzle ?? '')

  // Play again starts at ignition
  await play.click()
  await expect(slider).not.toHaveValue('1000')
})

test('with reduced motion Play shows the bullet at the muzzle, no flight', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const play = await runPlayback(page)
  await play.click()
  const slider = page.getByRole('slider', { name: /^(Bullet position|Time from ignition)$/ })
  await expect(slider).toHaveValue('1000')
  const at = await edges(page)
  expect(at.bullet).toBeLessThan(at.box)
})

test('the chart readout slider follows the keys and a value change, and is cleared on blur', async ({
  page,
}) => {
  await runPlayback(page)
  const readout = page.getByRole('slider', { name: /^Simulated breech pressure.*, readout$/ })
  await readout.focus()
  await readout.press('End')
  const last = await readout.getAttribute('aria-valuetext')
  expect(last).toBeTruthy()
  // a change without a key (assistive technology) moves the readout too
  await readout.fill('1')
  await expect(readout).not.toHaveAttribute('aria-valuetext', last ?? '')
  await readout.blur()
  await expect(readout).not.toHaveAttribute('aria-valuetext')
  await expect(readout).toHaveValue('0')
})

test('Escape hides the chart tooltip with the pointer or the focus where it is', async ({
  page,
}) => {
  await runExample(page)
  const chart = page.locator('.echart [role="img"]').last()
  const tip = page.locator('.echart div[style*="position: absolute"]')
  const box = await chart.boundingBox()
  if (!box) throw new Error('no chart box')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 })
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2, { steps: 5 })
  await expect(tip).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(tip).toBeHidden()

  const readout = page.locator('.echart-keys').last()
  await readout.focus()
  await readout.press('ArrowRight')
  await expect(tip).toBeVisible()
  await readout.press('Escape')
  await expect(tip).toBeHidden()
  await expect(readout).toBeFocused()
})
