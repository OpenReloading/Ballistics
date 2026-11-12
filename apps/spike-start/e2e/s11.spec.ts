import { fileURLToPath } from 'node:url'
import { expect, type Page, test } from '@playwright/test'
import { load, routes } from '../scripts/weigh.ts'

// S11: six routes of apps/web/src under Start, in both editions, Chromium only (npx playwright test e2e/s11.spec.ts --project chromium)
const editions = [
  { base: '/', dir: '../site/' },
  { base: '/next/', dir: '../site/next/' },
]

/** Console errors and warnings, uncaught errors and failed subresources of the page, from before its first script. */
function listen(page: Page) {
  const messages: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') messages.push(`${m.type()}: ${m.text()}`)
  })
  page.on('response', (r) => {
    if (r.status() >= 400) messages.push(`failed: ${r.status()} ${r.url()}`)
  })
  page.on('pageerror', (e) => messages.push(`pageerror: ${e.message}`))
  return messages
}

for (const { base, dir } of editions) {
  const weights = load(fileURLToPath(new URL(dir, import.meta.url)))

  for (const route of routes)
    test(`S11 ${base}${route.path.slice(1)}`, async ({ page }, info) => {
      const messages = listen(page)
      const response = await page.goto(`${base}${route.path.slice(1)}`)
      expect(response?.status()).toBe(200)
      await expect(page.locator('html[data-hydrated]')).toBeAttached()
      await expect(page.locator('main h1').first()).toBeVisible()
      if (route.group === 'curve charts')
        await expect(page.locator('.echart svg').first()).toBeVisible()
      if (route.group === 'designers')
        await expect(page.locator('.designer-drawing svg').first()).toBeVisible()
      await page.waitForLoadState('networkidle')

      // the scripts the browser asked for before `load`, against the initial set weigh.ts computes from the manifest
      const requested: string[] = await page.evaluate((prefix) => {
        const end = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)
          .loadEventStart
        return performance
          .getEntriesByType('resource')
          .filter((e) => e.startTime < end && new URL(e.name).pathname.endsWith('.js'))
          .map((e) => new URL(e.name).pathname.slice(prefix.length))
      }, base)
      const computed = weights.weigh(route).initial
      const missing = computed.filter((f) => !requested.includes(f))
      const extra = requested.filter((f) => !computed.includes(f))
      info.annotations.push(
        { type: 'console', description: JSON.stringify(messages) },
        {
          type: 'scripts',
          description: JSON.stringify({
            computed: computed.length,
            requested: requested.length,
            missing,
            extra,
          }),
        },
      )
      expect(messages).toEqual([])
      expect({ missing, extra }).toEqual({ missing: [], extra: [] })
    })

  test(`S11 ${base}workbench/ typed before hydration`, async ({ page }, info) => {
    const messages = listen(page)
    let release = () => {}
    const gate = new Promise<void>((r) => {
      release = r
    })
    // the module scripts wait until the prerendered field has been typed into
    await page.route(`**${base}assets/*.js`, async (r) => {
      await gate
      await r.continue()
    })
    await page.goto(`${base}workbench/`, { waitUntil: 'commit' })
    const field = page.getByRole('combobox', { name: 'Search cartridges by name' })
    await field.click()
    await page.keyboard.type('308 Win.')
    await expect(page.locator('html[data-hydrated]')).not.toBeAttached()
    // whether hydration keeps the typed-into node or replaces it, and every value the node shows on the way
    await field.evaluate((e) => {
      const w = window as unknown as { typedNode: Element; values: string[] }
      w.typedNode = e
      w.values = []
      const input = e as HTMLInputElement
      const poll = () => {
        if (w.values.at(-1) !== input.value) w.values.push(input.value)
        requestAnimationFrame(poll)
      }
      poll()
    })
    release()
    await expect(page.locator('html[data-hydrated]')).toBeAttached()
    await page.waitForLoadState('networkidle')
    const probe = await field.evaluate((e) => {
      const w = window as unknown as { typedNode: Element; values: string[] }
      return { sameNode: w.typedNode === e, connected: w.typedNode.isConnected, values: w.values }
    })
    info.annotations.push({ type: 'typed', description: JSON.stringify(probe) })
    await expect(field).toHaveValue('308 Win.')
    expect(messages).toEqual([])
  })
}
