import { expect, test } from '@playwright/test'

const text = 'Alpha version: breaking changes are to be expected.'

test('a tooltip stays open while the pointer moves onto it, Escape and leaving close it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/session')
  const brand = page.locator('.mantine-AppShell-header .brand')
  const note = page.getByRole('tooltip', { name: text })

  await brand.hover()
  await expect(note).toBeVisible()
  const box = await note.boundingBox()
  if (!box) throw new Error('the open tooltip has no box')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 })
  await page.waitForTimeout(500)
  await expect(note).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(note).toBeHidden()

  await brand.hover()
  await expect(note).toBeVisible()
  await page.mouse.move(640, 600, { steps: 10 })
  await expect(note).toBeHidden()

  // the skip link comes first, then the home link
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(brand).toBeFocused()
  await expect(note).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(note).toBeHidden()
})
