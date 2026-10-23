import { expect, type Page, test } from '@playwright/test'

/** Two firearms in the browser store, as the library saves them. */
async function seed(page: Page, names: string[]) {
  await page.evaluate(async (names) => {
    const db: IDBDatabase = await new Promise((ok, no) => {
      const r = indexedDB.open('openreloading-user-data', 1)
      r.onupgradeneeded = () => {
        for (const n of ['records', 'handles', 'files'])
          if (!r.result.objectStoreNames.contains(n))
            r.result.createObjectStore(n, n === 'records' ? { keyPath: 'id' } : undefined)
      }
      r.onsuccess = () => ok(r.result)
      r.onerror = () => no(r.error)
    })
    const tx = db.transaction('records', 'readwrite')
    names.forEach((name, i) => {
      tx.objectStore('records').put({
        kind: 'firearm',
        id: `firearm-${i}`,
        name,
        saved: '2026-10-20T00:00:00.000Z',
        data: {
          name,
          cartridge: '308-win',
          barrelLength: 0.61,
          twist: 0.254,
          twistHand: 'right',
          optics: [],
          configurations: [],
        },
      })
    })
    await new Promise((ok) => {
      tx.oncomplete = ok
    })
    db.close()
  }, names)
}

const status = (page: Page) => page.locator('.page-bar-status .bar-count')

test('the firearm library searches its table, counts the example and offers to clear a search without a match', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('safety-ack', '3')
    localStorage.setItem('first-run-done', '1')
  })
  await page.goto('/firearms')
  await seed(page, ['Bench rifle', 'Hunting rifle'])
  await page.reload()
  await expect(status(page)).toHaveText('3 firearms')
  // the browser's firearms first, the example load's rifle last
  await expect(page.locator('tbody tr[data-row]').last()).toContainText(
    'Example rifle, 308 Win. Example',
  )
  const search = page.getByRole('searchbox', { name: 'Search' })
  await search.fill('bench')
  await expect(status(page)).toHaveText('1 of 3 firearms')
  await expect(page).toHaveURL(/[?&]q=bench/)
  await expect(page.getByRole('link', { name: 'Bench rifle', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Hunting rifle', exact: true })).toHaveCount(0)
  await search.fill('zzz')
  await expect(page.getByText('No firearms match these filters.')).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).last().click()
  await expect(status(page)).toHaveText('3 firearms')
  // the example is the OpenReloading source, the browser's firearms are Mine
  await page.getByRole('button', { name: /^Source: / }).click()
  await page
    .getByRole('dialog', { name: /^Source: / })
    .getByRole('checkbox', { name: /^OpenReloading/ })
    .uncheck()
  await expect(status(page)).toHaveText('2 of 3 firearms')
  await expect(page).toHaveURL(/[?&]src=user/)
  await page.keyboard.press('Escape')
  await search.fill('example')
  await expect(page.getByText('Mine only, matching "example".', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).last().click()
  await expect(status(page)).toHaveText('3 firearms')
  // a row's link opens the firearm in the editor beside the cards
  await page.getByRole('link', { name: 'Bench rifle', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Bench rifle', level: 2 })).toBeVisible()
  await expect(page.locator('.library-list li')).toHaveCount(3)
  // the example opens read-only; Copy to edit starts an editable copy
  await page
    .locator('.library-list')
    .getByRole('button', { name: 'Example rifle, 308 Win.', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Example rifle, 308 Win.', level: 2 }),
  ).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Copy to edit' }).click()
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue(
    'Example rifle, 308 Win. copy',
  )
})
