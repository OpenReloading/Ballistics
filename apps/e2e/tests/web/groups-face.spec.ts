import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { toolbarPopover } from './target.ts'
import { storeUnits } from './units.ts'

// The target face on a photo sets the scale, the centre and the face of the group, and the holes
// are found without a click on one
test.beforeEach(async ({ page }) => {
  await storeUnits(page)
})

const PX_PER_MM = 7.5
/** Photo px of the face centre. */
const C = { x: 700, y: 650 }

/**
 * A photo drawn in the page from the record of a face: black area, ring lines and dark holes of
 * 4.5 mm at `holes` (face mm), 1400 x 1300 px at 7.5 px per mm, seen from the front.
 */
async function facePng(page: Page, id: string, holes: [number, number][], rings = true) {
  await gotoHydrated(page, '/groups')
  const b64 = await page.evaluate(
    async ({ id, holes, rings, k, c }) => {
      const face = (await (await fetch(`/api/target-faces/${id}`)).json()) as {
        rings: { diameter: { value: number } }[]
        blackDiameter: { value: number }
      }
      const cv = new OffscreenCanvas(1400, 1300)
      const g = cv.getContext('2d') as OffscreenCanvasRenderingContext2D
      g.fillStyle = '#efece3'
      g.fillRect(0, 0, 1400, 1300)
      const disc = (r: number) => {
        g.beginPath()
        g.arc(c.x, c.y, r * k, 0, 2 * Math.PI)
      }
      g.fillStyle = '#1c1c1e'
      disc(face.blackDiameter.value / 2)
      g.fill()
      if (rings) {
        g.lineWidth = 0.8 * k
        for (const r of face.rings) {
          const radius = r.diameter.value / 2
          g.strokeStyle = radius <= face.blackDiameter.value / 2 + 0.01 ? '#d8d8d4' : '#1c1c1e'
          disc(radius)
          g.stroke()
        }
      }
      g.fillStyle = '#262626'
      for (const [x, y] of holes) {
        g.beginPath()
        g.arc(c.x + x * k, c.y - y * k, 2.25 * k, 0, 2 * Math.PI)
        g.fill()
      }
      const bytes = new Uint8Array(
        await (await cv.convertToBlob({ type: 'image/png' })).arrayBuffer(),
      )
      let s = ''
      for (const x of bytes) s += String.fromCharCode(x)
      return btoa(s)
    },
    { id, holes, rings, k: PX_PER_MM, c: C },
  )
  return Buffer.from(b64, 'base64')
}

const step = (page: Page, name: string) =>
  page
    .getByRole('list', { name: 'Detection steps' })
    .getByRole('button', { name: new RegExp(`^\\d ${name}$`) })
async function goStep(page: Page, name: string) {
  await step(page, name).click()
  await expect(step(page, name)).toHaveAttribute('aria-current', 'step')
}
const field = (page: Page, label: string, unit = 'mm') =>
  page.getByRole('textbox', { name: `${label} (${unit})`, exact: true })
const faceSelect = (page: Page) => page.getByRole('combobox', { name: 'Target face', exact: true })
const scoreFace = (page: Page) => page.getByRole('combobox', { name: 'Face', exact: true })

async function load(page: Page, png: Buffer) {
  await expect(page.getByRole('combobox', { name: 'Target sheet' })).not.toHaveValue('')
  await page
    .locator('.target-toolbar input[type=file]:not([capture])')
    .setInputFiles({ name: 'face.png', mimeType: 'image/png', buffer: png })
  await expect(page.locator('.target-canvas image')).toHaveAttribute('href', /^blob:/)
}

for (const response of ['success', 'failure'] as const) {
  test(`cancel ignores a late face request ${response}`, async ({ page }) => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const path = '/api/target-faces/issf-10m-air-rifle'
    await page.route(`**${path}`, async (route) => {
      await gate
      if (response === 'failure') await route.fulfill({ status: 503, body: '{}' })
      else await route.continue()
    })
    await load(page, await facePng(page, 'issf-10m-air-pistol', []))
    await page.getByRole('button', { name: 'Detect holes', exact: true }).click()
    await page.getByRole('button', { name: /^Cancel \(/ }).click()
    let workers = 0
    page.on('worker', () => {
      workers++
    })
    const finished = page.waitForResponse((r) => r.url().endsWith(path))
    release()
    await (await finished).finished()
    // The response has reached the browser before checking for delayed UI changes.
    await page.waitForTimeout(1000)
    expect(workers).toBe(0)
    await expect(page.locator('.target-status')).toHaveText('Detection cancelled.')
    await expect(scoreFace(page)).toHaveValue('')
  })
}

test('a federation narrows the disciplines, a discipline its faces, and a face shows its federation', async ({
  page,
}) => {
  await page.goto('/groups')
  const federation = page.getByRole('combobox', { name: 'Federation', exact: true })
  await expect(federation.locator('option[value="dsb"]')).toBeAttached()
  await federation.selectOption('dsb')
  // a federation alone narrows the face list to its faces
  await expect(scoreFace(page).locator('option[value="bdmp-nr1-100m"]')).toHaveCount(0)
  const discipline = page.getByRole('combobox', { name: 'Discipline', exact: true })
  await discipline.fill('Zentralfeuer')
  await page
    .getByRole('option', { name: /Zentralfeuerpistole/ })
    .first()
    .click()
  // one face per stage of the discipline; the event comes from its mapping
  await expect(scoreFace(page).locator('option')).toHaveText(['None', /Präzision$/, /Duell$/])
  await expect(page.getByRole('combobox', { name: 'Event', exact: true })).toHaveCount(0)
  // a face picked from every face shows the federation of its discipline
  await scoreFace(page).selectOption('')
  await federation.selectOption('')
  await scoreFace(page).selectOption('bdmp-nr1-100m')
  await expect(federation).toHaveValue('bdmp')
})

test('one click finds the face: scale, centre and face are set and the holes are proposed', async ({
  page,
}) => {
  // midway between two ring lines, away from the black area
  const holes: [number, number][] = [
    [61.78, 22.49],
    [-10.03, 56.87],
    [-46.75, -17.02],
    [14.28, -39.23],
    [-63.87, 36.87],
    [16.88, 29.23],
  ]
  const png = await facePng(page, 'issf-10m-air-pistol', holes)
  await load(page, png)
  // the face's event shot at the group's distance becomes the discipline
  await field(page, 'Distance', 'm').fill('10')
  await field(page, 'Distance', 'm').blur()
  // no scale yet: the one-click start looks for the face first
  await page.getByRole('button', { name: 'Detect holes' }).click()
  await expect(page.locator('.target-status')).toHaveText(/^Enter the hole size/, {
    timeout: 30_000,
  })
  await goStep(page, 'Scale')
  await expect(page.locator('.detect-step')).toContainText('1 reference')
  await expect(faceSelect(page)).toHaveValue('issf-10m-air-pistol|10m-air-pistol')
  await expect(scoreFace(page)).toHaveValue('issf-10m-air-pistol')
  // the recognised face and event are the same entry of the discipline list
  await expect(page.getByRole('combobox', { name: 'Discipline', exact: true })).toHaveValue(
    'ISSF 10m Air Pistol',
  )
  await expect(page.getByRole('combobox', { name: 'Federation', exact: true })).toHaveValue('issf')

  // the hole size, then the run: no example hole is clicked
  await goStep(page, 'Example')
  await field(page, 'Hole size').fill('4.5')
  await field(page, 'Hole size').blur()
  await goStep(page, 'Detect')
  await page.getByRole('button', { name: 'Detect holes' }).click()
  await expect(page.getByRole('button', { name: /^Accept all/ })).toHaveText('Accept all (6)', {
    timeout: 30_000,
  })
  await page.getByRole('button', { name: /^Accept all/ }).click()
  // the shots sit where the holes were drawn: target mm, y up, the face centre at 0
  const shots: [number, number][] = []
  for (const n of [1, 2, 3, 4, 5, 6])
    shots.push([
      Number(await page.getByRole('spinbutton', { name: `Shot ${n} x` }).inputValue()),
      Number(await page.getByRole('spinbutton', { name: `Shot ${n} y` }).inputValue()),
    ])
  for (const [x, y] of holes)
    expect(
      shots.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 1.5),
      `${x} ${y} in ${JSON.stringify(shots)}`,
    ).toBe(true)
  // a coordinate shows in full: the text is not wider than its field
  const clipped = await page
    .getByRole('spinbutton', { name: /^Shot \d+ [xy]$/ })
    .evaluateAll((inputs) =>
      inputs.filter((i) => i.scrollWidth > i.clientWidth).map((i) => i.getAttribute('aria-label')),
    )
  expect(clipped).toEqual([])
  // the shots table fits its box at the lowest window of the side layout and a wide one
  for (const width of [1000, 1030, 1100, 1400]) {
    await page.setViewportSize({ width, height: 900 })
    await expect
      .poll(() =>
        page
          .locator('.shots-scroll')
          .evaluateAll((e) => e.filter((x) => x.scrollWidth > x.clientWidth).length),
      )
      .toBe(0)
  }
})

test('a face chosen for scoring on a sheet calibrated by a line does not move the detection', async ({
  page,
}) => {
  const holes: [number, number][] = [
    [61.78, 22.49],
    [-10.03, 56.87],
    [-46.75, -17.02],
  ]
  await load(page, await facePng(page, 'issf-10m-air-pistol', holes))
  // a line reference across the outer ring: 155.5 mm
  await toolbarPopover(page, 'Calibrate')
  await page.getByRole('textbox', { name: 'Known length (mm)', exact: true }).fill('155.5')
  await page.getByRole('button', { name: 'Mark on photo' }).click()
  for (const x of [117, 1283]) {
    const p = await page.evaluate(
      ([x, y]) => {
        const svg = document.querySelector('.target-canvas svg') as SVGSVGElement
        const q = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM() as DOMMatrix)
        return { x: q.x, y: q.y }
      },
      [x, 650],
    )
    await page.mouse.click(p.x, p.y)
  }
  await expect(page.getByRole('textbox', { name: 'Line 1 (mm)', exact: true })).toHaveValue('155.5')
  await page.keyboard.press('Escape')
  // the face is chosen for scoring: no ring marks, no point of aim, the origin is the photo corner
  await scoreFace(page).selectOption('issf-10m-air-pistol')
  await goStep(page, 'Example')
  await field(page, 'Hole size').fill('4.5')
  await field(page, 'Hole size').blur()
  await goStep(page, 'Detect')
  await page.getByRole('button', { name: 'Detect holes' }).click()
  await expect(page.getByRole('button', { name: /^Accept all/ })).toHaveText('Accept all (3)', {
    timeout: 30_000,
  })
})

test('no face fits: the ellipses are shown and a typed black diameter sets the scale', async ({
  page,
}) => {
  // a black area without ring lines
  const png = await facePng(page, 'issf-10m-air-pistol', [], false)
  await load(page, png)
  await page.getByRole('button', { name: 'Detect holes' }).click()
  await expect(page.locator('.target-status')).toHaveText(/^No face fits the rings found/, {
    timeout: 30_000,
  })
  await expect(step(page, 'Scale')).toHaveAttribute('aria-current', 'step')
  await expect(page.locator('.detect-region')).toHaveCount(1)
  await expect(page.locator('.detect-step')).toContainText('none')
  // the ranking is offered
  await expect(faceSelect(page)).toBeEnabled()
  await expect(faceSelect(page).locator('option')).toHaveCount(5)
  // typed by hand: nothing is applied before the field is left or Enter is pressed
  await field(page, 'Black diameter').pressSequentially('59.5')
  await expect(field(page, 'Black diameter')).toHaveValue('59.5')
  await expect(page.locator('.detect-step')).toContainText('none')
  await page.keyboard.press('Enter')
  // the next step opens: the guided steps go on
  await expect(step(page, 'Example')).toHaveAttribute('aria-current', 'step')
  await goStep(page, 'Scale')
  await expect(page.locator('.detect-step')).toContainText('1 reference')
})

test('a photo without any face: the guided steps ask for the scale as before', async ({ page }) => {
  await page.goto('/groups')
  const blank = await page.evaluate(async () => {
    const cv = new OffscreenCanvas(800, 600)
    const g = cv.getContext('2d') as OffscreenCanvasRenderingContext2D
    g.fillStyle = '#efece3'
    g.fillRect(0, 0, 800, 600)
    const bytes = new Uint8Array(
      await (await cv.convertToBlob({ type: 'image/png' })).arrayBuffer(),
    )
    let s = ''
    for (const x of bytes) s += String.fromCharCode(x)
    return btoa(s)
  })
  await load(page, Buffer.from(blank, 'base64'))
  await page.getByRole('button', { name: 'Detect holes' }).click()
  await expect(page.locator('.target-status')).toHaveText(/^Straighten the photo if needed/, {
    timeout: 30_000,
  })
  await expect(step(page, 'Rotate')).toHaveAttribute('aria-current', 'step')
  await goStep(page, 'Scale')
  await expect(faceSelect(page)).toBeDisabled()
  // the Face row of the Scale step is part of the page
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([])
})

test('the sheet pans by arrow keys and zooms in at a double click, no drag needed', async ({
  page,
}) => {
  await gotoHydrated(page, '/groups')
  const sheet = page.getByRole('application', { name: 'Target sheet' })
  const view = async () =>
    ((await sheet.getAttribute('viewBox')) ?? '').split(' ').map(Number) as [
      number,
      number,
      number,
      number,
    ]
  const [, , w0] = await view()
  await page.getByRole('button', { name: 'Zoom in' }).click()
  const [x1, y1, w1] = await view()
  expect(w1).toBeLessThan(w0)

  await sheet.focus()
  await sheet.press('ArrowRight')
  await sheet.press('ArrowDown')
  const [x2, y2, w2] = await view()
  expect(x2).toBeGreaterThan(x1)
  expect(y2).toBeGreaterThan(y1)
  expect(w2).toBe(w1)

  await sheet.dblclick({ position: { x: 40, y: 40 } })
  const [, , w3] = await view()
  expect(w3).toBeLessThan(w2)
})
