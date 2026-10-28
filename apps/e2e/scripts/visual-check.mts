// Screenshots of pages for a person to look at before landing a UI change: each page at 390 and
// 1280 px in light and dark against WEB_URL (it starts no server), then one contact sheet.
// npm run visual-check -- [--preset drawing|calculators] [/path ...]
// Output: visual-check-out/shots/<page>__<theme>__<width>.png and visual-check-out/sheet.png
// (VISUAL_OUT for another folder; VISUAL_LANGUAGE=de for the German interface, whose pages are
// waited for by their structure, not by English text; /workbench: VISUAL_LADDER, VISUAL_DEFAULTS, VISUAL_LOADS)
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { chromium, type Page } from '@playwright/test'
import { barButton } from '../tests/web/bar.ts'
import { safetyAck } from '../tests/web/nav.ts'

export const presets: Record<string, string[]> = {
  // 308 Win., 8 x 51 R Lebel, a belted magnum (table III), a rimfire (V), a long case, a shotshell (VII)
  drawing: [
    '/cartridges/308-win',
    '/cartridges/8-x-51-r-lebel',
    '/cartridges/300-weath-mag',
    '/cartridges/22-long-rifle',
    '/cartridges/12-7-x-108',
    '/cartridges/12',
  ],
  calculators: ['/workbench'],
}

/** The pages to shoot, from page paths and `--preset` options in their order, each once. */
export function args(argv: string[]): string[] {
  const { tokens } = parseArgs({
    args: argv,
    options: { preset: { type: 'string', multiple: true } },
    allowPositionals: true,
    tokens: true,
  })
  const pages = tokens.flatMap((token) => {
    if (token.kind === 'positional') {
      if (!token.value.startsWith('/'))
        throw new Error(`page path ${token.value} does not start with /`)
      return [token.value]
    }
    if (token.kind !== 'option') return []
    const name = token.value ?? ''
    if (!Object.hasOwn(presets, name))
      throw new Error(
        `unknown preset ${token.value}; known presets: ${Object.keys(presets).join(', ')}`,
      )
    return presets[name]
  })
  if (!pages.length)
    throw new Error('no pages: give --preset drawing|calculators or page paths such as /workbench')
  return [...new Set(pages)]
}

/** A designer loads apart from the route; its drawing is a tab away at 390 px. */
async function designerReady(page: Page, url: string) {
  // a new cartridge has no drawing until its base values are entered
  if (url.startsWith('/bullets/') || url.includes('from=')) {
    await page
      .locator('svg[aria-labelledby="designer-drawing-title"]')
      .waitFor({ state: 'attached' })
    if (url.includes('from=')) await page.getByText(/^Started from /).waitFor()
  }
  await page.locator('.designer').waitFor()
}

/** Opens the example load in the workbench; below 75em the bar's actions are behind "Page actions". */
async function openExampleLoad(page: Page) {
  await (await barButton(page, 'Open')).click()
  await page.getByRole('menuitem', { name: 'Example load' }).click()
}

/** VISUAL_DEFAULTS=1: the example's link without the defaulted inputs, so the run lists them. */
async function withoutDefaults(page: Page) {
  // Copy link writes the link into the address bar
  await (await barButton(page, 'Copy link')).click()
  const link = new URL(page.url())
  for (const key of ['propellantTemperature', 'ignitionPressure', 'startPressure'])
    link.searchParams.delete(key)
  await page.goto(link.href)
  const powder = page.getByRole('button', { name: /^Powder/ })
  if ((await powder.getAttribute('aria-expanded')) !== 'true') await powder.click()
}

/**
 * VISUAL_LOADS=<n>: n open loads (the example in each), made at 1280 px where the strip is shown
 * (below 75em it is hidden), then the window back at its width.
 */
async function openLoads(page: Page, loads: number) {
  const size = page.viewportSize()
  await page.setViewportSize({ width: 1280, height: size?.height ?? 844 })
  for (let i = 1; i < loads; i++) {
    await page.locator('.load-strip > button[aria-label="New load"]').click()
    await openExampleLoad(page)
    await page.locator('.field-flag-seating').first().waitFor()
  }
  if (size) await page.setViewportSize(size)
}

/** The workbench with the example run and its results shown. */
async function workbenchReady(page: Page) {
  await openExampleLoad(page)
  if (process.env.VISUAL_DEFAULTS) await withoutDefaults(page)
  const loads = Number(process.env.VISUAL_LOADS)
  if (loads > 1) await openLoads(page, loads)
  // VISUAL_LADDER=<steps>: a charge ladder of that many steps of 0.5 gr (both default presets weigh
  // the charge in grains) on the example
  const steps = process.env.VISUAL_LADDER
  if (steps) {
    await page.getByLabel(/^Ladder steps/).fill(steps)
    await page.getByLabel(/^Step size/).fill('0.5')
  }
  // at 390 px the readout bar's button, the last one, also opens the results
  await page.getByRole('button', { name: 'Run simulation' }).last().click()
  // at 390 px inputs and results are tabs: show the results
  const results = page.getByRole('tab', { name: 'Results' }).first()
  if (await results.isVisible()) await results.click()
  await page.getByRole('region', { name: 'Result', exact: true }).waitFor()
  // the chart code loads apart from the route; the interior chart is drawn with ECharts
  await page.locator('.echart svg').first().waitFor()
  // filling a field scrolls the inputs region: show each region from its top
  await page
    .locator('.workspace-inputs, .workbench-centre, .workbench-aside')
    .evaluateAll((regions) => {
      for (const r of regions) r.scrollTop = 0
    })
}

/** Waits until the page shows what a person checks: the drawing, or the .308 Win. example result. */
async function ready(page: Page, url: string) {
  // the URL's filters and the browser's records apply after hydration
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' })
  const designer = /^\/(bullets|cartridges)\/designer/.test(url)
  if (designer) await designerReady(page, url)
  if (url.startsWith('/cartridges/') && !designer)
    await page.locator('svg.drawing.screen-only:visible').first().waitFor()
  // the waits below name English texts
  if (process.env.VISUAL_LANGUAGE) {
    await page.waitForLoadState('networkidle')
    return
  }
  // the compare view reads its records in the browser
  if (url.startsWith('/bullets/compare'))
    await page
      .locator('.compare-table')
      .or(page.getByRole('link', { name: 'Choose bullets' }))
      .or(page.getByRole('button', { name: 'Retry' }))
      .first()
      .waitFor()
  // the burn-rate chart code loads apart from the route; a powder without fitted parameters and an
  // overlay without picks have none
  if (url.startsWith('/powders/') && (await page.getByText(/Model output from fitted/).count()))
    await page
      .locator('.echart svg')
      .or(page.getByText('No powder in the overlay.'))
      .first()
      .waitFor()
  if (url === '/workbench') await workbenchReady(page)
}

/** On a cartridge page the area from the first to the last drawing figure, else the whole page. */
async function clip(page: Page, url: string) {
  if (!url.startsWith('/cartridges/') || url.startsWith('/cartridges/designer')) return
  const [x0, y0, x1, y1] = await page
    .locator('figure.drawing-figure')
    .evaluateAll((figures) =>
      figures
        .map((f) => f.getBoundingClientRect())
        .reduce(
          ([x0, y0, x1, y1], r) => [
            Math.min(x0, r.left + scrollX),
            Math.min(y0, r.top + scrollY),
            Math.max(x1, r.right + scrollX),
            Math.max(y1, r.bottom + scrollY),
          ],
          [Infinity, Infinity, -Infinity, -Infinity],
        ),
    )
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

/** Tiles images into one grid of `columns` tiles `tile` px wide under a title and saves it as `file`. */
async function sheet(
  page: Page,
  title: string,
  columns: number,
  tile: number,
  tiles: { file: string; caption: string }[],
  file: string,
) {
  await page.setViewportSize({ width: columns * (tile + 8) + 8, height: 600 })
  const figures = tiles.map(
    ({ file, caption }) =>
      `<figure><img src="data:image/png;base64,${readFileSync(file).toString('base64')}"><figcaption>${caption}</figcaption></figure>`,
  )
  await page.setContent(`<!doctype html><style>
body { margin: 0; padding: 8px; background: #777; font: 13px/1.3 sans-serif }
h1 { margin: 0 0 8px; font-size: 16px; color: #fff }
main { display: grid; grid-template-columns: repeat(${columns}, ${tile}px); gap: 8px; align-items: start }
figure { margin: 0; background: #fff }
img { display: block; width: 100% }
figcaption { padding: 2px 4px; overflow-wrap: anywhere }
</style><h1>${title}</h1><main>${figures.join('')}</main>`)
  await page.screenshot({ path: file, fullPage: true })
}

if (import.meta.main) {
  let pages: string[]
  try {
    pages = args(process.argv.slice(2))
  } catch (error) {
    console.error(`visual-check: ${(error as Error).message}`)
    process.exit(2)
  }
  const root = path.resolve(
    process.env.VISUAL_OUT ?? fileURLToPath(new URL('../visual-check-out/', import.meta.url)),
  )
  const shots = path.join(root, 'shots')
  rmSync(root, { recursive: true, force: true })
  mkdirSync(shots, { recursive: true })
  const base = process.env.WEB_URL ?? 'http://localhost:3003'
  const widths = (process.env.VISUAL_WIDTHS ?? '390,1280').split(',').map(Number)
  const browser = await chromium.launch()
  try {
    // no offline worker, as in playwright.config.ts
    const page = await browser.newPage({ baseURL: base, serviceWorkers: 'block' })
    // the Safety notice accepted, as in playwright.config.ts, so no dialog covers the pages
    await page.addInitScript((value) => {
      localStorage.setItem('safety-ack', value)
    }, safetyAck)
    const language = process.env.VISUAL_LANGUAGE
    if (language)
      await page.addInitScript((code) => {
        localStorage.setItem('language', code)
      }, language)
    const tiles: { file: string; caption: string }[] = []
    for (const url of pages)
      for (const width of widths)
        for (const theme of ['light', 'dark'] as const) {
          await page.setViewportSize({ width, height: 844 })
          await page.emulateMedia({ colorScheme: theme })
          await page.goto(url)
          if (language) await page.locator(`html[lang="${language}"]`).waitFor()
          await ready(page, url)
          const file = path.join(
            shots,
            `${url.slice(1).replaceAll('/', '_') || 'home'}__${theme}__${width}.png`,
          )
          await page.screenshot({ path: file, fullPage: true, clip: await clip(page, url) })
          tiles.push({ file, caption: `${url}<br>${theme}, ${width} px` })
          console.log(file)
          // VISUAL_TALL=<height>: one more shot in a window that tall, where a tool page's regions
          // show what they otherwise scroll
          const tall = Number(process.env.VISUAL_TALL)
          if (tall) {
            await page.setViewportSize({ width, height: tall })
            const file = path.join(
              shots,
              `${url.slice(1).replaceAll('/', '_') || 'home'}__${theme}__${width}__tall.png`,
            )
            await page.screenshot({ path: file, fullPage: true, clip: await clip(page, url) })
            tiles.push({ file, caption: `${url}<br>${theme}, ${width} x ${tall} px` })
            console.log(file)
          }
        }
    const file = path.join(root, 'sheet.png')
    await sheet(
      page,
      `${base}: ${pages.length} pages, ${tiles.length} screenshots`,
      4,
      312,
      tiles,
      file,
    )
    console.log(`${tiles.length} screenshots of ${pages.length} pages and 1 contact sheet: ${file}`)
  } finally {
    await browser.close()
  }
}
