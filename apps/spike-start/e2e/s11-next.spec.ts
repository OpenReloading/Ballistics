import { expect, test } from '@playwright/test'

// The S11 typing probe on the Next export of main, for comparison: `pnpm run static:build`, `pnpm run pages:serve` (port 3003),
// then npx playwright test e2e/s11-next.spec.ts --project chromium
test('S11 Next export: workbench typed before hydration', async ({ page }, info) => {
  let release = () => {}
  const gate = new Promise<void>((r) => {
    release = r
  })
  await page.route('http://localhost:3003/_next/static/**/*.js', async (r) => {
    await gate
    await r.continue()
  })
  await page.goto('http://localhost:3003/workbench/', { waitUntil: 'commit' })
  const field = page.getByRole('combobox', { name: 'Search cartridges by name' })
  await field.click()
  await page.keyboard.type('308 Win.')
  await expect(page.locator('html[data-hydrated]')).not.toBeAttached()
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
})
