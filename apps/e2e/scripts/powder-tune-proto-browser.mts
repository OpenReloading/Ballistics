/**
 * Browser measurements and screenshots of the powder tuning prototype against a served export:
 * `WEB_URL=http://localhost:3003 node apps/e2e/scripts/powder-tune-proto-browser.mts`. Writes
 * `prototype/powder-tuning/shots/` and prints one JSON object.
 */
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { ladders } from '../../web/src/lib/powder-tune-proto.ts'

const base = process.env.WEB_URL ?? 'http://localhost:3003'
const out = new URL('../../../prototype/powder-tuning/shots/', import.meta.url).pathname
mkdirSync(out, { recursive: true })
const sizes = [
  { name: 'desktop', width: 1280, height: 650 },
  { name: 'phone', width: 390, height: 844 },
]
const ids = ladders.map((l) => l.id)
const titles: Record<string, string> = Object.fromEntries(ladders.map((l) => [l.id, l.title]))

const browser = await chromium.launch()
const result: Record<string, unknown> = {}
for (const size of sizes) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    colorScheme: 'light',
  })
  await context.addInitScript(() => localStorage.setItem('safety-ack', '3'))
  const page = await context.newPage()
  await page.goto(`${base}/powders/tune/`)
  await page.getByRole('heading', { name: 'Tune a powder' }).waitFor()
  await page.getByRole('table', { name: 'Strings' }).waitFor()
  const layout: Record<string, unknown> = {}
  for (const id of ids) {
    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: titles[id] }).click()
    await page.locator(`[data-answered="${id}"]`).waitFor()
    await page.waitForTimeout(200)
    const alert = await page.locator('.message').allInnerTexts()
    const fitted = await page.getByRole('table', { name: 'Fitted parameters' }).allInnerTexts()
    layout[id] = {
      messages: alert.map((t) => t.replace(/\s+/g, ' ')),
      fitted: fitted.map((t) => t.replace(/\s+/g, ' ')),
      // what scrolls: the page itself, the main region, and the largest other overflow with its element
      pageOverflow: await page.evaluate(
        () => (document.scrollingElement?.scrollHeight ?? 0) - window.innerHeight,
      ),
      mainOverflow: await page.evaluate(() => {
        const main = document.querySelector('main')
        return main ? main.scrollHeight - main.clientHeight : 0
      }),
      widest: await page.evaluate(() => {
        const all = [...document.querySelectorAll('*')].map((e) => ({
          name: `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)}`,
          over: e.scrollHeight - e.clientHeight,
        }))
        return all.sort((x, y) => y.over - x.over)[0]
      }),
      horizontalScroll: await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    }
    await page.screenshot({ path: `${out}${id}-${size.name}.png`, fullPage: size.name === 'phone' })
  }
  result[size.name] = layout
  if (size.name === 'desktop') {
    // hand tuning on the good ladder: redraw time per keyboard step of the first slider
    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: titles.good }).click()
    await page.locator('[data-answered="good"]').waitFor()
    await page.waitForTimeout(200)
    const slider = page.getByRole('slider').first()
    await slider.focus()
    await page.evaluate(() => {
      ;(window as unknown as { __redrawMs: number[] }).__redrawMs = []
    })
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press(i < 30 ? 'ArrowRight' : 'ArrowLeft')
      await page.waitForTimeout(60)
    }
    const times = await page.evaluate(
      () => (window as unknown as { __redrawMs: number[] }).__redrawMs,
    )
    times.sort((a, b) => a - b)
    result.redraw = {
      moves: times.length,
      medianMs: times[times.length >> 1],
      p95Ms: times[Math.floor(times.length * 0.95)],
      maxMs: times[times.length - 1],
    }
    await slider.press('PageUp')
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${out}hand-tuned-desktop.png` })
    // keyboard order
    await page.goto(`${base}/powders/tune/`)
    await page.getByRole('table', { name: 'Strings' }).waitFor()
    await page.locator('[data-answered="good"]').waitFor()
    const order: string[] = []
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab')
      const name = await page.evaluate(() => {
        const e = document.activeElement
        if (!e || e === document.body) return 'body'
        const label =
          e.getAttribute('aria-label') ??
          (e as HTMLInputElement).labels?.[0]?.innerText ??
          e.textContent
        return `${e.tagName.toLowerCase()}${e.getAttribute('role') ? `[${e.getAttribute('role')}]` : ''}: ${(label ?? '').trim().slice(0, 40)}`
      })
      order.push(name)
    }
    result.tabOrder = order
  }
  await context.close()
}
await browser.close()
console.log(JSON.stringify(result, null, 1))
