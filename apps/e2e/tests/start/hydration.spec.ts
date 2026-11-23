import { expect, test } from '@playwright/test'
import { editions, listen, unexplained, unexplainedMiss } from './console.ts'

type Text = string | { en: string; de: string }

// prerendered pages, then the paths only 404.html answers: a cartridge the sample build leaves out (it keeps all other records) and an unknown path
const pages: { path: string; h1: Text; prerendered: boolean }[] = [
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
    h1: '30 Cal 150 gr Flat Base Demo',
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
  },
  {
    path: 'no-such-page/',
    h1: { en: 'Page not found', de: 'Seite nicht gefunden' },
    prerendered: false,
  },
]

for (const { name, base, prefix } of editions)
  for (const language of ['en', 'de'] as const)
    for (const p of pages)
      test(`${name} /${p.path} ${language}: hydrates without a console message`, async ({
        page,
        browserName,
      }) => {
        await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
          key: `${prefix}language`,
          value: language,
        })
        const messages = listen(page)
        const response = await page.goto(`${base}${p.path}`)
        expect(response?.status()).toBe(p.prerendered ? 200 : 404)
        // the static fallback of 404.html has the same heading: only the booted app sets the marker
        await expect(page.locator('html[data-hydrated]')).toBeAttached()
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          typeof p.h1 === 'string' ? p.h1 : p.h1[language],
        )
        await expect(page.locator('html')).toHaveAttribute('lang', language)
        // the navigation of every page, in this edition's stored language
        const workbench = { en: 'Load workbench', de: 'Werkbank für Laborierungen' }[language]
        // by its name: the not-found page lists the same page
        const navigation = { en: 'Main', de: 'Hauptnavigation' }[language]
        await expect(
          page.getByRole('navigation', { name: navigation }).getByRole('link', { name: workbench }),
        ).toBeVisible()
        await page.waitForLoadState('networkidle')
        // the fallback's title is "Page not found"; the app's titles end in its name
        await expect(page).toHaveTitle(/RangeFoundry Workbench$/)
        // the splat route renders nothing while it hydrates, as the shell holds nothing there, so the unknown path allows no #418
        if (p.prerendered) expect(messages).toEqual([])
        else if (p.path === 'no-such-page/')
          expect(unexplainedMiss(messages, browserName, name)).toEqual([])
        else expect(unexplained(messages, browserName, name)).toEqual([])
      })

for (const { name, base, prefix } of editions) {
  const other = editions.find((e) => e.name !== name)?.prefix ?? ''
  test(`${name}: the other edition's stored language does not win over this one`, async ({
    page,
  }) => {
    // opposite values: the German heading only appears once this edition's own key is applied, so the wait fails when the other key wins
    await page.addInitScript(
      (keys) => {
        localStorage.setItem(keys.own, 'de')
        localStorage.setItem(keys.foreign, 'en')
      },
      { own: `${prefix}language`, foreign: `${other}language` },
    )
    await page.goto(`${base}workbench/`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Werkbank für Laborierungen')
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  })
}

for (const { name, base, prefix } of editions)
  test(`${name}: the stored color scheme applies before any module script`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.addInitScript((key) => localStorage.setItem(key, 'dark'), `${prefix}theme`)
    await page.route('**/*.js', (route) => route.abort())
    await page.goto(`${base}cartridges/308-win/`)
    await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'dark')
  })

test('text typed before hydration stays in the field', async ({ page }) => {
  // the app's scripts wait until the text is typed into the prerendered field
  let release = () => {}
  const typed = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/next/assets/*.js', async (route) => {
    await typed
    await route.continue()
  })
  await page.goto('next/workbench/', { waitUntil: 'commit' })
  const notes = page.getByRole('textbox', { name: 'Notes' })
  // focus and keys, not a click: in WebKit the field is never stable for a click while the scripts are held
  await notes.focus()
  await page.keyboard.type('42 grains')
  await expect(page.locator('html[data-hydrated]')).not.toBeAttached()
  release()
  await expect(page.locator('html[data-hydrated]')).toBeAttached()
  await expect(notes).toHaveValue('42 grains')
  await expect(notes).toBeFocused()
})
