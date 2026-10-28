/**
 * Measures the workbench layout variants of `/prototype-workbench/?v=A|B|C|D` (fake data) and, for
 * calibration, the shipped `/workbench` with the example run: scroll, cut controls, inputs in view,
 * taps to primer, brass and capacity, layout shift while the charge is typed, tab order against
 * visual order, accessibility tree order, labels 30 % longer and the text spacing of WCAG 1.4.12.
 * Run in the dev container against a served export or `npm run dev:static`:
 *   WEB_URL=http://localhost:3003 node apps/e2e/scripts/workbench-layout-measure.mts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { type Browser, chromium, type Page } from '@playwright/test'
import { cut, cutText } from '../tests/web/cut.ts'
import { safetyAck } from '../tests/web/nav.ts'
import { storeUnits } from '../tests/web/units.ts'
import { runExample } from '../tests/web/workbench-run.ts'

/** Record names may end in an ellipsis (`apps/web/AGENTS.md`, Ellipsis); every other cut counts. */
const cutOf = async (found: Promise<string[]>) => {
  const all = await found
  const names = all.filter((c) => c.includes('(fake)'))
  return { cut: all.filter((c) => !names.includes(c)), recordNameEllipsis: names.length }
}

const base = process.env.WEB_URL ?? 'http://localhost:3003'
const dir = path.join(import.meta.dirname, '../../../prototype/workbench-layout')
const out = path.join(dir, 'screens')
mkdirSync(out, { recursive: true })

const sizes = {
  '1280x650': { width: 1280, height: 650 },
  '1366x657': { width: 1366, height: 657 },
  '390x844': { width: 390, height: 844 },
} as const
type Size = keyof typeof sizes
const variants = [
  { name: 'A', query: 'v=A' },
  { name: 'B', query: 'v=B' },
  { name: 'C', query: 'v=C' },
  { name: 'D', query: 'v=D' },
  { name: 'D-top', query: 'v=D&pin=top' },
]

// the text spacing of WCAG 1.4.12, as `text-spacing.spec.ts` applies it
const spacing = `* {
  line-height: 1.5 !important;
  letter-spacing: 0.12em !important;
  word-spacing: 0.16em !important;
}
p { margin-bottom: 2em !important; }`
const spacingExempt = '[role=combobox], .page-bar-status'

const targets = { primer: /^Primer/, brass: /^Brass record/, capacity: /^Case capacity record/ }

async function open(browser: Browser, size: Size, url: string) {
  const context = await browser.newContext({
    viewport: sizes[size],
    baseURL: base,
    serviceWorkers: 'block',
  })
  await context.addInitScript((ack) => {
    localStorage.setItem('safety-ack', ack)
    const w = window as unknown as { shifts: { inputs: number; other: number } }
    w.shifts = { inputs: 0, other: 0 }
    // every shift, also those right after input: an edit that moves the layout counts
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as {
        value: number
        sources: { node?: Node }[]
      }[]) {
        const inInputs = e.sources.some((s) =>
          (s.node instanceof Element ? s.node : s.node?.parentElement)?.closest(
            '.workspace-inputs',
          ),
        )
        w.shifts[inInputs ? 'inputs' : 'other'] += e.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
  }, safetyAck)
  const page = await context.newPage()
  await storeUnits(page)
  if (url === 'real') await runExample(page)
  else {
    await page.goto(url)
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' })
    await page
      .locator('.workspace-inputs form')
      .first()
      .waitFor({ state: 'attached', timeout: 60_000 })
  }
  await page.waitForTimeout(800)
  return page
}

/** Page scroll and the scroll containers with more content than room (`workbench-no-scroll.spec.ts`). */
const overflowing = (page: Page) =>
  page.evaluate(() => {
    const scrolls = (s: CSSStyleDeclaration) =>
      [s.overflowX, s.overflowY].some((o) => o === 'auto' || o === 'scroll')
    const root = document.scrollingElement as HTMLElement
    const pageScroll = {
      down: Math.max(0, root.scrollHeight - innerHeight),
      across: Math.max(0, root.scrollWidth - innerWidth),
    }
    const overflow = (e: HTMLElement) => {
      if (!(scrolls(getComputedStyle(e)) || e.matches('.workspace-inputs, .workspace-results')))
        return []
      const [h, w] = [e.scrollHeight - e.clientHeight, e.scrollWidth - e.clientWidth]
      const across = w > 1 && !e.matches('.ladder-cells, .proto-chips')
      if (h <= 1 && !across) return []
      return [`${e.className.split(' ')[0]} ${h > 1 ? `v${h}` : ''}${across ? `h${w}` : ''}`]
    }
    const found = [...document.querySelectorAll<HTMLElement>('main *')].flatMap(overflow)
    const inputs = document.querySelector('.workspace-inputs')
    return {
      pageScroll,
      scrolling: found,
      inputsColumnScroll: inputs ? inputs.scrollHeight - inputs.clientHeight : null,
    }
  })

/** Inputs of the load form: shown, and shown inside the window and the inputs column. */
const inputCounts = (page: Page) =>
  page.evaluate(() => {
    const form = document.querySelector('.workspace-inputs')
    if (!form) return null
    const all = [
      ...form.querySelectorAll<HTMLElement>(
        'input:not([type=hidden]):not([type=radio]), [role=slider], fieldset:has(input[type=radio])',
      ),
    ].filter((e) => !(e as HTMLInputElement).readOnly || e.getAttribute('role') === 'combobox')
    const box = form.getBoundingClientRect()
    const inView = (e: HTMLElement) => {
      const r = e.getBoundingClientRect()
      return (
        r.width > 0 &&
        r.top >= Math.max(0, box.top) - 1 &&
        r.bottom <= Math.min(innerHeight, box.bottom) + 1 &&
        r.left >= 0 &&
        r.right <= innerWidth + 1
      )
    }
    const shown = all.filter((e) => e.checkVisibility())
    return { total: all.length, shown: shown.length, inView: shown.filter(inView).length }
  })

/** Column bottoms and the figure's height, to set the fake cards against the shipped ones. */
const geometry = (page: Page) =>
  page.evaluate(() => ({
    columns: [...document.querySelectorAll('.workspace-inputs .panel-column')].map((c) => {
      const kids = [...c.children].map((k) => k.getBoundingClientRect())
      return {
        top: Math.round(Math.min(...kids.map((k) => k.top))),
        bottom: Math.round(Math.max(...kids.map((k) => k.bottom))),
      }
    }),
    cards: [...document.querySelectorAll<HTMLElement>('.workspace-inputs .panel')].map((p) => ({
      panel: p.dataset.panel,
      height: Math.round(p.getBoundingClientRect().height),
    })),
    figure: Math.round(
      document.querySelector('.workspace-inputs .figure-host')?.getBoundingClientRect().height ?? 0,
    ),
  }))

const visibleControl = (page: Page, label: RegExp) =>
  page
    .getByLabel(label)
    .filter({ visible: true })
    .count()
    .then((n) => n > 0)

/** The visible controls that open more inputs: the More buttons and the tabs. */
const openers = (page: Page) =>
  page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        'main button[aria-label^="More of"], main .workspace-tablist [role=tab], main .proto-groups [role=tab]',
      ),
    ]
      .filter((e) => e.checkVisibility() && e.getAttribute('aria-selected') !== 'true')
      .map((e) => e.getAttribute('aria-label') ?? e.textContent ?? ''),
  )

const clickOpener = (page: Page, name: string) =>
  page
    .locator('main button[aria-label^="More of"], main [role=tab]')
    .filter({ visible: true })
    .filter({ hasText: name })
    .or(page.locator(`main button[aria-label="${name}"]`))
    .first()
    .click()

/** Opens `url`, clicks the openers of `steps` and gives the targets then shown. */
async function shownAfter(browser: Browser, size: Size, url: string, steps: string[]) {
  const page = await open(browser, size, url)
  const shown: string[] = []
  try {
    for (const name of steps) {
      await clickOpener(page, name)
      await page.waitForTimeout(300)
    }
    for (const [k, label] of Object.entries(targets))
      if (await visibleControl(page, label)) shown.push(k)
  } catch {
    // an opener of the first state that an earlier step hid
  }
  await page.context().close()
  return shown
}

/** Taps from the page's first state to a shown control of each target, breadth first, at most 2. */
async function taps(browser: Browser, size: Size, url: string) {
  const result: Record<string, number | null> = {}
  const missing = () => Object.keys(targets).filter((k) => result[k] === undefined)
  for (const k of await shownAfter(browser, size, url, [])) result[k] = 0
  const page = await open(browser, size, url)
  const first = await openers(page)
  await page.context().close()
  const paths = [
    ...first.map((o) => [o]),
    ...first.flatMap((o) => first.filter((p) => p !== o).map((p) => [o, p])),
  ]
  for (const p of paths) {
    if (missing().length === 0) break
    for (const k of await shownAfter(browser, size, url, p))
      if (result[k] === undefined) result[k] = p.length
  }
  for (const k of missing()) result[k] = null
  return result
}

/**
 * Layout shift and the largest move of a control of the inputs (in the inputs' own coordinates)
 * while the charge goes 2.4, 60, 9; the charge's tab is opened first where it is behind one.
 */
async function editShift(page: Page) {
  const field = page
    .getByLabel(/^Charge mass/)
    .filter({ visible: true })
    .first()
  let opened = 0
  if (!(await field.count())) {
    await page.getByRole('tab', { name: 'Propellant' }).filter({ visible: true }).first().click()
    await page.waitForTimeout(500)
    opened = 1
  }
  const rects = () =>
    page.evaluate(() => {
      const form = document.querySelector('.workspace-inputs')
      if (!form) return []
      const box = form.getBoundingClientRect()
      return [...form.querySelectorAll<HTMLElement>('input, button')]
        .filter((e) => e.checkVisibility())
        .map((e) => {
          const r = e.getBoundingClientRect()
          return [r.left - box.left, r.top - box.top + form.scrollTop]
        })
    })
  await page.evaluate(() => {
    ;(window as unknown as { shifts: object }).shifts = { inputs: 0, other: 0 }
  })
  const before = await rects()
  for (const text of ['60', '9']) {
    await field.fill('')
    await field.pressSequentially(text, { delay: 50 })
    await page.waitForTimeout(300)
  }
  await page.waitForTimeout(500)
  const after = await rects()
  const moved =
    before.length === after.length
      ? Math.max(
          0,
          ...before.map(([x, y], i) =>
            Math.hypot((after[i]?.[0] ?? 0) - (x ?? 0), (after[i]?.[1] ?? 0) - (y ?? 0)),
          ),
        )
      : null
  const shifts = await page.evaluate(
    () => (window as unknown as { shifts: { inputs: number; other: number } }).shifts,
  )
  return {
    tapsToCharge: opened,
    clsInputs: Number(shifts.inputs.toFixed(4)),
    clsResults: Number(shifts.other.toFixed(4)),
    moved: moved === null ? null : Math.round(moved),
  }
}

/**
 * Tab order through the inputs against the visual order: column by column (the shipped columns
 * left to right), top to bottom, then left to right. `inversions` counts the steps that go back.
 */
async function tabOrder(page: Page) {
  await page
    .locator('.workspace-inputs')
    .first()
    .evaluate((e) => {
      const first = e.querySelector<HTMLElement>('input, button, [tabindex="0"]')
      first?.focus()
    })
  const seen: { name: string; key: number[] }[] = []
  for (let i = 0; i < 80; i++) {
    const f = await page.evaluate(() => {
      const e = document.activeElement as HTMLElement | null
      const form = document.querySelector('.workspace-inputs')
      if (!e || !form?.contains(e)) return null
      const r = e.getBoundingClientRect()
      const box = form.getBoundingClientRect()
      // the centre in the inputs' own coordinates: a scroll between two stops changes nothing
      const y = Math.round(r.top + r.height / 2 - box.top + form.scrollTop)
      const columns = [...form.querySelectorAll('.panel-column')]
        .filter((c) => (c as HTMLElement).checkVisibility())
        .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)
      const column = columns.findIndex((c) => c.contains(e))
      const label =
        e.getAttribute('aria-label') ||
        (e.id && document.querySelector(`label[for="${e.id}"]`)?.textContent) ||
        e.textContent ||
        (e as HTMLInputElement).value ||
        e.tagName
      return { name: label.trim().slice(0, 40), key: [column, y, Math.round(r.left - box.left)] }
    })
    if (!f) break
    seen.push(f)
    await page.keyboard.press('Tab')
  }
  const back = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i++) {
      // centres within 8 px count as one line
      if (i === 1 && Math.abs((a[1] ?? 0) - (b[1] ?? 0)) <= 8) continue
      if ((a[i] ?? 0) !== (b[i] ?? 0)) return (b[i] ?? 0) < (a[i] ?? 0)
    }
    return false
  }
  const inversions = seen.flatMap((s, i) => {
    const prev = seen[i - 1]
    return prev && back(prev.key, s.key) ? [`${prev.name} -> ${s.name}`] : []
  })
  return { stops: seen.length, inversions, order: seen.map((s) => s.name) }
}

/** Names of the controls of the inputs in the order of the accessibility tree. */
async function axOrder(page: Page) {
  const snapshot = await page.locator('.workspace-inputs').first().ariaSnapshot()
  return snapshot
    .split('\n')
    .map((l) =>
      l
        .trim()
        .match(
          /^- (textbox|combobox|spinbutton|radio|slider|switch|button|tab|checkbox) "([^"]*)"/,
        ),
    )
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => `${m[1]} ${m[2]}`)
}

const browser = await chromium.launch()
const rows: Record<string, unknown>[] = []

// calibration: the shipped workbench with the example run against the fake cards of A
for (const size of Object.keys(sizes) as Size[]) {
  const real = await open(browser, size, 'real')
  rows.push({
    variant: 'shipped',
    size,
    ...(await overflowing(real)),
    inputs: await inputCounts(real),
    geometry: await geometry(real),
    ...(await cutOf(cut(real))),
  })
  await real.screenshot({ path: path.join(out, `shipped-${size}.png`) })
  const tab = await tabOrder(real)
  await real.context().close()
  Object.assign(rows.at(-1) ?? {}, { tab, taps: await taps(browser, size, 'real') })
}

for (const size of Object.keys(sizes) as Size[])
  for (const v of variants) {
    const url = `/prototype-workbench/?${v.query}`
    const page = await open(browser, size, url)
    const row: Record<string, unknown> = {
      variant: v.name,
      size,
      ...(await overflowing(page)),
      inputs: await inputCounts(page),
      geometry: await geometry(page),
      ...(await cutOf(cut(page))),
    }
    await page.screenshot({ path: path.join(out, `${v.name}-${size}.png`) })
    if (size === '390x844')
      await page.screenshot({ path: path.join(out, `${v.name}-${size}-full.png`), fullPage: true })
    row.tab = await tabOrder(page)
    row.ax = await axOrder(page)
    row.edit = await editShift(page)
    await page.context().close()
    row.taps = await taps(browser, size, url)

    const long = await open(browser, size, `${url}&long=1`)
    row.long = { ...(await overflowing(long)), ...(await cutOf(cut(long))) }
    if (size === '1280x650')
      await long.screenshot({ path: path.join(out, `${v.name}-${size}-long.png`) })
    await long.context().close()

    const spaced = await open(browser, size, url)
    await spaced.addStyleTag({ content: spacing })
    await spaced.waitForTimeout(500)
    row.spacing = {
      ...(await overflowing(spaced)),
      ...(await cutOf(cutText(spaced, spacingExempt))),
    }
    if (size === '1280x650')
      await spaced.screenshot({ path: path.join(out, `${v.name}-${size}-spacing.png`) })
    await spaced.context().close()
    rows.push(row)
    console.log(
      v.name,
      size,
      JSON.stringify({ ...row, ax: undefined, tab: { ...(row.tab as object), order: undefined } }),
    )
  }
await browser.close()
writeFileSync(path.join(dir, 'measurements.json'), `${JSON.stringify(rows, null, 2)}\n`)
