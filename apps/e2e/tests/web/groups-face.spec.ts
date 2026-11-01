import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { toolbarPopover } from './target.ts'
import { storeUnits } from './units.ts'

// The target face on a photo sets the scale, the centre and the face of the group, and the holes
// are found once the photo is added, without a click
test.beforeEach(async ({ page }) => {
  await storeUnits(page)
})

/** Test budget of a detection test: up to two 30 s detection waits after the photo is drawn and loaded. */
const detectionBudget = 90_000

const PX_PER_MM = 7.5
/** Photo px of the face centre. */
const C = { x: 700, y: 650 }

/**
 * A photo drawn in the page from the record of a face: black area, ring lines and dark holes of
 * 4.5 mm at `holes` (face mm), 1400 x 1300 px at 7.5 px per mm, seen from the front.
 */
async function facePng(
  page: Page,
  id: string,
  holes: [number, number][],
  rings = true,
  shade = false,
) {
  await gotoHydrated(page, '/groups')
  const b64 = await page.evaluate(
    async ({ id, holes, rings, shade, k, c }) => {
      const face = (await (await fetch(`/api/target-faces/${id}.json`)).json()) as {
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
      if (shade) {
        // a shadow over the left half of the sheet
        g.fillStyle = 'rgba(0, 0, 0, 0.5)'
        g.fillRect(0, 0, 700, 1300)
      }
      const bytes = new Uint8Array(
        await (await cv.convertToBlob({ type: 'image/png' })).arrayBuffer(),
      )
      let s = ''
      for (const x of bytes) s += String.fromCharCode(x)
      return btoa(s)
    },
    { id, holes, rings, shade, k: PX_PER_MM, c: C },
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
const faceSelect = (page: Page) =>
  page.getByRole('combobox', { name: 'Target on the photo', exact: true })
const scoreFace = (page: Page) => page.getByRole('combobox', { name: 'Target', exact: true })
const acceptSure = (page: Page) => page.getByRole('button', { name: /^Accept sure/ })
const status = (page: Page) => page.locator('.target-status')
const resultLine = (page: Page) => page.locator('[data-detect-result]')
const shotField = (page: Page) => page.getByRole('spinbutton', { name: /^Shot \d+ x$/ })

/** The marker diameter of the sheet, which gives the hole size when no bullet does. */
async function setMarker(page: Page, mm: string) {
  await toolbarPopover(page, 'Overlays')
  await field(page, 'Marker').fill(mm)
  await field(page, 'Marker').blur()
  await page.keyboard.press('Escape')
}

/** Back from a guided step to the result line. */
async function backToLine(page: Page) {
  for (let i = 0; i < 5 && !(await resultLine(page).isVisible()); i++)
    await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(resultLine(page)).toBeVisible()
}

/** The user's actions from choosing the photo on, counted. */
function counter() {
  const count = { n: 0 }
  const act = async (f: () => Promise<unknown>) => {
    count.n++
    await f()
  }
  return { count, act }
}

/** Midway between two ring lines, away from the black area. */
const sixHoles: [number, number][] = [
  [61.78, 22.49],
  [-10.03, 56.87],
  [-46.75, -17.02],
  [14.28, -39.23],
  [-63.87, 36.87],
  [16.88, 29.23],
]

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
    const path = '/api/target-faces/issf-10m-air-rifle.json'
    await page.route(`**${path}`, async (route) => {
      await gate
      if (response === 'failure') await route.fulfill({ status: 503, body: '{}' })
      else await route.continue()
    })
    // the page asks for every face on load, the face search on the photo added waits for the same held request
    const sent = page.waitForRequest((r) => r.url().endsWith(path))
    const png = await facePng(page, 'issf-10m-air-pistol', [])
    await load(page, png)
    await sent
    await page.getByRole('button', { name: /^Cancel \(/ }).click()
    let workers = 0
    page.on('worker', () => {
      workers++
    })
    const finished = page.waitForResponse((r) => r.url().endsWith(path))
    release()
    await (await finished).finished()
    await expect(page.locator('.target-status')).toHaveText('Detection cancelled.')
    await expect(scoreFace(page)).toHaveValue('')
    expect(workers).toBe(0)
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

test('a known hole size: from choosing the photo to Accept is 2 actions, no shot before Accept', async ({
  page,
}) => {
  test.setTimeout(detectionBudget)
  const png = await facePng(page, 'issf-10m-air-pistol', sixHoles)
  await setMarker(page, '4.5')
  const { count, act } = counter()
  await act(() => load(page, png))
  await expect(acceptSure(page)).toHaveText('Accept sure (6)', { timeout: 30_000 })
  await expect(resultLine(page)).toContainText('Air Pistol')
  await expect(resultLine(page)).toContainText('1 reference')
  await expect(resultLine(page)).toContainText('6 proposed, 0 maybe')
  await expect(status(page)).toHaveText('6 proposed, 0 maybe: accept them to add shots.')
  // the marker's size preselects its caliber class, which the line names with the size
  await expect(resultLine(page)).toContainText('4.5 mm (.177) air (4.50)')
  // no slider on the main path, and the proposals are no shots yet
  await expect(page.locator('.detect-step').getByRole('slider')).toHaveCount(0)
  await expect(shotField(page)).toHaveCount(0)
  await act(() => acceptSure(page).click())
  await expect(shotField(page)).toHaveCount(6)
  // the message says what the click did, not what was proposed before it
  await expect(status(page)).toHaveText('6 shots added.')
  expect(count.n).toBe(2)
  // at 1280 x 650 the shot list scrolls in its own box and Notes stays in view below it
  await page.setViewportSize({ width: 1280, height: 650 })
  const side = page.getByRole('complementary', { name: 'Statistics and shots' })
  await expect(side.getByRole('heading', { name: 'Notes' })).toBeInViewport()
  await expect(side.getByRole('button', { name: 'Add note' })).toBeInViewport()
  expect(await side.evaluate((e) => e.scrollHeight - e.clientHeight)).toBeLessThanOrEqual(1)
  // the rows beyond the key values open on request
  const more = side.getByRole('button', { name: 'All statistics' })
  await expect(more).toHaveAttribute('aria-expanded', 'false')
  await expect(side.getByRole('rowheader', { name: 'Width', exact: true })).toHaveCount(0)
  await more.click()
  await expect(side.getByRole('rowheader', { name: 'Width', exact: true })).toBeVisible()
})

test('an unknown hole size: the typed size is the third action, and the shots sit on the holes', async ({
  page,
}) => {
  test.setTimeout(detectionBudget)
  const png = await facePng(page, 'issf-10m-air-pistol', sixHoles)
  // the face's event shot at the group's distance becomes the discipline
  await field(page, 'Distance', 'm').fill('10')
  await field(page, 'Distance', 'm').blur()
  const { count, act } = counter()
  await act(() => load(page, png))
  await expect(page.locator('.target-status')).toHaveText(/^Enter the hole size/, {
    timeout: 30_000,
  })
  await expect(resultLine(page)).toContainText('1 reference')
  await expect(scoreFace(page)).toHaveValue('issf-10m-air-pistol')
  // the recognised face and event are the same entry of the discipline list
  await expect(page.getByRole('combobox', { name: 'Discipline', exact: true })).toHaveValue(
    'ISSF 10m Air Pistol',
  )
  await expect(page.getByRole('combobox', { name: 'Federation', exact: true })).toHaveValue('issf')
  await expect(page.locator('.detect-step').getByRole('slider')).toHaveCount(0)
  // one action: the size typed and entered in the result line
  await act(async () => {
    await field(page, 'Hole size').fill('4.5')
    await field(page, 'Hole size').press('Enter')
  })
  await expect(acceptSure(page)).toHaveText('Accept sure (6)', { timeout: 30_000 })
  await expect(shotField(page)).toHaveCount(0)
  await act(() => acceptSure(page).click())
  expect(count.n).toBe(3)
  // the shots sit where the holes were drawn: target mm, y up, the face centre at 0
  const shots: [number, number][] = []
  for (const n of [1, 2, 3, 4, 5, 6])
    shots.push([
      Number(await page.getByRole('spinbutton', { name: `Shot ${n} x` }).inputValue()),
      Number(await page.getByRole('spinbutton', { name: `Shot ${n} y` }).inputValue()),
    ])
  for (const [x, y] of sixHoles)
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

test('each item of the result line opens its editor', async ({ page }) => {
  test.setTimeout(detectionBudget)
  const png = await facePng(page, 'issf-10m-air-pistol', sixHoles)
  await setMarker(page, '4.5')
  await load(page, png)
  await expect(acceptSure(page)).toHaveText('Accept sure (6)', { timeout: 30_000 })
  await expect(status(page)).toHaveText(/^6 proposed/)
  const line = resultLine(page)
  // the caliber: the hole size field in the line
  await line.getByRole('button', { name: 'Change the hole size' }).click()
  await expect(line.getByRole('textbox', { name: 'Hole size (mm)', exact: true })).toBeVisible()
  // the target: the Scale step with the target found
  await line.getByRole('button', { name: 'Change the target' }).click()
  await expect(step(page, 'Scale')).toHaveAttribute('aria-current', 'step')
  // a step chosen: the message of the run before it goes
  await expect(status(page)).toHaveText('')
  await expect(faceSelect(page)).toHaveValue('issf-10m-air-pistol|10m-air-pistol')
  await backToLine(page)
  // the scale: Calibrate
  await resultLine(page).getByRole('button', { name: 'Change the scale' }).click()
  await expect(page.getByRole('textbox', { name: 'Known length (mm)', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  // the holes: the Review step
  await resultLine(page).getByRole('button', { name: 'Change the holes' }).click()
  await expect(step(page, 'Review')).toHaveAttribute('aria-current', 'step')
  await expect(acceptSure(page)).toHaveText('Accept sure (6)')
  // nothing was accepted on the way
  await expect(shotField(page)).toHaveCount(0)
})

test('a photo below the minimum quality names the problem and waits for Detect anyway', async ({
  page,
}) => {
  test.setTimeout(detectionBudget)
  const holes: [number, number][] = [
    [61.78, 22.49],
    [-10.03, 56.87],
    [-46.75, -17.02],
  ]
  await load(page, await facePng(page, 'issf-10m-air-pistol', holes, true, true))
  const anyway = page.getByRole('button', { name: 'Detect anyway' })
  await expect(anyway).toBeVisible({ timeout: 30_000 })
  const notes = page.locator('.quality-notes')
  await expect(notes).toContainText('The light is uneven')
  await expect(notes).toContainText('Retake in an even light')
  await expect(notes).toContainText('Detection waits.')
  // the face is applied, the run is not started
  await expect(acceptSure(page)).toHaveCount(0)
  const { violations } = await new AxeBuilder({ page })
    .include('.quality-notes')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([])
  await anyway.click()
  // the run goes on as for any photo: the hole size is the next thing it needs
  await expect(page.locator('.target-status')).toHaveText(/^Enter the hole size/, {
    timeout: 30_000,
  })
  await expect(notes).toContainText('The light is uneven')
  await expect(notes).not.toContainText('Detection waits.')
})

test('a face chosen for scoring on a sheet calibrated by a line does not move the detection', async ({
  page,
}) => {
  test.setTimeout(detectionBudget)
  const holes: [number, number][] = [
    [61.78, 22.49],
    [-10.03, 56.87],
    [-46.75, -17.02],
  ]
  // the face search on the photo added is held and cancelled, so the line sets the scale
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/target-faces/issf-10m-air-rifle.json', async (route) => {
    await gate
    await route.continue()
  })
  await load(page, await facePng(page, 'issf-10m-air-pistol', holes))
  await page.getByRole('button', { name: /^Cancel \(/ }).click()
  release()
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
  await expect(status(page)).toHaveText('Line 1 added.')
  // the popover closed: its message goes with it
  await page.getByRole('button', { name: 'Calibrate', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Known length (mm)', exact: true })).toBeHidden()
  await expect(status(page)).toHaveText('')
  // the face is chosen for scoring: no ring marks, no point of aim, the origin is the photo corner
  await scoreFace(page).selectOption('issf-10m-air-pistol')
  await goStep(page, 'Example')
  await field(page, 'Hole size').fill('4.5')
  await field(page, 'Hole size').blur()
  await goStep(page, 'Detect')
  await page.getByRole('button', { name: 'Detect holes' }).click()
  await expect(acceptSure(page)).toHaveText('Accept sure (3)', {
    timeout: 30_000,
  })
})

test('no target fits: the ellipses are shown and a typed black diameter sets the scale', async ({
  page,
}) => {
  test.setTimeout(detectionBudget)
  // a black area without ring lines
  const png = await facePng(page, 'issf-10m-air-pistol', [], false)
  await load(page, png)
  await expect(page.locator('.target-status')).toHaveText(/^No target fits the rings found/, {
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

/** The group panel and the photo popover of a sheet with a photo and no scale, at 1280 x 650. */
async function layoutWithoutScale(page: Page) {
  await page.setViewportSize({ width: 1280, height: 650 })
  const panel = page.getByRole('complementary', { name: 'Groups' })
  const box = async (l: ReturnType<Page['locator']>) => {
    const b = await l.boundingBox()
    if (!b) throw new Error('not shown')
    return b
  }
  // Federation, Discipline and Target span the column, each select naming its option in its title
  const name = await box(panel.getByRole('textbox', { name: 'Group name', exact: true }))
  for (const label of ['Federation', 'Discipline', 'Target']) {
    const select = panel.getByRole('combobox', { name: label, exact: true })
    expect((await box(select)).width, label).toBeGreaterThan(2 * name.width)
  }
  await expect(scoreFace(page)).toHaveAttribute('title', 'None')
  // without a target the scoring rows take no room: Detect follows the Target row
  const target = await box(scoreFace(page))
  const detect = await box(panel.getByRole('heading', { name: 'Detect', exact: true }))
  expect(detect.y - (target.y + target.height)).toBeLessThan(24)
  // the point of aim's x and y of one width beside the label, Set and Clear below them
  const x = await box(panel.getByLabel('Point of aim x', { exact: true }))
  const y = await box(panel.getByLabel('Point of aim y', { exact: true }))
  expect(Math.abs(x.width - y.width)).toBeLessThanOrEqual(1)
  expect(Math.abs(x.y - y.y)).toBeLessThanOrEqual(1)
  const set = panel.getByRole('button', { name: 'Set', exact: true })
  expect((await box(set)).y).toBeGreaterThan(x.y + x.height - 1)
  // the buttons that wait for a scale say so
  for (const button of [set, page.getByRole('button', { name: 'Add shot' }).first()])
    await expect(button).toHaveAttribute('title', 'Mark a reference first (Calibrate).')
  // the photo filters show their value and reset to the photo as it is
  await toolbarPopover(page, 'Photo')
  const contrast = page.getByRole('slider', { name: 'Contrast' })
  const reset = page.getByRole('button', { name: 'Reset Contrast' })
  await expect(reset).toBeDisabled()
  await contrast.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.filter-readout').first()).toHaveText('1.1')
  await reset.click()
  await expect(page.locator('.filter-readout').first()).toHaveText('1.0')
  await page.keyboard.press('Escape')
}

test('a photo without any face: the guided steps ask for the scale as before', async ({ page }) => {
  test.setTimeout(detectionBudget)
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
  await expect(page.locator('.target-status')).toHaveText(/^Straighten the photo if needed/, {
    timeout: 30_000,
  })
  await expect(step(page, 'Rotate')).toHaveAttribute('aria-current', 'step')
  // without a scale the guided run cannot start, and says why under its button
  await goStep(page, 'Detect')
  await expect(page.getByRole('button', { name: 'Detect holes' })).toBeDisabled()
  await expect(page.locator('[data-detect-blocked]')).toHaveText('Set the scale first (step 2).')
  await expect(page.getByRole('button', { name: 'Detect holes' })).toHaveAccessibleDescription(
    'Set the scale first (step 2).',
  )
  // the steps are cells of one width, and Back and Next stay where they are on every step
  const cells = await page
    .getByRole('list', { name: 'Detection steps' })
    .getByRole('button')
    .evaluateAll((b) => b.map((e) => Math.round(e.getBoundingClientRect().width)))
  expect(new Set(cells).size).toBe(1)
  const back = page.getByRole('button', { name: 'Back', exact: true })
  const at: number[] = []
  for (const name of ['Rotate', 'Scale', 'Example', 'Detect', 'Review']) {
    await goStep(page, name)
    at.push(Math.round((await back.boundingBox())?.y ?? 0))
  }
  expect(new Set(at).size, at.join(' ')).toBe(1)
  await goStep(page, 'Scale')
  await expect(faceSelect(page)).toBeDisabled()
  await layoutWithoutScale(page)
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
  // reached by a key, the focus ring is drawn inside the box, which clips what lies outside it
  await sheet.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect(sheet).toBeFocused()
  await expect(sheet).toHaveCSS('outline-offset', '-3px')
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
