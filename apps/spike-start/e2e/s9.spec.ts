import { type CDPSession, expect, type Page, test } from '@playwright/test'

// S9: 200,000 rows on TanStack Table and Virtual. Run with --workers 1: the long-task gate needs an idle machine.
declare global {
  interface Window {
    longTasks?: number[]
  }
}

const rows = 200_000
const sources = ['array', 'chunked'] as const
const grid = (page: Page) => page.getByRole('grid')
const scroller = (page: Page) => page.locator('.grid-scroll')
const activeCell = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    return {
      cell: el?.dataset.cell,
      rowIndex: el?.parentElement?.getAttribute('aria-rowindex'),
      text: el?.textContent ?? '',
      inGrid: Boolean(el?.closest('[role="grid"]')),
    }
  })

async function open(page: Page, source: (typeof sources)[number], query = '') {
  const params = new URLSearchParams(query)
  if (source === 'chunked') params.set('source', 'chunked')
  const search = params.size ? `?${params}` : ''
  await page.goto(`/grid/${search}`)
  await expect(page.locator('html[data-hydrated="1"]')).toBeAttached()
  if (!params.has('defer')) await firstRows(page)
}

const firstRows = (page: Page) =>
  expect(page.locator('[role="row"][aria-rowindex="2"] [role="gridcell"]').first()).not.toBeEmpty()

/** Starts a `longtask` observer (Chromium only); `takeTasks` returns the durations since the last call. */
async function observe(page: Page) {
  await page.evaluate(() => {
    window.longTasks = []
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.longTasks?.push(Math.round(e.duration))
    }).observe({ type: 'longtask' })
  })
}

async function takeTasks(page: Page) {
  // the observer reports after the task ends: give it two frames and a pause
  await page.waitForTimeout(300)
  return page.evaluate(() => window.longTasks?.splice(0) ?? [])
}

const nodeCount = (page: Page) =>
  page.evaluate(() => ({
    page: document.getElementsByTagName('*').length,
    grid: document.querySelectorAll('[role="grid"] *').length,
  }))

/** Wheel scrolling at `speed` px per second for `seconds`; returns the distance sent and the largest DOM. */
async function wheel(page: Page, seconds: number, speed: number) {
  const box = await scroller(page).boundingBox()
  if (!box) throw new Error('no grid')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  const started = Date.now()
  let sent = 0
  let nodes = { page: 0, grid: 0 }
  let lastSample = 0
  while (Date.now() - started < seconds * 1000) {
    const due = Math.round(((Date.now() - started) / 1000) * speed)
    if (due > sent) {
      await page.mouse.wheel(0, due - sent)
      sent = due
    }
    if (Date.now() - lastSample > 1000) {
      lastSample = Date.now()
      const n = await nodeCount(page)
      nodes = { page: Math.max(nodes.page, n.page), grid: Math.max(nodes.grid, n.grid) }
    }
    await page.waitForTimeout(16)
  }
  return { sent, nodes, scrollTop: await scroller(page).evaluate((el) => el.scrollTop) }
}

/** Drags the scroll bar's thumb from the top to the middle; tries the thumb below an arrow button, then at the top. */
async function dragToMiddle(page: Page) {
  const box = await scroller(page).boundingBox()
  if (!box) throw new Error('no grid')
  const bar = await scroller(page).evaluate((el) => el.offsetWidth - el.clientWidth - 2)
  const x = box.x + box.width - 1 - bar / 2
  for (const startY of [box.y + 1 + bar + 4, box.y + 1 + 4]) {
    await scroller(page).evaluate((el) => {
      el.scrollTop = 0
    })
    await page.waitForTimeout(100)
    await page.mouse.move(x, startY)
    await page.mouse.down()
    await page.mouse.move(x, box.y + box.height / 2, { steps: 30 })
    await page.mouse.up()
    await page.waitForTimeout(200)
    const share = await scroller(page).evaluate(
      (el) => el.scrollTop / (el.scrollHeight - el.clientHeight),
    )
    if (share > 0.3 && share < 0.7) return { bar, share }
  }
  return { bar, share: -1 }
}

/** The four scroll runs of the S9 gate, each with the long tasks it caused. */
async function scrollRuns(page: Page) {
  const a = await wheel(page, 10, 3000)
  const aTasks = await takeTasks(page)

  const box = await scroller(page).boundingBox()
  if (!box) throw new Error('no grid')
  // a click outside a cell focuses the scroller, whose keys scroll natively instead of moving the cell
  await firstVisibleFilled(page)
  await page.mouse.click(box.x + 60, box.y + box.height / 2)
  const pageDownFrom = await activeCell(page)
  expect(pageDownFrom.inGrid).toBe(true)
  for (let i = 0; i < 50; i++) await page.keyboard.press('PageDown')
  const pageDownTo = await activeCell(page)
  const bTasks = await takeTasks(page)

  await page.keyboard.press('Control+End')
  await expect.poll(async () => (await activeCell(page)).cell).toBe(`${rows - 1}:7`)
  await expect.poll(async () => (await activeCell(page)).text).not.toBe('')
  await page.keyboard.press('Control+Home')
  await expect.poll(async () => (await activeCell(page)).cell).toBe('-1:0')
  await expect.poll(() => scroller(page).evaluate((el) => el.scrollTop)).toBe(0)
  const cTasks = await takeTasks(page)

  const drag = await dragToMiddle(page)
  await firstVisibleFilled(page)
  const dTasks = await takeTasks(page)
  return {
    wheel: { ...a, tasks: aTasks },
    pageDown: { from: pageDownFrom.cell, to: pageDownTo.cell, tasks: bTasks },
    jump: { tasks: cTasks },
    drag: { ...drag, tasks: dTasks },
  }
}

/** The row at the middle of the scroll area shows its data. */
const firstVisibleFilled = (page: Page) =>
  expect
    .poll(() =>
      scroller(page).evaluate((el) => {
        const r = el.getBoundingClientRect()
        const hit = document.elementFromPoint(r.left + 60, r.top + r.height / 2)
        return hit?.closest('[role="gridcell"]')?.textContent ?? ''
      }),
    )
    .not.toBe('')

async function metrics(cdp: CDPSession) {
  await cdp.send('HeapProfiler.collectGarbage')
  const { metrics } = await cdp.send('Performance.getMetrics')
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]))
  return { heapUsed: m.JSHeapUsedSize, heapTotal: m.JSHeapTotalSize, nodes: m.Nodes }
}

// headless Chromium hides scroll bars; run (d) needs a thumb to drag
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })

test.describe('S9 Chromium measurements', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'longtask and CDP are Chromium only')
  test.setTimeout(180_000)

  for (const source of sources) {
    test(`S9 ${source}: no long task while scrolling`, async ({ page }) => {
      await open(page, source)
      await observe(page)
      const runs = await scrollRuns(page)
      console.log(`S9 gate ${source}`, JSON.stringify(runs))
      expect.soft(runs.wheel.tasks).toEqual([])
      expect.soft(runs.pageDown.tasks).toEqual([])
      expect.soft(runs.jump.tasks).toEqual([])
      expect.soft(runs.drag.tasks).toEqual([])
      expect(runs.drag.share).toBeGreaterThan(0)
    })

    test(`S9 ${source}: the same runs at 4 times CPU slowdown (recorded)`, async ({ page }) => {
      await open(page, source)
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      await observe(page)
      const runs = await scrollRuns(page)
      console.log(`S9 slow ${source}`, JSON.stringify(runs))
    })
  }

  test('S9 memory: heap before the rows, after the first paint, after scrolling', async ({
    page,
  }) => {
    await open(page, 'array', 'defer=1')
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Performance.enable')
    const before = await metrics(cdp)
    await page.evaluate(() => window.dispatchEvent(new Event('grid:start')))
    await firstRows(page)
    const painted = await metrics(cdp)
    const run = await wheel(page, 10, 3000)
    const scrolled = await metrics(cdp)
    const generateMs = await page.evaluate(() => window.gridProbe?.generateMs)
    console.log('S9 memory', JSON.stringify({ before, painted, scrolled, run, generateMs }))
  })

  test('S9 sort and filter over 200,000 rows in arraySource (recorded)', async ({ page }) => {
    await open(page, 'array')
    await observe(page)
    const lastQuery = () =>
      page.evaluate(() => {
        const q = window.gridProbe?.queries.at(-1)
        return q && { ms: Math.round(q.ms), sorting: q.query.sorting, filters: q.query.filters }
      })
    const firstName = page.locator('[role="row"][aria-rowindex="2"] [role="gridcell"]').first()
    const results: Record<string, unknown> = {}
    for (const [name, label] of [
      ['sortName', 'Name'],
      ['sortWeight', 'Weight (gr)'],
    ] as const) {
      const header = grid(page).getByRole('columnheader', { name: label })
      await header.click()
      // the table sorts a numeric column descending first
      await expect(header).toHaveAttribute('aria-sort', /ascending|descending/)
      await expect(firstName).not.toBeEmpty()
      results[name] = {
        ...(await lastQuery()),
        sort: await header.getAttribute('aria-sort'),
        tasks: await takeTasks(page),
      }
    }
    await page.getByTestId('grid-filter').fill('kalo')
    await expect(page.getByRole('grid')).toHaveAttribute('aria-busy', 'false')
    results.filter = {
      ...(await lastQuery()),
      total: await grid(page).getAttribute('aria-rowcount'),
      tasks: await takeTasks(page),
    }
    console.log('S9 sort and filter', JSON.stringify(results))
  })
})

test('S9 keyboard: the grid pattern across virtualization', async ({ page }) => {
  await open(page, 'array')
  await page.getByTestId('grid-filter').focus()
  await page.keyboard.press('Tab')
  expect(await activeCell(page)).toMatchObject({ cell: '-1:0', rowIndex: '1' })

  const pageRows = await scroller(page).evaluate((el) => Math.floor((el.clientHeight - 30) / 30))
  const steps: [string, string, string][] = [
    ['ArrowDown', '0:0', '2'],
    ['ArrowRight', '0:1', '2'],
    ['End', '0:7', '2'],
    ['Home', '0:0', '2'],
    ['ArrowDown', '1:0', '3'],
    ['ArrowUp', '0:0', '2'],
    ['PageDown', `${pageRows}:0`, `${pageRows + 2}`],
    ['PageUp', '0:0', '2'],
    ['Control+End', `${rows - 1}:7`, `${rows + 1}`],
    ['Control+Home', '-1:0', '1'],
  ]
  for (const [key, cell, rowIndex] of steps) {
    await page.keyboard.press(key)
    await expect.poll(() => activeCell(page), { message: key }).toMatchObject({ cell, rowIndex })
  }
  await expect(grid(page)).toHaveAttribute('aria-rowcount', String(rows + 1))
  await expect(grid(page)).toHaveAttribute('aria-colcount', '8')

  // the focused cell keeps the focus while its row is scrolled out of the window and back
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowRight')
  const focused = await activeCell(page)
  expect(focused).toMatchObject({ cell: '0:1', rowIndex: '2' })
  await scroller(page).evaluate((el) => {
    el.scrollTop = 1_500_000
  })
  await firstVisibleFilled(page)
  expect(await activeCell(page)).toMatchObject({ cell: '0:1', rowIndex: '2', inGrid: true })
  expect(await page.locator('[role="row"][aria-rowindex="2"]').count()).toBe(1)
  await scroller(page).evaluate((el) => {
    el.scrollTop = 0
  })
  await firstVisibleFilled(page)
  expect(await activeCell(page)).toMatchObject({ cell: '0:1', rowIndex: '2', inGrid: true })
  await expect.poll(async () => (await activeCell(page)).text).not.toBe('')
  await page.keyboard.press('ArrowDown')
  await expect.poll(() => activeCell(page)).toMatchObject({ cell: '1:1', rowIndex: '3' })

  // one tab stop: Shift+Tab and Tab leave the grid in one step, and Tab comes back to the same cell
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByTestId('grid-filter')).toBeFocused()
  await page.keyboard.press('Tab')
  expect(await activeCell(page)).toMatchObject({ cell: '1:1', inGrid: true })
  await page.keyboard.press('Tab')
  expect((await activeCell(page)).inGrid).toBe(false)

  // Enter on a column header sorts
  await grid(page).getByRole('columnheader', { name: 'Name' }).focus()
  await page.keyboard.press('Enter')
  await expect(grid(page).getByRole('columnheader', { name: 'Name' })).toHaveAttribute(
    'aria-sort',
    'ascending',
  )
})

for (const source of sources)
  test(`S9 ${source}: the last row is reachable by scrolling`, async ({ page }) => {
    await open(page, source)
    const height = await scroller(page).evaluate((el) => {
      el.scrollTop = el.scrollHeight
      return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }
    })
    const last = page.locator(`[role="row"][aria-rowindex="${rows + 1}"]`)
    await expect(last.locator('[role="gridcell"]').first()).not.toBeEmpty()
    await expect(last).toBeInViewport()
    const scrollTop = await scroller(page).evaluate((el) => el.scrollTop)
    console.log(`S9 scroll height ${source}`, JSON.stringify({ ...height, scrollTop }))
    // 200,000 rows and the header row, 30 px each at a fine pointer
    expect(height.scrollHeight).toBe((rows + 1) * 30)
    expect(scrollTop + height.clientHeight).toBe(height.scrollHeight)
  })
