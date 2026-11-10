import { expect, type Page, test } from '@playwright/test'
import { showGerman } from './german.ts'
import { gotoHydrated } from './nav.ts'
import { putRecords } from './user-store.ts'

// Throwaway: the keyboard, semantics and German checks of the mantine-datatable trial on /bullets, written against today's DirectoryTable (all pass there). Each also prints its measured value as `METRIC name value`.
const metric = (name: string, value: unknown) =>
  console.log(`METRIC ${name} ${JSON.stringify(value)}`)

const sortParam = (page: Page) => new URL(page.url()).searchParams.get('sort')
const boxes = (page: Page) => page.getByRole('checkbox', { name: /^Select (Demo|\d|\.)/ })

test('the table body is one tab stop and the head has one stop per sortable column', async ({
  page,
}) => {
  await gotoHydrated(page, '/bullets')
  const stops = (selector: string) =>
    page
      .locator(selector)
      .evaluate(
        (el) =>
          [
            ...el.querySelectorAll<HTMLElement>(
              'a[href], input:not(:disabled), button:not(:disabled), [tabindex]',
            ),
          ].filter((e) => e.tabIndex >= 0 && e.getClientRects().length > 0).length,
      )
  const body = await stops('tbody')
  const head = await stops('thead')
  metric('tab stops in the body (7 rows)', body)
  metric('tab stops in the head', head)
  expect(body).toBe(1)
})

test('the arrow keys move between rows in a column', async ({ page }) => {
  await gotoHydrated(page, '/bullets')
  await page.locator('tbody tr[data-row] td a').first().focus()
  const row = () => page.evaluate(() => document.activeElement?.closest('tr')?.dataset.id)
  const first = await row()
  await page.keyboard.press('ArrowDown')
  const second = await row()
  metric('ArrowDown from the first row moves the focus to', { first, second })
  expect(second).toBeTruthy()
  expect(second).not.toBe(first)
})

test('Enter and Space on a head sort ascending, descending, then in list order', async ({
  page,
}) => {
  await gotoHydrated(page, '/bullets')
  const head = page.locator('thead').getByRole('button', { name: /^Mass/ })
  await head.focus()
  const seen: (string | null)[] = []
  for (const key of ['Enter', 'Space', 'Enter']) {
    await page.keyboard.press(key)
    await page.waitForTimeout(150)
    seen.push(sortParam(page))
  }
  metric('sort param after Enter, Space, Enter', seen)
  expect(seen).toEqual(['mass', '-mass', null])
})

test('a click on a head cycles three states in the URL', async ({ page }) => {
  await gotoHydrated(page, '/bullets')
  const head = page.locator('thead').getByRole('button', { name: /^Mass/ })
  const seen: (string | null)[] = []
  for (let i = 0; i < 3; i++) {
    await head.click()
    await page.waitForTimeout(150)
    seen.push(sortParam(page))
  }
  metric('sort param after three clicks', seen)
  expect(seen).toEqual(['mass', '-mass', null])
})

test('the sorted head says aria-sort', async ({ page }) => {
  await gotoHydrated(page, '/bullets')
  await page.locator('thead').getByRole('button', { name: /^Mass/ }).click()
  const withSort = await page.locator('th[aria-sort]').count()
  metric('heads with aria-sort after one sort click', withSort)
  metric('role columnheader count', await page.getByRole('columnheader').count())
  await expect(page.getByRole('columnheader', { name: /^Mass/ })).toHaveAttribute(
    'aria-sort',
    'ascending',
  )
})

test('every sortable head is a columnheader, so the table keeps its header semantics', async ({
  page,
}) => {
  await gotoHydrated(page, '/bullets')
  const headers = await page.locator('thead th').count()
  const named = await page.getByRole('columnheader').count()
  metric('thead th / columnheader roles', { headers, named })
  expect(named).toBe(headers)
})

test('ticks keep the order ticked, stop at 4 and a full selection disables the other boxes', async ({
  page,
}) => {
  await gotoHydrated(page, '/bullets')
  const all = boxes(page)
  await all.nth(2).click()
  await all.nth(0).click()
  await expect.poll(() => new URL(page.url()).searchParams.get('pick')?.split(',').length).toBe(2)
  const ids = await page
    .locator('tr[data-row]')
    .evaluateAll((rs) => rs.map((r) => (r as HTMLElement).dataset.id))
  const pick = new URL(page.url()).searchParams.get('pick')
  metric('pick order after ticking row 3 then row 1', pick)
  expect(pick).toBe(`${ids[2]},${ids[0]}`)
  await all.nth(1).click()
  await all.nth(3).click()
  await expect(page.getByText('4 selected (max 4)')).toBeVisible()
  const fifth = all.nth(4)
  metric('fifth box disabled when 4 are ticked', await fifth.isDisabled())
  await expect(fifth).toBeDisabled()
})

test('a full selection explains itself on the disabled box', async ({ page }) => {
  await gotoHydrated(page, '/bullets')
  const all = boxes(page)
  for (const i of [0, 1, 2, 3]) await all.nth(i).click()
  const at = await all.nth(4).boundingBox()
  await page.mouse.move((at?.x ?? 0) + (at?.width ?? 0) / 2, (at?.y ?? 0) + (at?.height ?? 0) / 2)
  const tip = page.getByRole('tooltip', { name: 'At most 4 at once' })
  const shown = await tip
    .waitFor({ timeout: 2000 })
    .then(() => true)
    .catch(() => false)
  metric('At most 4 tooltip on a disabled box', shown)
  await expect(tip).toBeVisible()
})

test('a shift click ticks the rows between two boxes, cut at 4, and Shift+Space does the same', async ({
  page,
}) => {
  await gotoHydrated(page, '/bullets')
  const all = boxes(page)
  await all.nth(0).click()
  await all.nth(5).click({ modifiers: ['Shift'] })
  const ticked = await page.locator('tr[data-picked]').count()
  metric('rows ticked by click row 1, shift-click row 6', ticked)
  expect(ticked).toBe(4)
  await page.getByRole('button', { name: 'Clear selection' }).click()
  await all.nth(0).click()
  await all.nth(0).click()
  await all.nth(2).focus()
  await page.keyboard.press('Shift+Space')
  const range = await page.locator('tr[data-picked]').count()
  metric('Shift+Space on row 3 after a click on row 1', range)
  expect(range).toBe(3)
})

test('under German no English word is left in the table chrome', async ({ page }) => {
  await gotoHydrated(page, '/bullets')
  await showGerman(page)
  await page
    .locator('thead')
    .getByRole('button', { name: /^Masse|^Mass/ })
    .first()
    .click()
  await page.waitForTimeout(200)
  const texts = await page.locator('.directory-scroll').evaluate((el) => {
    const out = new Set<string>()
    for (const e of el.querySelectorAll<HTMLElement>('[aria-label], [title]')) {
      for (const a of ['aria-label', 'title']) {
        const v = e.getAttribute(a)
        if (v && !e.closest('tbody td a')) out.add(v)
      }
    }
    for (const e of el.querySelectorAll<HTMLElement>('thead *, .mantine-datatable-pagination *'))
      if (e.children.length === 0 && e.textContent?.trim()) out.add(e.textContent.trim())
    return [...out]
  })
  const english = texts.filter(
    (t) =>
      /\b(Sorted|Not sorted|ascending|descending|Select|Page|First|Last|Next|Previous|of|to)\b/.test(
        t,
      ) && !/^(Auswählen|Seite|Erste|Letzte|Nächste|Vorherige)/.test(t),
  )
  metric('texts in the table chrome under German', texts)
  metric('English texts under German', english)
  expect(english).toEqual([])
})

test("a row of the browser's own cannot be ticked", async ({ page }) => {
  await gotoHydrated(page, '/bullets')
  await putRecords(page, [
    {
      kind: 'bullet',
      id: '6a1d3c5e-7f90-4b2d-8e4f-1a3c5e7f9b2d',
      name: 'Own 175 gr',
      saved: '2026-11-07T00:00:00.000Z',
      data: {
        origin: 'user',
        overrides: { name: 'Own 175 gr', diameter: { value: 7.823 }, mass: { value: 11.34 } },
      },
    },
  ])
  await gotoHydrated(page, '/bullets')
  const row = page.locator('tr[data-row]', { hasText: 'Own 175 gr' })
  await expect(row).toHaveCount(1)
  metric('boxes in a Mine row, enabled ones', [
    await row.locator('input[type="checkbox"]').count(),
    await row.locator('input[type="checkbox"]:not(:disabled)').count(),
  ])
  await expect(row.locator('input[type="checkbox"]:not(:disabled)')).toHaveCount(0)
})

test('240 rows: the DOM stays bounded, a filter shows the first rows and a print holds 200 with its note', async ({
  page,
}) => {
  await gotoHydrated(page, '/bullets')
  await putRecords(
    page,
    Array.from({ length: 240 }, (_, i) => ({
      kind: 'bullet',
      id: `6a1d3c5e-7f90-4b2d-8e4f-${String(i).padStart(12, '0')}`,
      name: `Own ${i}`,
      saved: '2026-11-07T00:00:00.000Z',
      data: {
        origin: 'user',
        overrides: { name: `Own ${i}`, diameter: { value: 7.823 }, mass: { value: 11.34 } },
      },
    })),
  )
  await gotoHydrated(page, '/bullets')
  const rows = page.locator('tbody tr[data-row]')
  await expect(page.getByText(/^24\d of 24\d bullets$|^247 bullets$/)).toBeVisible()
  const bounded = await rows.count()
  metric('rows in the DOM of 247', bounded)
  expect(bounded).toBeLessThan(100)
  const footer = page.locator('.mantine-datatable-pagination')
  const next = page.getByRole('button', { name: 'Next page' })
  if (await next.count()) {
    await next.click()
    metric('footer after Next page', (await footer.textContent())?.slice(0, 40))
    await page.locator('.directory-search input').fill('Own 1')
    await page.waitForTimeout(300)
    metric('footer after a filter on page 2', (await footer.textContent())?.slice(0, 40))
  }
  await page.locator('.directory-search input').fill('Own 17')
  await page.waitForTimeout(300)
  const filtered = await rows.count()
  const first = await rows.first().getAttribute('data-id')
  metric('rows after a filter, first row', [filtered, first])
  await page.locator('.directory-search input').fill('')
  await page.emulateMedia({ media: 'print' })
  await page.waitForTimeout(500)
  const printed = await rows.count()
  const note = await page.locator('.print-only').textContent()
  metric('rows printed, note', [printed, note])
  expect(printed).toBe(200)
  expect(note).toBe('Printed: the first 200 of 247 bullets.')
})
