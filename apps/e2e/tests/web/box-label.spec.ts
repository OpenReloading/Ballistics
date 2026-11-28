import { expect, type Page, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { showGerman } from './german.ts'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { openKeeping, openSavedLoad } from './workbench.ts'

test.beforeEach(({ page }) => storeUnits(page))
// the printed QR code is read from a screenshot: at 96 dpi a module is 2.9 px, which jsQR cannot read for some codes; at 3 x it is 8.6 px
test.use({ deviceScaleFactor: 3 })

/** The label in each language: German row names are longer, the label must still hold them. */
const languages = [
  { name: 'English', button: /^Print a box label of /, lot: 'Bullet G-0815' },
  { name: 'German', button: /^Schachtel-Etikett von .* drucken$/, lot: 'Geschoss G-0815' },
]

for (const language of languages)
  test(`a saved load prints its box label of 90 x 60 mm with the QR code on A4 in ${language.name}`, async ({
    page,
  }, testInfo) => {
    // neither dialog can be driven: the file goes to the origin private file system, and the page stays in its print state
    await page.addInitScript(() => {
      ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () =>
        (await navigator.storage.getDirectory()).getFileHandle('export.json', { create: true })
      window.print = () => {}
    })
    await page.setViewportSize({ width: 1280, height: 900 })
    await gotoHydrated(page, '/workbench')
    await openSavedLoad(page)
    // every lot typed: the tallest label
    await openKeeping(page)
    for (const [component, text] of [
      ['powder', 'P-2026-0412-A'],
      ['primer', 'Z-778341'],
      ['case', 'H-19-2203'],
      ['bullet', 'G-0815'],
    ] as const) {
      await page.getByRole('button', { name: `Add lot for the ${component}`, exact: true }).click()
      await page
        .getByRole('textbox', { name: new RegExp(`^${component} lot$`, 'i') })
        .first()
        .fill(text)
    }
    await (await barButton(page, 'Save')).click()
    await expect(page.locator('.file-state')).toContainText('Saved')
    await (await barButton(page, 'Open')).click()
    await page.getByRole('menuitem', { name: /^Saved loads/ }).click()
    const drawer = page.getByRole('dialog', { name: 'Saved loads' })
    await expect(drawer).toBeVisible()
    if (language.name === 'German') await showGerman(page)
    await page.getByRole('button', { name: language.button }).click()

    const label = page.locator('.box-labels .box-label')
    await expect(label).toHaveCount(1)
    await page.emulateMedia({ media: 'print' })
    // A4 portrait at 96 dpi
    await page.setViewportSize({ width: 794, height: 1123 })
    await expect(label).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`box-label-a4-${language.name}.png`) })
    await expect(label).toContainText('COAL')
    await expect(label).toContainText(language.lot)
    await expect(label).toContainText('H-19-2203')
    await expect(label.locator('.box-label-code')).toContainText(/^OR1:L:[0-9a-f-]{36}$/)
    const box = await label.boundingBox()
    // 90 x 60 mm, 96 px per inch
    expect(box?.width).toBeCloseTo((90 / 25.4) * 96, 0)
    expect(box?.height).toBeCloseTo((60 / 25.4) * 96, 0)
    expect(
      await label.evaluate(
        (el) => el.scrollWidth - el.clientWidth + el.scrollHeight - el.clientHeight,
      ),
    ).toBe(0)
  })

test.describe('a printed box label opens its load', () => {
  /** The label as the printer gets it: its image and the text under its QR code. */
  let printed: { image: Buffer; text: string }
  const openSaved = async (page: Page) => {
    await (await barButton(page, 'Open')).click()
    await page.getByRole('menuitem', { name: /^Saved loads/ }).click()
    await expect(page.getByRole('dialog', { name: 'Saved loads' })).toBeVisible()
  }
  const scan = (page: Page) => page.getByRole('dialog', { name: 'Scan box label' })

  // each way of reading in its own test: the print and all three in one test take close to the 30 s test timeout on a loaded runner
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Save writes a file: the origin private file system stands in for the save dialog
      ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () =>
        (await navigator.storage.getDirectory()).getFileHandle('export.json', { create: true })
      window.print = () => {}
      // record ids in order, not at random: the saved load's QR code is the same in every run
      let n = Number(sessionStorage.getItem('e2e-ids') ?? 0)
      crypto.randomUUID = () => {
        sessionStorage.setItem('e2e-ids', String(++n))
        return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
      }
      // the fake camera: a canvas stream of the label image the test hands over, calls counted
      const w = window as unknown as Record<string, unknown>
      w.cameraCalls = 0
      navigator.mediaDevices.getUserMedia = async () => {
        w.cameraCalls = (w.cameraCalls as number) + 1
        const img = new Image()
        img.src = w.labelImage as string
        await img.decode()
        const canvas = document.createElement('canvas')
        canvas.width = 640
        canvas.height = 480
        const g = canvas.getContext('2d')
        if (!g) throw new Error('No canvas for the fake camera.')
        g.fillStyle = '#fff'
        const draw = () => {
          g.fillRect(0, 0, 640, 480)
          g.drawImage(img, 120, 40, 400, 400)
          requestAnimationFrame(draw)
        }
        draw()
        const stream = canvas.captureStream(10)
        w.cameraStream = stream
        return stream
      }
    })
    await page.setViewportSize({ width: 1280, height: 900 })
    await gotoHydrated(page, '/workbench')
    await openSavedLoad(page)
    await (await barButton(page, 'Save')).click()
    await expect(page.locator('.file-state')).toContainText('Saved')
    await openSaved(page)
    await page.getByRole('button', { name: /^Print a box label of / }).click()
    await page.emulateMedia({ media: 'print' })
    printed = {
      image: await page.locator('.box-labels .box-label-code').screenshot(),
      text: await page.locator('.box-labels .box-label-code p').innerText(),
    }
    await page.emulateMedia({ media: 'screen' })
    // a new page ends the print state
    await gotoHydrated(page, '/workbench')
  })

  test('by photo', async ({ page }) => {
    await openSaved(page)
    await page.getByRole('button', { name: 'Scan box label' }).click()
    await expect(scan(page)).toBeVisible()
    expect(
      await page.evaluate(() => (window as unknown as Record<string, unknown>).cameraCalls),
    ).toBe(0)
    await scan(page)
      .locator('input[type="file"]')
      .setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: printed.image })
    await expect(scan(page)).toBeHidden()
  })

  test('by its text', async ({ page }) => {
    // a label of a load this browser lacks: the dialog stays open and says so
    await openSaved(page)
    await page.getByRole('button', { name: 'Scan box label' }).click()
    await scan(page).getByLabel('Label text').fill('OR1:L:00000000-0000-4000-8000-000000000000')
    await page.keyboard.press('Enter')
    await expect(scan(page)).toContainText('This load is not saved in this browser:')
    // the printed text
    await scan(page).getByLabel('Label text').fill(printed.text)
    await page.keyboard.press('Enter')
    await expect(scan(page)).toBeHidden()
  })

  test('by camera, from Ctrl+K', async ({ page }) => {
    await page.evaluate(
      (src) => {
        ;(window as unknown as Record<string, unknown>).labelImage = src
      },
      `data:image/png;base64,${printed.image.toString('base64')}`,
    )
    await page.keyboard.press('Control+k')
    await page.keyboard.type('Scan box label')
    await page.getByRole('button', { name: 'Scan box label', exact: true }).click()
    await expect(scan(page)).toBeVisible()
    await scan(page).getByRole('button', { name: 'Start camera' }).click()
    await expect(scan(page)).toBeHidden()
    expect(
      await page.evaluate(() =>
        ((window as unknown as Record<string, unknown>).cameraStream as MediaStream)
          .getTracks()
          .every((t) => t.readyState === 'ended'),
      ),
    ).toBe(true)
  })
})
