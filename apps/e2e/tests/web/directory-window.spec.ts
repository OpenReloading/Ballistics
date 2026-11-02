import { expect, type Page, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'

// the directory lists render the rows in view: the DOM stays bounded (a11y-sweep.spec.ts sweeps the lists)
const rows = (page: Page) => page.locator('tbody tr[data-row]')

test('scrolled to the end, the cartridge list renders the last row and still a bounded number', async ({
  page,
}) => {
  await gotoHydrated(page, '/cartridges')
  const status = page.locator('.page-bar-status [role="status"]')
  await expect(status).toHaveText(/^\d+ cartridges$/)
  const n = Number((await status.textContent())?.split(' ')[0])
  const first = await rows(page).first().getAttribute('data-id')
  await page.locator('.directory-scroll').evaluate((el) => {
    el.scrollTop = el.scrollHeight
    window.scrollTo(0, document.documentElement.scrollHeight)
  })
  const last = page.locator(`tbody tr[data-row][aria-rowindex="${n + 1}"]`)
  await expect(last).toBeAttached()
  await expect(page.locator(`tbody tr[data-row][data-id="${first}"]`)).toHaveCount(0)
  expect(await rows(page).count()).toBeLessThan(100)
})

test('the records of the browser arriving after a scroll leave the list where it is', async ({
  page,
}) => {
  // the store's reads answer 1.5 s late, after the scroll below; `pending` counts the reads not yet
  // answered, `answered` those answered, so both together tell that the chain of reads is over
  await page.addInitScript(() => {
    const w = window as unknown as { pending: number; answered: number }
    w.pending = 0
    w.answered = 0
    const success = Object.getOwnPropertyDescriptor(IDBRequest.prototype, 'onsuccess')
    Object.defineProperty(IDBRequest.prototype, 'onsuccess', {
      ...success,
      set(handler) {
        if (!handler) return success?.set?.call(this, handler)
        w.pending++
        success?.set?.call(this, (e: Event) =>
          setTimeout(() => {
            handler.call(this, e)
            w.pending--
            w.answered++
          }, 1500),
        )
      },
    })
  })
  await gotoHydrated(page, '/cartridges')
  const box = page.locator('.directory-scroll')
  await box.evaluate((el) => el.scrollTo(0, el.scrollHeight))
  const top = await box.evaluate((el) => el.scrollTop)
  expect(top).toBeGreaterThan(0)
  await page.waitForFunction(() => {
    const w = window as unknown as { pending: number; answered: number }
    return w.answered > 0 && w.pending === 0
  })
  // the rows are rendered with the records in the frame after the last answer
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  )
  expect(await box.evaluate((el) => el.scrollTop)).toBe(top)
})
