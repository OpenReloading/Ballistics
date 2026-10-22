import { expect, type Page, test } from '@playwright/test'
import { storeUnits } from './units.ts'
import { loadForm } from './workbench.ts'
import { runExample } from './workbench-run.ts'

test.beforeEach(({ page }) => storeUnits(page))

// from 1280 x 650 nothing scrolls and nothing is cut, with every panel in its default state; below
// 75em only the inputs column scrolls

/** Every scroll container of the page that has more content than room, and the page itself. */
const overflowing = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = []
    const root = document.scrollingElement as HTMLElement
    if (root.scrollHeight > innerHeight || root.scrollWidth > innerWidth)
      out.push(`page ${root.scrollHeight - innerHeight} x ${root.scrollWidth - innerWidth}`)
    for (const e of document.querySelectorAll<HTMLElement>('main *')) {
      const s = getComputedStyle(e)
      const scrolls = [s.overflowX, s.overflowY].some((o) => o === 'auto' || o === 'scroll')
      if (!scrolls && !e.matches('.workspace-inputs, .ladder-cells, .workspace-results')) continue
      const [h, w] = [e.scrollHeight - e.clientHeight, e.scrollWidth - e.clientWidth]
      // the ladder steps are one row that scrolls sideways, never down
      const sideways = e.matches('.ladder-cells')
      if (h > 1 || (w > 1 && !sideways))
        out.push(`${e.tagName}.${e.className} ${h > 1 ? 'v' : ''}${w > 1 ? 'h' : ''}`)
    }
    return out
  })

/**
 * Buttons, tabs, fields, labels, units and values whose text overflows their own box or whose box
 * is cut by an ancestor that clips; what a scroll container holds counts as scrolled, not cut.
 */
const cut = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = []
    const clips = (o: string) => o === 'hidden' || o === 'clip'
    const hidden = (e: Element) => {
      for (let a: Element | null = e; a; a = a.parentElement)
        if (getComputedStyle(a).clipPath === 'inset(50%)') return true
      return false
    }
    for (const e of document.querySelectorAll<HTMLElement>(
      'main :is(button, [role=tab], input, label, dt, dd, .field-unit)',
    )) {
      const r = e.getBoundingClientRect()
      if (r.width < 2 || r.height < 2 || !e.checkVisibility() || hidden(e)) continue
      const name = `${e.tagName} "${e.textContent || (e as HTMLInputElement).value || e.ariaLabel}"`
      const s = getComputedStyle(e)
      if ((e.tagName === 'INPUT' || clips(s.overflowX)) && e.scrollWidth > e.clientWidth + 1)
        out.push(`${name} overflows`)
      for (let a = e.parentElement; a; a = a.parentElement) {
        const as = getComputedStyle(a)
        if ([as.overflowX, as.overflowY].some((o) => o === 'auto' || o === 'scroll')) break
        const b = a.getBoundingClientRect()
        const [left, top] = [b.left + a.clientLeft, b.top + a.clientTop]
        const x = clips(as.overflowX) && (r.left < left - 1 || r.right > left + a.clientWidth + 1)
        const y = clips(as.overflowY) && (r.top < top - 1 || r.bottom > top + a.clientHeight + 1)
        if (x || y) {
          out.push(`${name} cut by ${a.tagName}.${a.className}`)
          break
        }
      }
    }
    return out
  })

/** Runs the example with a `steps`-step ladder of `kind`; its top steps carry the widest flags. */
async function runLadder(page: Page, kind: 'Charge' | 'Seating', steps: number) {
  const form = loadForm(page)
  await form.getByLabel(/^Ladder steps/).fill(String(steps))
  await form.getByRole('radio', { name: kind, exact: true }).check()
  await form.getByLabel(/^Step size/).fill(kind === 'Charge' ? '0.15' : '0.5')
  await form.getByRole('radio', { name: kind === 'Charge' ? 'Up' : 'Down', exact: true }).check()
  await form.getByLabel(/^Step size/).press('Control+Enter')
  await expect(page.getByText(/^Result of /)).toBeAttached({ timeout: 15_000 })
  await expect(page.getByRole('group', { name: `${kind} ladder` }).getByRole('radio')).toHaveCount(
    steps,
  )
}

const states = [
  ['the example load run', undefined],
  ['a 5-step charge ladder', ['Charge', 5]],
  ['a 21-step charge ladder', ['Charge', 21]],
  ['a 5-step seating ladder', ['Seating', 5]],
] as const

// the lowest window of each layout with every state, a 768 px laptop's window, the others with the
// example
for (const [width, height, shown] of [
  [1280, 650, states],
  [1366, 657, [states[0], states[2]]],
  [1536, 730, states],
  [1280, 800, states.slice(0, 1)],
  [1920, 1080, states.slice(0, 1)],
] as const)
  for (const [state, ladder] of shown)
    test(`at ${width} x ${height} the workbench with ${state} scrolls and cuts nothing`, async ({
      page,
    }) => {
      test.setTimeout(60_000)
      await page.setViewportSize({ width, height })
      await runExample(page)
      if (ladder) await runLadder(page, ...ladder)
      await expect.poll(() => overflowing(page)).toEqual([])
      expect(await cut(page)).toEqual([])
    })

test('at 1100 x 800 only the inputs column of the workbench scrolls, not the page', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1100, height: 800 })
  await runExample(page)
  await expect
    .poll(() => overflowing(page))
    .toEqual([expect.stringMatching(/ workspace-inputs v$/)])
  expect(await cut(page)).toEqual([])
})

/** Runs the example and opens the result tab Trajectory. */
async function openTrajectory(page: Page) {
  await runExample(page)
  await page.getByRole('tab', { name: 'Trajectory', exact: true }).click()
  await expect(page.getByRole('table', { name: /^Trajectory: / })).toBeVisible()
}

// the Trajectory tab is one view: only the results column may scroll, and only vertically
for (const [width, height, scrolls] of [
  [1920, 1080, []],
  [1536, 730, ['SECTION.workspace-scroll v']],
  [1366, 650, ['SECTION.workspace-scroll v']],
] as const)
  test(`at ${width} x ${height} the Trajectory tab shows inputs, holds, chart and table in one view`, async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width, height })
    await openTrajectory(page)
    await expect(page.getByRole('tablist', { name: 'Trajectory views' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Print range card' })).toBeVisible()
    await expect(page.getByLabel(/^Range step/)).toBeVisible()
    await expect(page.getByRole('img', { name: /^Height above the line of sight/ })).toBeAttached()
    await expect.poll(() => overflowing(page)).toEqual(scrolls)
  })

test('the Trajectory tab keeps its inputs when another tab is opened and it is opened again', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1366, height: 650 })
  await openTrajectory(page)
  const step = page.getByLabel(/^Range step/)
  await step.fill('50')
  await page.getByRole('tab', { name: 'Chart', exact: true }).click()
  await page.getByRole('tab', { name: 'Trajectory', exact: true }).click()
  await expect(step).toHaveValue('50')
})
