import { expect, type Page, test } from '@playwright/test'
import { cut } from './cut.ts'
import { showGerman } from './german.ts'
import { storeUnits } from './units.ts'
import { applyExampleLoad, loadForm } from './workbench.ts'
import { runExample } from './workbench-run.ts'

test.beforeEach(({ page }) => storeUnits(page))

// from 1280 x 650 nothing scrolls and nothing is cut, with every panel in its default state; below
// 75em only the inputs column scrolls

/** Every scroll container of the page that has more content than room, and the page itself. */
const overflowing = (page: Page) =>
  page.evaluate(() => {
    const scrolls = (s: CSSStyleDeclaration) =>
      [s.overflowX, s.overflowY].some((o) => o === 'auto' || o === 'scroll')
    const pageSize = (): string[] => {
      const root = document.scrollingElement as HTMLElement
      if (root.scrollHeight > innerHeight || root.scrollWidth > innerWidth)
        return [`page ${root.scrollHeight - innerHeight} x ${root.scrollWidth - innerWidth}`]
      return []
    }
    const watched = (e: HTMLElement) =>
      scrolls(getComputedStyle(e)) ||
      e.matches('.workspace-inputs, .ladder-cells, .workspace-results')
    const directions = (h: number, w: number) => `${h > 1 ? 'v' : ''}${w > 1 ? 'h' : ''}`
    const element = (e: HTMLElement): string[] => {
      if (!watched(e)) return []
      const [h, w] = [e.scrollHeight - e.clientHeight, e.scrollWidth - e.clientWidth]
      // the ladder steps are one row that scrolls sideways, never down
      const wide = w > 1 && !e.matches('.ladder-cells')
      if (h > 1 || wide) return [`${e.tagName}.${e.className} ${directions(h, w)}`]
      return []
    }
    return [
      ...pageSize(),
      ...[...document.querySelectorAll<HTMLElement>('main *')].flatMap(element),
    ]
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
      // the sampled band and its line follow the result
      await expect(page.locator('.band-line')).toBeVisible({
        timeout: 10_000,
      })
      await expect.poll(() => overflowing(page)).toEqual([])
      expect(await cut(page)).toEqual([])
    })

// the run is made in English, then the language changes: the same results in German words
for (const [state, ladder] of [states[0], states[1]])
  test(`at 1280 x 650 the workbench in German with ${state} scrolls and cuts nothing`, async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width: 1280, height: 650 })
    await runExample(page)
    if (ladder) await runLadder(page, ...ladder)
    await showGerman(page)
    await expect(page.locator('.readouts dt', { hasText: 'Ladedichte' }).first()).toBeVisible()
    await expect(page.locator('.band-line')).toBeVisible({ timeout: 10_000 })
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

test('the Gun card keeps its weight error, firearm query and focus when the window height crosses 45em', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await runExample(page)
  const weight = page.getByLabel(/^Gun weight/)
  await weight.fill('0')
  await weight.blur()
  await expect(weight).toHaveAttribute('aria-invalid', 'true')
  const firearm = page.getByRole('combobox', { name: 'Firearm from your library' })
  await firearm.fill('rifle')
  await firearm.focus()
  for (const height of [650, 800]) {
    await page.setViewportSize({ width: 1280, height })
    await expect(page.locator('.panels')).toBeVisible()
    await expect(weight).toHaveAttribute('aria-invalid', 'true')
    await expect(firearm).toHaveValue('rifle')
    await expect(firearm).toBeFocused()
  }
})

// a run the compute refuses (a charge that does not fit the chamber) leaves its message in the results area, which keeps the no-scroll rule
for (const [width, height] of [
  [1280, 650],
  [1920, 1080],
] as const)
  test(`at ${width} x ${height} the workbench with a refused run scrolls and cuts nothing`, async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width, height })
    await page.goto('/workbench')
    await applyExampleLoad(page)
    const charge = loadForm(page).getByLabel(/^Charge mass/)
    await charge.fill('20')
    await charge.press('Control+Enter')
    await expect(page.getByText('The simulation did not run.')).toBeVisible()
    await expect.poll(() => overflowing(page)).toEqual([])
    expect(await cut(page)).toEqual([])
  })
