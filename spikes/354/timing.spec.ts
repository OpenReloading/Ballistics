// biome-ignore-all lint/correctness/noUndeclaredDependencies: spike, run with the e2e workspace's Playwright
import { expect, test } from '@playwright/test'
import { gotoHydrated } from '../../apps/e2e/tests/web/nav.ts'
import { applyExampleLoad, loadForm } from '../../apps/e2e/tests/web/workbench.ts'
import { probe, quantile, readProbe } from './probe.ts'

const runs = Number(process.env.RUNS ?? 20)

for (const steps of [1, 21])
  for (const rate of [1, 4, 6])
    test(`run time, ${steps} step(s), CPU throttle ${rate}`, async ({ page }) => {
      await probe(page)
      await gotoHydrated(page, '/workbench')
      await applyExampleLoad(page)
      const form = loadForm(page)
      if (steps > 1) {
        await form.getByLabel(/^Ladder steps/).fill(String(steps))
        await form.getByRole('radio', { name: 'Charge', exact: true }).check()
        await form.getByLabel(/^Step size/).fill('0.15')
        await form.getByRole('radio', { name: 'Up', exact: true }).check()
      }
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate })
      const charge = form.getByLabel(/^Charge mass/)
      const times: number[] = []
      const longest: number[] = []
      // run 0 is the first of the page (worker start, chunk load); runs 1..n are the measured ones
      for (let i = 0; i <= runs; i++) {
        const before = (await readProbe(page)).runs.length
        await charge.press('Control+Enter')
        await expect
          .poll(async () => (await readProbe(page)).runs[before]?.end, { timeout: 120_000 })
          .toBeDefined()
        // the band request follows the result; let it finish so the next run starts clean
        await page.waitForTimeout(400 * rate)
        const p = await readProbe(page)
        const r = p.runs[before]
        if (!r?.end) throw new Error('no end')
        const ms = r.end - r.start
        const end = r.end
        const task = Math.max(
          0,
          ...p.tasks
            .filter((t) => t.start >= r.start - 50 && t.start <= end + 50)
            .map((t) => t.duration),
        )
        if (i === 0)
          test.info().annotations.push({ type: 'first', description: `${ms.toFixed(0)} ms` })
        else {
          times.push(ms)
          longest.push(task)
        }
      }
      // input during a run: one key typed into the charge 20 ms after Run, its event delay
      const before = (await readProbe(page)).runs.length
      await charge.press('Control+Enter')
      await expect.poll(async () => (await readProbe(page)).runs.length).toBe(before + 1)
      await charge.press('End')
      await charge.press('0')
      await page.waitForTimeout(1000 * rate)
      const after = await readProbe(page)
      const typed = after.events.filter((e) => e.start >= (after.runs[before]?.start ?? 0))
      const row = {
        steps,
        rate,
        runs: times.length,
        median: quantile(times, 0.5),
        p90: quantile(times, 0.9),
        max: Math.max(...times),
        longestTaskMedian: quantile(longest, 0.5),
        longestTaskMax: Math.max(...longest),
        typedDuringRunMaxDelay: Math.max(0, ...typed.map((e) => e.delay)),
        typedDuringRunMaxDuration: Math.max(0, ...typed.map((e) => e.duration)),
        runCancelledByTyping: after.runs[before]?.end === undefined,
      }
      console.log(`ROW ${JSON.stringify(row)}`)
    })
