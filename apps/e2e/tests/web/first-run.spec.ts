import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { safetyAck } from './nav.ts'
import { settingsEntry } from './units.ts'

// a first visit with the Safety notice accepted: the first-run step is next
test.use({
  storageState: {
    cookies: [],
    origins: [
      {
        origin: new URL(process.env.WEB_URL ?? 'http://localhost:3001').origin,
        localStorage: [{ name: 'safety-ack', value: safetyAck }],
      },
    ],
  },
})

const step = (page: import('@playwright/test').Page) =>
  page.getByRole('dialog', { name: 'Start here' })

test('the first-run step shows once, previews the preset and starts from the example', async ({
  page,
}) => {
  await page.goto('/')
  await expect(step(page)).toBeVisible()
  const preview = step(page).getByLabel('The same values in this preset')
  await step(page).getByLabel('Unit preset').selectOption({ label: 'US customary' })
  await expect(preview).toContainText('2625 ft/s')
  await step(page).getByLabel('Unit preset').selectOption({ label: 'Metric (SI)' })
  await expect(preview).toContainText('800 m/s')
  await step(page).getByRole('button', { name: 'Start from the example' }).click()
  await expect(page).toHaveURL(/\/workbench$/)
  await expect(step(page)).toBeHidden()
  // the example load is in the workbench
  await expect(page.getByRole('button', { name: 'Run simulation' }).first()).toBeVisible()
  await page.reload()
  await expect(step(page)).toBeHidden()
})

test('the step is reopened from the Settings and passes axe', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('first-run-done', '1'))
  await page.goto('/')
  await expect(step(page)).toBeHidden()
  await settingsEntry(page).click()
  await page.getByRole('button', { name: 'Show the first-run step' }).click()
  await expect(step(page)).toBeVisible()
  // checks during the transition would read half-transparent colours
  await expect(step(page)).toHaveCSS('opacity', '1')
  const { violations } = await new AxeBuilder({ page }).include('.first-run-dialog').analyze()
  expect(violations).toEqual([])
})

test('with storage blocked the step shows on each visit and raises no error', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError')
    }
    Object.defineProperty(window, 'localStorage', { get: blocked })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'I accept' }).click()
  await expect(step(page)).toBeVisible()
  await step(page).getByRole('button', { name: 'Start empty' }).click()
  await expect(step(page)).toBeHidden()
  expect(errors).toEqual([])
})
