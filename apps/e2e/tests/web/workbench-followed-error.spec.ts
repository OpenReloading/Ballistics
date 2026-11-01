import { expect, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { applyExampleLoad, loadForm } from './workbench.ts'

test.beforeEach(({ page }) => storeUnits(page))

// a reopened load's usable volume follows the seated bullet once the records are back; Run pressed
// while it arrives keeps no "Enter a number" on the field that then holds it (#870)
test('Run pressed while the seated volume arrives leaves no error on the volume', async ({
  page,
}) => {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () =>
      (await navigator.storage.getDirectory()).getFileHandle('export.json', { create: true })
  })
  await gotoHydrated(page, '/workbench')
  await applyExampleLoad(page)
  await (await barButton(page, 'Save')).click()
  await expect(page.locator('.file-state')).toContainText('Saved')

  // the reopened load's cartridge and bullet records are held back, so its volume is not known yet
  let release = () => {}
  const held = new Promise<void>((done) => {
    release = done
  })
  await page.route(/\/api\/(cartridges|bullets)\//, async (route) => {
    await held
    await route.continue()
  })
  await gotoHydrated(page, '/workbench')
  await (await barButton(page, 'Open')).click()
  await page.getByRole('menuitem', { name: /^Saved loads/ }).click()
  await page.locator('.saved-loads li').first().getByRole('button').first().click()
  await expect(page.locator('.file-state')).toContainText('Saved')
  const volume = loadForm(page).getByRole('textbox', { name: /^Usable case volume/ })
  await expect(volume).toHaveValue('')

  // once the bullet record shows, Ctrl+Enter again and again between the page's own tasks until the
  // volume shows: one lands after the seated volume is written and before the page has drawn it
  await page.evaluate(() => {
    const form = document.querySelector('form[aria-label="Load"]') as HTMLFormElement
    const field = (label: string) => {
      const input = [...form.querySelectorAll('input')].find((i) =>
        document.querySelector(`label[for="${i.id}"]`)?.textContent?.startsWith(label),
      )
      if (!input) throw new Error(`no field ${label}`)
      return input
    }
    const box = field('Usable case volume')
    const charge = field('Charge mass')
    const counted = window as unknown as { presses: number }
    counted.presses = 0
    const tasks = new MessageChannel()
    // each refused run draws the page again: a few hundred presses at most until the volume shows
    tasks.port1.onmessage = () => {
      if (box.value !== '' || ++counted.presses > 1000) return
      charge.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }),
      )
      tasks.port2.postMessage(0)
    }
    const seen = new MutationObserver(() => {
      if (!form.querySelector('input[placeholder*="HPBT"]')) return
      seen.disconnect()
      tasks.port2.postMessage(0)
    })
    seen.observe(form, { subtree: true, childList: true, attributes: true })
  })
  release()
  await expect(volume).not.toHaveValue('', { timeout: 15_000 })
  // Run was pressed while the records came in, and the volume came before the presses ran out
  const presses = await page.evaluate(() => (window as unknown as { presses: number }).presses)
  expect(presses).toBeGreaterThan(0)
  expect(presses).toBeLessThanOrEqual(1000)
  await expect(volume).not.toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Enter a number for Usable case volume.')).toHaveCount(0)
})
