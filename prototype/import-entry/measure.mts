// Measures the Import entry prototype in Chromium against the static export: speed in the worker, the longest
// main-thread block, clicks per scenario in both layouts, the duplicate rule, the keyboard order and screenshots.
// Run in the dev container: WEB_URL=http://localhost:3003 node prototype/import-entry/measure.mts
import { mkdirSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium, type Page } from '@playwright/test'

const dir = import.meta.dirname
const files = (...names: string[]) => names.map((n) => join(dir, 'files', n))
const base = process.env.WEB_URL ?? 'http://localhost:3003'
mkdirSync(join(dir, 'screenshots'), { recursive: true })

const probe = () => {
  localStorage.setItem('safety-ack', '3')
  const w = window as unknown as { __max: number; __long: number[]; __reset: () => void }
  w.__max = 0
  w.__long = []
  let last = performance.now()
  setInterval(() => {
    const n = performance.now()
    w.__max = Math.max(w.__max, n - last - 4)
    last = n
  }, 4)
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) w.__long.push(e.duration)
  }).observe({ type: 'longtask', buffered: true })
  w.__reset = () => {
    w.__max = 0
    w.__long = []
  }
}

const open = async (page: Page, layout: 'a' | 'b') => {
  await page.goto(`${base}/import-entry/?layout=${layout}`)
  await page.waitForSelector('html[data-hydrated]')
  if (layout === 'a') await page.getByRole('button', { name: 'Import…' }).click()
  await page.locator('input[type=file]').first().waitFor({ state: 'attached' })
}

interface Count {
  clicks: number
  typed: number
}

interface Fixes {
  kind: (p: Page, c: Count) => Promise<void>
  map: (p: Page, c: Count) => Promise<void>
}
const none: Fixes = { kind: async () => {}, map: async () => {} }

async function run(
  page: Page,
  layout: 'a' | 'b',
  names: string[],
  fixes: Fixes,
  expectedWritten: number,
): Promise<Count & { written: number }> {
  const c: Count = { clicks: 0, typed: 0 }
  const click = async (l: ReturnType<Page['locator']>) => {
    await l.click()
    c.clicks++
  }
  await open(page, layout)
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles(files(...names))
  c.clicks++ // Choose files
  const next = () => click(page.getByRole('button', { name: 'Continue' }))
  if (layout === 'a') {
    await next()
    await fixes.kind(page, c) // the kind control is on the Check step
    await next()
    await fixes.map(page, c) // the columns are on the Map step
    await next()
  } else {
    await fixes.kind(page, c)
    await fixes.map(page, c)
  }
  await page.getByPlaceholder('Where the data comes from').fill('Invented test files')
  c.typed++
  await click(page.getByRole('button', { name: /^Import \d+ valid rows$/ }))
  const status = await page
    .getByRole('status')
    .filter({ hasText: /^Imported/ })
    .textContent()
  const written = Number(/Imported (\d+)/.exec(status ?? '')?.[1])
  if (written !== expectedWritten)
    throw new Error(`${layout} ${names.join('+')}: wrote ${written}, expected ${expectedWritten}`)
  return { ...c, written }
}

const wrongGuessFix = async (p: Page, c: Count) => {
  await p
    .getByRole('radiogroup', { name: 'Kind of headers-only-length.csv' })
    .getByText('cartridges')
    .click()
  c.clicks++
}
const mapLen = async (p: Page, c: Count) => {
  await p.getByRole('combobox', { name: 'Field of column Len' }).click()
  await p.getByRole('option', { name: 'Case length' }).click()
  c.clicks += 2
}

const out: Record<string, unknown> = {}
const save = () =>
  writeFileSync(join(dir, 'measurements.json'), `${JSON.stringify(out, null, 2)}\n`)
const browser = await chromium.launch()
const fresh = async (w = 1280, h = 650) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } })
  const page = await ctx.newPage()
  await page.addInitScript(probe)
  return page
}

// speed: 5,000 rows in layout B (no modal): a small file first (cold page), then the large one, then a remap
{
  const page = await fresh()
  await open(page, 'b')
  const input = page.locator('input[type=file]').first()
  const gapOf = () =>
    page.evaluate(() => {
      const w = window as unknown as { __max: number; __long: number[] }
      return { max: w.__max, long: w.__long }
    })
  const reset = () => page.evaluate(() => (window as unknown as { __reset: () => void }).__reset())
  await reset()
  await input.setInputFiles(files('powders.csv'))
  await page.getByTestId('counts').first().waitFor()
  const cold = await gapOf()
  await reset()
  const t0 = Date.now()
  await input.setInputFiles(files('bullets-5000.csv'))
  await page.getByTestId('counts').nth(1).waitFor()
  const wall = Date.now() - t0
  const timing = await page.getByTestId('timing').nth(1).textContent()
  const counts = await page.getByTestId('counts').nth(1).textContent()
  const warm = await gapOf()
  // a rebuild after a decimal mark change on one column: the counts change when it is done
  await reset()
  const t1 = Date.now()
  await page.getByRole('combobox', { name: 'Decimal mark of column G1' }).first().click()
  await page.getByRole('option', { name: '1,5' }).click()
  await page.waitForFunction(
    (before) => document.querySelectorAll('[data-testid=counts]')[1]?.textContent !== before,
    counts,
  )
  const remapWall = Date.now() - t1
  const timing2 = await page.getByTestId('timing').nth(1).textContent()
  const remap = await gapOf()
  out.speed = {
    smallFileFirst: { mainThreadGapMs: cold.max, longTasksMs: cold.long },
    large: { wallMs: wall, timing, counts, mainThreadGapMs: warm.max, longTasksMs: warm.long },
    remap: {
      wallMs: remapWall,
      timing: timing2,
      mainThreadGapMs: remap.max,
      longTasksMs: remap.long,
    },
  }
  await page.context().close()
}
save()

// clicks per scenario
const scenarios: Record<string, { names: string[]; fixes: Fixes; written: number }> = {
  a_clean_csv: { names: ['bullets-eu.csv'], fixes: none, written: 7 },
  b_mixed_three: {
    names: ['bullets-eu.csv', 'powders.csv', 'demo.load'],
    fixes: none,
    written: 7 + 5 + 2,
  },
  c_wrong_guess: {
    names: ['headers-only-length.csv', 'cartridges.csv', 'demo.load'],
    fixes: { kind: wrongGuessFix, map: mapLen },
    written: 3 + 4 + 2,
  },
}
const clicks: Record<string, unknown> = {}
for (const layout of ['a', 'b'] as const) {
  for (const [name, s] of Object.entries(scenarios)) {
    const page = await fresh()
    clicks[`${layout}:${name}`] = await run(page, layout, s.names, s.fixes, s.written).catch(
      (e) => ({ error: String(e) }),
    )
    await page.context().close()
  }
}
out.clicks = clicks
save()

// duplicates: the same rows twice add 0, a changed row is a conflict
{
  const page = await fresh()
  await open(page, 'b')
  const input = page.locator('input[type=file]').first()
  const original = await readFile(join(dir, 'files', 'bullets-eu.csv'))
  await input.setInputFiles({ name: 'first.csv', mimeType: 'text/csv', buffer: original })
  await page.getByPlaceholder('Where the data comes from').fill('Invented test files')
  await page.getByRole('button', { name: /^Import \d+ valid rows$/ }).click()
  await page
    .getByRole('status')
    .filter({ hasText: /^Imported/ })
    .waitFor()
  await input.setInputFiles({ name: 'second.csv', mimeType: 'text/csv', buffer: original })
  await page.getByTestId('counts').nth(1).waitFor()
  const second = await page.getByTestId('counts').nth(1).textContent()
  const changed = Buffer.from(original.toString('utf8').replace('31,5', '40,0'), 'utf8')
  await input.setInputFiles({ name: 'third.csv', mimeType: 'text/csv', buffer: changed })
  await page.getByTestId('counts').nth(2).waitFor()
  const third = await page.getByTestId('counts').nth(2).textContent()
  const button = page.getByRole('button', { name: /^Import \d+ valid rows$/ })
  out.duplicates = {
    second,
    third,
    button: await button.textContent(),
    disabled: await button.isDisabled(),
  }
  await page.context().close()
}
save()

// screenshots and keyboard order
const names3 = [
  'bullets-eu.csv',
  'powders.csv',
  'headers-only-length.csv',
  'demo.load',
  'weather.csv',
]
const keyboard: Record<string, string[]> = {}
const layout: Record<string, unknown> = {}
const pageFit = () => ({
  scrollWidth: document.documentElement.scrollWidth,
  innerWidth,
  scrollHeight: document.documentElement.scrollHeight,
  innerHeight,
})
const dialogFit = () => {
  const d = document.querySelector('[role=dialog]')
  const r = d?.getBoundingClientRect()
  const body = d?.querySelector('.mantine-Modal-body')
  return {
    dialogW: r?.width,
    dialogH: r?.height,
    innerWidth,
    innerHeight,
    bodyScrolls: body ? body.scrollHeight > body.clientHeight : undefined,
    overflowX: d ? d.scrollWidth > d.clientWidth : undefined,
  }
}
for (const [w, h] of [
  [1280, 650],
  [390, 844],
] as const) {
  const page = await fresh(w, h)
  await open(page, 'b')
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles(files(...names3))
  await page.getByTestId('counts').nth(2).waitFor()
  await page.getByPlaceholder('Where the data comes from').fill('Invented test files')
  layout[`b ${w}x${h}`] = await page.evaluate(pageFit)
  await page.screenshot({
    path: join(dir, 'screenshots', `layout-b-${w}x${h}.png`),
    fullPage: true,
  })
  if (w === 1280) {
    await page.locator('body').click({ position: { x: 1, y: 1 } })
    const order: string[] = []
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab')
      order.push(
        await page.evaluate(() => {
          const e = document.activeElement as HTMLElement | null
          return e
            ? (e.getAttribute('aria-label') ?? e.textContent?.trim().slice(0, 30) ?? e.tagName)
            : ''
        }),
      )
    }
    keyboard.b = order
  }
  await page.context().close()

  const a = await fresh(w, h)
  await open(a, 'a')
  await a
    .locator('input[type=file]')
    .first()
    .setInputFiles(files(...names3))
  await a.screenshot({ path: join(dir, 'screenshots', `layout-a-step1-${w}x${h}.png`) })
  for (let step = 2; step <= 4; step++) {
    await a.getByRole('button', { name: 'Continue' }).click()
    if (step === 4)
      await a.getByPlaceholder('Where the data comes from').fill('Invented test files')
    layout[`a step${step} ${w}x${h}`] = await a.evaluate(dialogFit)
    await a.screenshot({ path: join(dir, 'screenshots', `layout-a-step${step}-${w}x${h}.png`) })
    if (step === 3 && w === 1280) {
      const order: string[] = []
      for (let i = 0; i < 40; i++) {
        await a.keyboard.press('Tab')
        order.push(
          await a.evaluate(() => {
            const e = document.activeElement as HTMLElement | null
            return e
              ? (e.getAttribute('aria-label') ?? e.textContent?.trim().slice(0, 30) ?? e.tagName)
              : ''
          }),
        )
      }
      keyboard.a = order
    }
  }
  await a.context().close()
}
out.keyboard = keyboard
out.layout = layout
save()

// verdict per invented file, one file at a time in layout B
const verdicts: Record<string, string> = {}
{
  const page = await fresh()
  for (const f of [
    'bullets-5000.csv',
    'bullets-eu.csv',
    'bullets.xlsx',
    'powders.csv',
    'cartridges.csv',
    'headers-only-length.csv',
    'weather.csv',
    'demo.load',
    'notes.txt',
  ]) {
    await open(page, 'b')
    await page.locator('input[type=file]').first().setInputFiles(files(f))
    await page.getByTestId('verdict').first().waitFor()
    await page.waitForFunction(
      () => !document.querySelector('[data-testid=verdict]')?.textContent?.includes('Reading'),
    )
    verdicts[f] = (await page.getByTestId('verdict').first().textContent()) ?? ''
  }
  await page.context().close()
}
out.verdicts = verdicts
await browser.close()
writeFileSync(join(dir, 'measurements.json'), `${JSON.stringify(out, null, 2)}\n`)
console.log(JSON.stringify(out, null, 2))
