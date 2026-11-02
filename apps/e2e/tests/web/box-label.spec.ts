import { expect, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { showGerman } from './german.ts'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { applyExampleLoad } from './workbench.ts'

test.beforeEach(({ page }) => storeUnits(page))

/** The label in each language: German row names are longer, the label must still hold them. */
const languages = [
  { name: 'English', button: /^Print a box label of /, lot: 'Primer lot' },
  { name: 'German', button: /^Schachtel-Etikett von .* drucken$/, lot: 'Zündhütchen-Los' },
]

for (const language of languages)
  test(`a saved load prints its box label of 90 x 60 mm with the QR code on A4 in ${language.name}`, async ({
    page,
  }, testInfo) => {
    // neither dialog can be driven: the file goes to the origin private file system, and the page
    // stays in its print state
    await page.addInitScript(() => {
      ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () =>
        (await navigator.storage.getDirectory()).getFileHandle('export.json', { create: true })
      window.print = () => {}
    })
    await page.setViewportSize({ width: 1280, height: 900 })
    await gotoHydrated(page, '/workbench')
    await applyExampleLoad(page)
    // every lot typed: the tallest label
    for (const [lot, text] of [
      ['Powder lot', 'P-2026-0412-A'],
      ['Primer lot', 'Z-778341'],
      ['Case lot', 'H-19-2203'],
    ])
      await page.getByLabel(lot, { exact: true }).first().fill(text)
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

test('a printed box label opens its load by photo, by camera and by its text', async ({ page }) => {
  await page.addInitScript(() => {
    // Save writes a file: the origin private file system stands in for the save dialog
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () =>
      (await navigator.storage.getDirectory()).getFileHandle('export.json', { create: true })
    window.print = () => {}
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
  await applyExampleLoad(page)
  await (await barButton(page, 'Save')).click()
  await expect(page.locator('.file-state')).toContainText('Saved')
  const openSaved = async () => {
    await (await barButton(page, 'Open')).click()
    await page.getByRole('menuitem', { name: /^Saved loads/ }).click()
    await expect(page.getByRole('dialog', { name: 'Saved loads' })).toBeVisible()
  }

  // the printed label as an image
  await openSaved()
  await page.getByRole('button', { name: /^Print a box label of / }).click()
  await page.emulateMedia({ media: 'print' })
  const image = await page.locator('.box-labels .box-label-code').screenshot()
  const text = await page.locator('.box-labels .box-label-code p').innerText()
  await page.emulateMedia({ media: 'screen' })
  // a new page ends the print state
  await gotoHydrated(page, '/workbench')

  const scan = page.getByRole('dialog', { name: 'Scan box label' })
  // photo
  await openSaved()
  await page.getByRole('button', { name: 'Scan box label' }).click()
  await expect(scan).toBeVisible()
  expect(
    await page.evaluate(() => (window as unknown as Record<string, unknown>).cameraCalls),
  ).toBe(0)
  await scan
    .locator('input[type="file"]')
    .setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: image })
  await expect(scan).toBeHidden()

  // a label of a load this browser lacks: the dialog stays open and says so
  await openSaved()
  await page.getByRole('button', { name: 'Scan box label' }).click()
  await scan.getByLabel('Label text').fill('OR1:L:00000000-0000-4000-8000-000000000000')
  await page.keyboard.press('Enter')
  await expect(scan).toContainText('This load is not saved in this browser and edition:')
  // the printed text
  await scan.getByLabel('Label text').fill(text)
  await page.keyboard.press('Enter')
  await expect(scan).toBeHidden()

  // camera, from Ctrl+K
  await page.evaluate(
    (src) => {
      ;(window as unknown as Record<string, unknown>).labelImage = src
    },
    `data:image/png;base64,${image.toString('base64')}`,
  )
  await page.keyboard.press('Control+k')
  await page.keyboard.type('Scan box label')
  await page.getByRole('button', { name: 'Scan box label', exact: true }).click()
  await expect(scan).toBeVisible()
  await scan.getByRole('button', { name: 'Start camera' }).click()
  await expect(scan).toBeHidden()
  expect(
    await page.evaluate(() =>
      ((window as unknown as Record<string, unknown>).cameraStream as MediaStream)
        .getTracks()
        .every((t) => t.readyState === 'ended'),
    ),
  ).toBe(true)
})
