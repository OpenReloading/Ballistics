import { expect, type Page, test } from '@playwright/test'

const editions = [
  { base: '/', prefix: '' },
  { base: '/next/', prefix: 'next:' },
]
// prerendered pages, then paths only 404.html answers: a record the build left out and an unknown path
const pages = [
  { path: '', h1: { en: 'Ballistics', de: 'Ballistik' }, prerendered: true },
  { path: 'cartridges/308-win/', h1: '308 Win.', prerendered: true },
  { path: 'bullets/demo-bullet-150/', h1: '30 Cal 150 gr Flat Base Demo', prerendered: true },
  { path: 'disciplines/bdmp-1500-carbine/', h1: 'BDMP 1500 Carbine', prerendered: true },
  { path: 'workbench/', h1: { en: 'Load workbench', de: 'Ladebank' }, prerendered: true },
  { path: 'cartridges/10-3-capra/', h1: '10,3 Capra', prerendered: false },
  {
    path: 'no-such-page/',
    h1: { en: 'There is no such record.', de: 'Diesen Datensatz gibt es nicht.' },
    prerendered: false,
  },
]

/** Console errors and warnings and uncaught errors of the page, from before its first script. */
function listen(page: Page) {
  const messages: string[] = []
  page.on('console', (m) => {
    // the browsers log the document's own 404, which GitHub Pages sends for every non-prerendered path;
    // that the document is the only 4xx response is checked through `failed`
    if (m.text().includes('status of 404')) return
    if (m.type() === 'error' || m.type() === 'warning') messages.push(`${m.type()}: ${m.text()}`)
  })
  page.on('response', (r) => {
    if (r.status() >= 400 && r.request().resourceType() !== 'document')
      messages.push(`failed: ${r.status()} ${r.url()}`)
  })
  page.on('pageerror', (e) => messages.push(`pageerror: ${e.message}`))
  return messages
}

for (const { base, prefix } of editions)
  for (const language of ['en', 'de'] as const)
    for (const p of pages)
      test(`S1 ${base}${p.path} ${language}`, async ({ page }, info) => {
        await page.addInitScript(
          ([key, value]) => localStorage.setItem(key, value),
          [`${prefix}language`, language],
        )
        const messages = listen(page)
        const response = await page.goto(`${base}${p.path}`)
        expect(response?.status()).toBe(p.prerendered ? 200 : 404)
        await expect(page.locator('html[data-hydrated]')).toBeAttached()
        const h1 = typeof p.h1 === 'string' ? p.h1 : p.h1[language]
        await expect(page.locator('h1')).toHaveText(h1)
        await expect(page.locator('html')).toHaveAttribute('lang', language)
        await page.waitForLoadState('networkidle')
        info.annotations.push({ type: 'console', description: JSON.stringify(messages) })
        // React's minified #418 is the S3 signature (TanStack/router#8473); anything else fails
        const other = messages.filter((m) => !m.includes('#418'))
        expect(other).toEqual([])
        if (p.prerendered) expect(messages).toEqual([])
      })

for (const { base, prefix } of editions)
  test(`S1 color scheme before first paint ${base}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    // no module script runs: only the inline color-scheme script of the head
    await page.route('**/*.js', (route) => route.abort())
    await page.goto(`${base}cartridges/308-win/`)
    await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'dark')
    const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    // the stored choice of this edition wins over the system; the other edition's key is not read
    await page.evaluate(
      ([key]) => localStorage.setItem(key, 'light'),
      [`${prefix}mantine-color-scheme-value`],
    )
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'light')
    const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(light).not.toBe(dark)
    const other = editions.find((e) => e.base !== base)
    await page.goto(`${other?.base}cartridges/308-win/`)
    await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'dark')
  })
