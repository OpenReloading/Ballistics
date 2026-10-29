// biome-ignore-all lint/correctness/noUndeclaredDependencies: spike, run with the e2e workspace's Playwright
import { expect, type Page, test } from '@playwright/test'
import { gotoHydrated } from '../../apps/e2e/tests/web/nav.ts'
import { applyExampleLoad, loadForm } from '../../apps/e2e/tests/web/workbench.ts'
import { probe, readProbe, resetShift, settle } from './probe.ts'

const stale = (page: Page) => page.locator('.bar-result[data-stale]').first()

/** The edits of each case: type, wait and read what the probe saw. */
async function scenario(page: Page, auto: string | undefined, ladder: boolean) {
  await probe(page)
  await gotoHydrated(page, `/workbench${auto ? `?auto=${auto}` : ''}`)
  await applyExampleLoad(page)
  const form = loadForm(page)
  if (ladder) {
    await form.getByLabel(/^Ladder steps/).fill('21')
    await form.getByRole('radio', { name: 'Charge', exact: true }).check()
    await form.getByLabel(/^Step size/).fill('0.15')
  }
  const charge = form.getByLabel(/^Charge mass/)
  // a first result, so the stale marker has something to mark
  await charge.press('Control+Enter')
  await expect(page.locator('.result').getByText(/^Simulation done\. /)).toBeAttached({
    timeout: 30_000,
  })
  await settle(page, 1500)
  await resetShift(page)
  const out: Record<string, unknown> = {}
  const count = async () => (await readProbe(page)).runs.length

  // 1. a half-typed, invalid value: no run
  let n = await count()
  await charge.fill('')
  await charge.pressSequentially('4x', { delay: 80 })
  await page.waitForTimeout(1500)
  out.invalidStartsRun = (await count()) > n
  out.staleShownWhileInvalid = await stale(page).isVisible()

  // 2. several edits in a row, under the pause: one run at the end
  n = await count()
  await charge.fill('')
  await charge.pressSequentially('46.5', { delay: 150 })
  await page.waitForTimeout(400)
  await charge.fill('')
  await charge.pressSequentially('46.6', { delay: 150 })
  out.staleDuringPause = await stale(page).isVisible()
  await page.waitForTimeout(3000)
  out.runsForEditBurst = (await count()) - n
  out.staleAfter = await stale(page).isVisible()
  out.focusStayed = await charge.evaluate((e) => e === document.activeElement)
  out.valueKept = await charge.inputValue()

  // 3. an edit while a run is in flight: it is cancelled, one more run follows
  n = await count()
  const cancelledBefore = (await readProbe(page)).cancelled
  await charge.fill('')
  await charge.pressSequentially('46.7', { delay: 50 })
  await expect
    .poll(async () => (await readProbe(page)).state, { timeout: 5000 })
    .toBe('running')
    .catch(() => {})
  await charge.press('End')
  await charge.press('5')
  await page.waitForTimeout(3000)
  const p = await readProbe(page)
  out.cancelledByEdit = p.cancelled - cancelledBefore
  out.runsAfterCancel = p.runs.length - n
  await settle(page)
  const q = await readProbe(page)
  out.shiftInputs = q.shiftInputs
  out.shiftPage = q.shiftPage
  // where a status is announced: the live regions holding the result line
  out.liveRegions = await page
    .locator('[aria-live]:not([aria-live="off"])')
    .evaluateAll((els) =>
      els.map((e) => `${e.getAttribute('aria-live')}:${(e.textContent ?? '').slice(0, 40)}`),
    )
  return out
}

for (const [name, auto, ladder] of [
  ['run only', undefined, false],
  ['run only, ladder', undefined, true],
  ['automatic after a pause', 'pause', false],
  ['automatic after a pause, ladder', 'pause', true],
  ['automatic for the plain run only, plain', 'plain', false],
  ['automatic for the plain run only, ladder', 'plain', true],
] as const)
  test(`variant ${name}`, async ({ page }) => {
    const out = await scenario(page, auto, ladder)
    console.log(`VARIANT ${JSON.stringify({ name, ...out })}`)
  })
