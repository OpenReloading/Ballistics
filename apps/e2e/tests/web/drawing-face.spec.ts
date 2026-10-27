import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { textWidth } from '../../../../packages/drawing/src/core/text.ts'
import { storeUnits } from './units.ts'

/** A common rifle cartridge and a rimfire one with a short case. */
const pages = ['308-win', '6mm-me-flobert-court']

for (const cartridge of pages)
  test(`${cartridge}: the drawn text is at most 2 % wider than the glyph table gives`, async ({
    page,
  }) => {
    const over: string[] = []
    await page.goto(`/cartridges/${cartridge}`)
    await page.evaluate(() => document.fonts.ready)
    const texts = await page.locator('svg.drawing.screen-only .dims text').evaluateAll((all) =>
      all.map((t) => ({
        text: t.textContent ?? '',
        em: Number.parseFloat(getComputedStyle(t).fontSize),
        length: (t as SVGTextElement).getComputedTextLength(),
      })),
    )
    expect(texts.length, cartridge).toBeGreaterThan(0)
    for (const { text, em, length } of texts)
      if (length > textWidth(text, em) * 1.02)
        over.push(`${cartridge} "${text}" ${length} > ${textWidth(text, em)}`)
    expect(over).toEqual([])
  })

test("the designer's views switch by keyboard, keeping the frame and the axis", async ({
  page,
}) => {
  // the designer's fields in mm, the record values unchanged
  await storeUnits(page)
  await page.goto('/cartridges/designer?from=308-win')
  const drawing = page.locator('svg[aria-labelledby="designer-drawing-title"]')
  const views = page.getByRole('radiogroup', { name: /^View/ })
  const [cartridge, chamber, combined] = ['Cartridge', 'Chamber', 'Combined'].map((name) =>
    views.getByRole('radio', { name }),
  )
  // Combined first once both sides are given; the cartridge view picked
  await expect(combined).toBeChecked()
  await views.getByText('Cartridge', { exact: true }).click()
  await expect(cartridge).toBeChecked()
  await expect(drawing.locator('.dims-cartridge')).toBeVisible()
  await expect(drawing.locator('.dims-chamber')).toBeHidden()
  await expect(drawing.locator('.part-chamber')).toBeHidden()
  await expect(drawing.locator('.part-chamber-over')).toBeHidden()
  await expect(drawing.locator('.dims-combined')).toBeHidden()
  // positions relative to the drawing: focusing an input may scroll the page
  const place = async (part: string) => {
    const [d, a] = [
      await drawing.boundingBox(),
      await drawing.locator(`${part} path.axis`).boundingBox(),
    ]
    return {
      width: d?.width,
      height: d?.height,
      x: (a?.x ?? 0) - (d?.x ?? 0),
      bottom: (a?.y ?? 0) + (a?.height ?? 0) - (d?.y ?? 0),
    }
  }
  const before = await place('.part-cartridge')
  await cartridge.focus()
  await page.keyboard.press('ArrowRight')
  await expect(chamber).toBeChecked()
  await expect(drawing.locator('.dims-chamber')).toBeVisible()
  await expect(drawing.locator('.dims-cartridge')).toBeHidden()
  await expect(drawing.locator('.part-cartridge')).toBeHidden()
  // the same frame, the chamber axis on the cartridge axis, both from 1 mm behind the head
  const after = await place('.part-chamber')
  expect(after.width).toBe(before.width)
  expect(after.height).toBe(before.height)
  expect(Math.abs(after.x - before.x)).toBeLessThan(0.5)
  expect(Math.abs(after.bottom - before.bottom)).toBeLessThan(0.5)
  await page.keyboard.press('ArrowRight')
  await expect(combined).toBeChecked()
  await expect(drawing.locator('.part-cartridge')).toBeVisible()
  await expect(drawing.locator('.part-chamber use.gap')).toBeVisible()
  // the chamber outline again over the filled cartridge section
  await expect(drawing.locator('.part-chamber-over')).toBeVisible()
  expect(
    await drawing.evaluate(
      (svg) =>
        (svg.querySelector('.part-cartridge') as Element).compareDocumentPosition(
          svg.querySelector('.part-chamber-over') as Element,
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ),
  ).toBeTruthy()
  await expect(drawing.locator('.dims-cartridge')).toBeHidden()
  await expect(drawing.locator('.dims-chamber')).toBeHidden()
  // the region callouts
  await expect(drawing.locator('.dims-combined text')).toHaveText([
    'R1 +0.02',
    'P1 +0.03',
    'P2 +0.03, H1 +0.07',
    'H2 +0.02',
  ])
  expect((await drawing.boundingBox())?.width).toBe(before.width)
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  // the record page draws each side in its own panel at one scale, both always shown
  test('both sides render without JavaScript, at one scale', async ({ page }) => {
    // the page streams its content into a hidden block that a script reveals; a style added to the
    // response reveals it here, so the drawings below are the server's alone
    await page.route('**/cartridges/308-win', async (route) => {
      const response = await route.fetch()
      const body = (await response.text()).replace(
        '</head>',
        '<style>div[hidden][id^="S:"] { display: block !important }</style></head>',
      )
      await route.fulfill({ response, body })
    })
    await page.goto('/cartridges/308-win')
    const cip = page.locator('main')
    const drawing = (side: string) =>
      cip
        .getByRole('region', { name: side, exact: true })
        .getByRole('group', { name: 'Outline, CIP 308 Win.', exact: true })
    const cartridge = drawing('Cartridge')
    const chamber = drawing('Chamber')
    await expect(cartridge.locator('.dims-cartridge')).toBeVisible()
    await expect(cartridge.locator('.part-chamber')).toHaveCount(0)
    await expect(chamber.locator('.dims-chamber')).toBeVisible()
    await expect(chamber.locator('.part-cartridge')).toHaveCount(0)
    // one scale for both sides: the same CSS px per drawing unit
    const scale = (svg: typeof cartridge) =>
      svg.evaluate((e) => {
        // the fitted scale of a viewBox shown with "meet"
        const [r, v] = [e.getBoundingClientRect(), (e as SVGSVGElement).viewBox.baseVal]
        return Math.min(r.width / v.width, r.height / v.height)
      })
    expect(await scale(chamber)).toBeCloseTo(await scale(cartridge), 3)
  })
})

test('a tall figure fits the window, no smaller than 11 px text', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/cartridges/18-x-81')
  // the figure is the server's (millimetres) until the page has read the stored units
  await page.waitForLoadState('networkidle')
  const cip = page.locator('main')
  // the cartridge side's figure
  const drawing = cip
    .getByRole('region', { name: 'Cartridge', exact: true })
    .getByRole('group', { name: 'Outline, CIP 18 x 81', exact: true })
  const size = async () => {
    const box = (await drawing.boundingBox()) as { width: number; height: number }
    const [viewBox, font] = await drawing.evaluate((svg) => [
      (svg as SVGSVGElement).viewBox.baseVal.width,
      Number.parseFloat(getComputedStyle(svg.querySelector('.dims text') as Element).fontSize),
    ])
    // CSS px per mm (8 drawing units), and the label text (font size in mm) in CSS px
    const perMm = (8 * box.width) / viewBox
    return { ...box, perMm, text: font * perMm }
  }
  const fitted = await size()
  expect(fitted.height).toBeLessThanOrEqual(800)
  expect(fitted.text).toBeGreaterThanOrEqual(11 - 0.01)
  expect(fitted.perMm).toBeLessThan(8)
})

const figure308 = (page: Page) => page.locator('main').locator('figure.drawing-figure')

test('the record sheet prints on one A4 page; other prints keep the browser page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  // the page sizes of the PDF, pt, with US Letter as the browser's page
  const sizes = async () =>
    [
      ...(await page.pdf({ format: 'Letter', preferCSSPageSize: true }))
        .toString('latin1')
        .matchAll(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/g),
    ].map(([, w, h]) => [Math.round(Number(w)), Math.round(Number(h))])
  await page.goto('/cartridges/308-win')
  expect(await sizes()).toEqual([[595, 842]])
  await page.goto('/firearms')
  expect((await sizes())[0]).toEqual([612, 792])
  // a record page left by a client navigation stays in the document, hidden
  await page.goto('/cartridges/308-win')
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'My gear', exact: true })
    .click()
  await expect(page).toHaveURL(/\/firearms\/$/)
  expect((await sizes())[0]).toEqual([612, 792])
})

test('printed, the drawings have no tab stop', async ({ page }) => {
  await page.goto('/cartridges/308-win')
  await page.emulateMedia({ media: 'print' })
  // a figure per side
  const print = figure308(page).getByRole('img', { name: 'Outline, CIP 308 Win.' })
  await expect(print).toHaveCount(2)
  for (const p of await print.all()) {
    await expect(p).toBeVisible()
    await expect(p.locator('[tabindex]')).toHaveCount(0)
  }
})

test('axe finds no violation in the figures', async ({ page }) => {
  await page.goto('/cartridges/308-win')
  // a figure per side
  await expect(figure308(page)).toHaveCount(2)
  const { violations } = await new AxeBuilder({ page }).include('figure.drawing-figure').analyze()
  expect(violations.map((v) => `${v.id} ${v.nodes.length}`)).toEqual([])
})
