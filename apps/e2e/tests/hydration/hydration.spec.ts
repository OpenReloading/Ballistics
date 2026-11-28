import { expect, test } from '@playwright/test'
import { listen, unexplained } from './console.ts'

type Text = string | { en: string; de: string }

// prerendered pages, then the paths only 404.html answers: a cartridge the sample build leaves out (it keeps all other records) and an unknown path
const pages: { path: string; h1: Text; prerendered: boolean; record?: 'sample' }[] = [
  { path: '', h1: 'RangeFoundry Workbench', prerendered: true },
  {
    path: 'workbench/',
    h1: { en: 'Load workbench', de: 'Werkbank für Laborierungen' },
    prerendered: true,
  },
  {
    path: 'session/',
    h1: { en: 'Session summary', de: 'Sitzungsübersicht' },
    prerendered: true,
  },
  { path: 'cartridges/308-win/', h1: '308 Win.', prerendered: true },
  {
    path: 'bullets/demo-bullet-150/',
    h1: 'Demo Bullets 30 Cal 150 gr Flat Base Demo',
    prerendered: true,
  },
  {
    path: 'disciplines/dsb-25m-pistole-revolver/',
    h1: '25 m Pistole/Revolver',
    prerendered: true,
  },
  {
    path: 'cartridges/17-hmr/',
    h1: '17 HMR',
    prerendered: false,
    record: 'sample',
  },
  {
    path: 'no-such-page/',
    h1: { en: 'Page not found', de: 'Seite nicht gefunden' },
    prerendered: false,
  },
]

for (const language of ['en', 'de'] as const)
  for (const p of pages)
    test(`/${p.path} ${language}: hydrates without a console message`, async ({ page }) => {
      // a full build prerenders every record: only the sample leaves this one to 404.html
      test.skip(p.record === 'sample' && process.env.PRERENDER !== 'sample', 'a full build')
      await page.addInitScript((value) => localStorage.setItem('language', value), language)
      const messages = listen(page)
      const response = await page.goto(p.path)
      expect(response?.status()).toBe(p.prerendered ? 200 : 404)
      // the static fallback of 404.html has the same heading: only the booted app sets the marker
      await expect(page.locator('html[data-hydrated]')).toBeAttached()
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        typeof p.h1 === 'string' ? p.h1 : p.h1[language],
      )
      await expect(page.locator('html')).toHaveAttribute('lang', language)
      // the navigation of every page, in the stored language
      const workbench = { en: 'Load workbench', de: 'Werkbank für Laborierungen' }[language]
      // by its name: the not-found page lists the same page
      const navigation = { en: 'Main', de: 'Hauptnavigation' }[language]
      await expect(
        page.getByRole('navigation', { name: navigation }).getByRole('link', { name: workbench }),
      ).toBeVisible()
      await page.waitForLoadState('networkidle')
      // the fallback's title is "Page not found"; the app's titles end in its name
      await expect(page).toHaveTitle(/RangeFoundry Workbench$/)
      // the splat route hydrates the shell's empty boundary as an empty boundary, so the unknown path allows no #418
      if (p.prerendered || p.path === 'no-such-page/') expect(messages).toEqual([])
      else expect(unexplained(messages)).toEqual([])
    })

test('the stored color scheme applies before any module script', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  await page.route('**/*.js', (route) => route.abort())
  await page.goto('cartridges/308-win/')
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'dark')
})

test('text typed before hydration stays in the field', async ({ page }) => {
  // the app's scripts wait until the text is typed into the prerendered field
  let release = () => {}
  const typed = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/assets/*.js', async (route) => {
    await typed
    await route.continue()
  })
  await page.goto('workbench/', { waitUntil: 'commit' })
  // a new load shows the start card, whose one text field is the cartridge search
  const search = page.getByLabel('Search cartridges by name', { exact: true })
  // focus and keys, not a click: in WebKit the field is never stable for a click while the scripts are held
  await search.focus()
  await page.keyboard.type('308')
  await expect(page.locator('html[data-hydrated]')).not.toBeAttached()
  release()
  await expect(page.locator('html[data-hydrated]')).toBeAttached()
  await expect(search).toHaveValue('308')
  await expect(search).toBeFocused()
})
