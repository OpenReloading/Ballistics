import { expect, test } from '@playwright/test'
import { exported, gotoHydrated } from './nav.ts'

test('the offline page names the pages kept on this device', async ({ page }) => {
  await gotoHydrated(page, '/offline')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Offline')
  const kept = page.getByRole('navigation', { name: 'Pages kept on this device' })
  await expect(kept.getByRole('link', { name: 'Load workbench' })).toHaveAttribute(
    'href',
    exported('/workbench'),
  )
  await expect(kept.getByRole('link', { name: 'Brass group' })).toHaveAttribute(
    'href',
    exported('/cases/editor'),
  )
})
