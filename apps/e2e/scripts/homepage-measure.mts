/**
 * Measures the homepage variants on the served export (`npm run pages:serve`, WEB_URL): the workbench
 * entry against the first screen, layout shift while the strip fills, the order of the blocks against
 * the tab order, and the screenshots. Run in the dev container:
 *   node apps/e2e/scripts/homepage-measure.mts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium, type Page } from '@playwright/test'

const base = process.env.WEB_URL ?? 'http://localhost:3003'
const out = path.join(import.meta.dirname, '../../../prototype/homepage/screens')
mkdirSync(out, { recursive: true })

const loads = [
  ['Fake load 308 Win. one', '2026-10-27T10:00:00.000Z'],
  ['Fake load 6.5 Creedmoor two', '2026-10-25T10:00:00.000Z'],
  ['Fake load 9 mm three', '2026-10-21T10:00:00.000Z'],
  ['Fake load 223 Rem. four (not shown)', '2026-10-01T10:00:00.000Z'],
].map(([name, saved], i) => ({
  kind: 'load',
  id: `7a2d9c10-5b3e-4f68-9d41-0c8e2b6a1f5${i}`,
  name,
  saved,
  data: { origin: 'user', charge: { value: 42.5 } },
}))

async function seed(page: Page) {
  await page.goto(`${base}/offline/`)
  await page.evaluate(async (records) => {
    const db: IDBDatabase = await new Promise((ok, no) => {
      const r = indexedDB.open('openreloading-user-data')
      r.onupgradeneeded = () => {
        for (const n of ['records', 'handles', 'files'])
          if (!r.result.objectStoreNames.contains(n))
            r.result.createObjectStore(n, n === 'records' ? { keyPath: 'id' } : undefined)
      }
      r.onsuccess = () => ok(r.result)
      r.onerror = () => no(r.error)
    })
    const tx = db.transaction('records', 'readwrite')
    for (const record of records) tx.objectStore('records').put(record)
    await new Promise((ok) => {
      tx.oncomplete = ok
    })
    db.close()
  }, loads)
}

const sizes = { '1280x650': { width: 1280, height: 650 }, '390x844': { width: 390, height: 844 } }
const states = [
  { name: 'filled', stored: true, query: '' },
  { name: 'empty', stored: false, query: '' },
  { name: 'empty-collapse', stored: false, query: '&collapse=1' },
] as const

const browser = await chromium.launch()
const rows: Record<string, unknown>[] = []
for (const [size, viewport] of Object.entries(sizes)) {
  for (const v of ['A', 'B', 'C']) {
    for (const s of states) {
      if (v === 'A' && s.name !== 'filled') continue
      const context = await browser.newContext({ viewport, serviceWorkers: 'block' })
      await context.addInitScript(() => {
        localStorage.setItem('safety-ack', '3')
        ;(window as unknown as { cls: number }).cls = 0
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as {
            value: number
            hadRecentInput: boolean
          }[])
            if (!e.hadRecentInput) (window as unknown as { cls: number }).cls += e.value
        }).observe({ type: 'layout-shift', buffered: true })
      })
      const page = await context.newPage()
      if (s.stored) await seed(page)
      await page.goto(`${base}/prototype-home/?v=${v}${s.query}`)
      await page.waitForSelector('html[data-hydrated]')
      if (v !== 'A')
        await page.waitForSelector('.home-strip:not([data-state="reading"])', { state: 'attached' })
      await page.waitForTimeout(800)
      const m = await page.evaluate(() => {
        const rect = (el: Element | null) => {
          const r = el?.getBoundingClientRect()
          return r ? { top: Math.round(r.top), bottom: Math.round(r.bottom) } : null
        }
        const button = [...document.querySelectorAll('main a')].find((a) =>
          a.textContent?.includes('Open load workbench'),
        )
        const blocks = [
          ...document.querySelectorAll(
            'main .home-strip, main .home-hero, main section.page-panel',
          ),
        ]
        const tops = blocks.map((b) => b.getBoundingClientRect().top)
        const focus = [...document.querySelectorAll('main a[href], main button')].filter(
          (el) => (el as HTMLElement).offsetParent !== null,
        )
        const owner = focus.map((el) => blocks.findIndex((b) => b.contains(el)))
        return {
          workbench: rect(button ?? null),
          strip: rect(document.querySelector('.home-strip:not([hidden])')),
          news: rect(document.querySelector('#home-news')),
          library: rect(document.querySelector('#home-library')),
          scrollHeight: document.documentElement.scrollHeight,
          cls: (window as unknown as { cls: number }).cls,
          blocksInOrder: tops.every((t, i) => i === 0 || (tops[i - 1] ?? 0) <= t),
          focusInBlockOrder: owner
            .filter((o) => o >= 0)
            .every((o, i, all) => i === 0 || (all[i - 1] ?? 0) <= o),
          stripLinks: document.querySelectorAll('.home-strip a').length,
        }
      })
      rows.push({ variant: v, size, state: s.name, ...m })
      if (s.name === 'filled') {
        await page.screenshot({ path: path.join(out, `${v}-${size}.png`) })
        await page.screenshot({ path: path.join(out, `${v}-${size}-full.png`), fullPage: true })
      }
      await context.close()
    }
  }
}
await browser.close()
writeFileSync(
  path.join(import.meta.dirname, '../../../prototype/homepage/measurements.json'),
  `${JSON.stringify(rows, null, 2)}\n`,
)
console.table(
  rows.map((r) => ({
    v: r.variant,
    size: r.size,
    state: r.state,
    wbBottom: (r.workbench as { bottom: number } | null)?.bottom,
    strip: JSON.stringify(r.strip),
    news: (r.news as { top: number } | null)?.top,
    cls: (r.cls as number).toFixed(4),
    order: `${r.blocksInOrder}/${r.focusInBlockOrder}`,
    links: r.stripLinks,
    h: r.scrollHeight,
  })),
)
