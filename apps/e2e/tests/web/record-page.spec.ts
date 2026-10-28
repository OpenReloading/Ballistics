import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'

/**
 * A record page of every kind renders in the browser from its data file: the exported file holds the
 * head tags and a loading state. One record of each kind, all in the export's sample.
 */
const records: {
  route: string
  data: string
  id: string
  name: string
  title: string
  description: string
  /** What the browser draws from the data files, for a kind that has a drawing. */
  drawn?: string
}[] = [
  {
    route: 'cartridges',
    data: 'cartridges',
    id: '308-win',
    name: '308 Win.',
    title: '308 Win. dimensions and pressures',
    description: 'CIP dimensions and maximum pressures of 308 Win., with sources.',
    drawn: 'main figure.drawing-figure',
  },
  {
    route: 'bullets',
    data: 'bullets',
    id: 'demo-bullet-168',
    name: 'Demo Bullets 30 Cal 168 gr HPBT Demo',
    title: 'Demo Bullets 30 Cal 168 gr HPBT Demo',
    description:
      'Drawing, diameter, mass and ballistic coefficients of the Demo Bullets 30 Cal 168 gr HPBT Demo, with sources.',
    drawn: 'main figure.drawing-figure',
  },
  {
    route: 'powders',
    data: 'powders',
    id: 'demo-powder-dp40',
    name: 'Demo Powder Co. DP40',
    title: 'Demo Powder Co. DP40',
    description: 'Recorded properties of Demo Powder Co. DP40, with sources.',
  },
  {
    route: 'cases',
    data: 'cases',
    id: 'demo-case-308-brass',
    name: 'Demo Cases 308 Win. Brass Demo',
    title: 'Demo Cases 308 Win. Brass Demo',
    description: 'Recorded properties of the case Demo Cases 308 Win. Brass Demo, with sources.',
  },
  {
    route: 'primers',
    data: 'primers',
    id: 'demo-primer-large-rifle',
    name: 'Demo Primers Large Rifle Demo',
    title: 'Demo Primers Large Rifle Demo',
    description: 'Recorded properties of the primer Demo Primers Large Rifle Demo, with sources.',
  },
  {
    route: 'targets',
    data: 'target-faces',
    id: 'issf-25m-precision-50m-pistol',
    name: '25m Precision and 50m Pistol Target',
    title: '25m Precision and 50m Pistol Target',
    description:
      'Ring diameters, black area and the disciplines shot on 25m Precision and 50m Pistol Target, with sources.',
    drawn: 'main svg.target-face-drawing',
  },
  {
    route: 'disciplines',
    data: 'disciplines',
    id: 'dsb-25m-pistole-revolver',
    name: '25 m Pistole/Revolver',
    title: '25 m Pistole/Revolver',
    description:
      'Distance, caliber classes and the target faces of 25 m Pistole/Revolver, with its rule book.',
    drawn: 'main svg.target-face-drawing',
  },
  {
    route: 'federations',
    data: 'federations',
    id: 'dsb',
    name: 'Deutscher Schützenbund e.V.',
    title: 'Deutscher Schützenbund e.V.',
    description:
      'The rule books of Deutscher Schützenbund e.V., its disciplines and the target faces they use.',
    drawn: 'main svg.target-face-drawing',
  },
]

/** The Sources panel every record page has: there once the record is read and drawn. */
const loaded = (page: Page) => page.getByRole('heading', { level: 2, name: /^Sources/ })

/** The record page once its data files are read: its panels and, where it has one, its drawing. */
async function expectLoaded(page: Page, r: (typeof records)[number]) {
  await expect(loaded(page)).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: r.name })).toBeVisible()
  if (r.drawn) await expect(page.locator(r.drawn).first()).toBeVisible()
}

for (const r of records) {
  const path = `/${r.route}/${r.id}/`
  const file = `/api/${r.data}/${r.id}.json`

  test.describe(r.route, () => {
    test("the exported file carries the record's own head tags and nothing of its content", async ({
      request,
    }) => {
      const html = await (await request.get(path)).text()
      const head = html.slice(0, html.indexOf('</head>'))
      expect(head).toContain(`<title>${r.title}`)
      for (const tag of [
        `<meta name="description" content="${r.description}"/>`,
        `<meta property="og:title" content="${r.title}"/>`,
        `<meta property="og:description" content="${r.description}"/>`,
        `<meta name="twitter:title" content="${r.title}"/>`,
        `<meta name="twitter:description" content="${r.description}"/>`,
      ])
        expect(head).toContain(tag)
      expect(html).toContain('<h1')
      expect(html).not.toContain('id="record-sources"')
    })

    for (const colorScheme of ['light', 'dark'] as const)
      test(`the loaded page has no axe violation, ${colorScheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme })
        await gotoHydrated(page, path)
        await expectLoaded(page, r)
        const { violations } = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze()
        expect(
          violations.map(
            (v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} ${n.html}`).join(', ')}`,
          ),
        ).toEqual([])
      })

    test('a record whose data file is gone shows the not-found message', async ({ page }) => {
      await page.route(`**${file}`, (route) => route.fulfill({ status: 404 }))
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
      await expect(page.getByText('Nothing at this address')).toBeVisible()
      await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(1)
    })

    test('an unknown record id answers the not-found page of the site', async ({ page }) => {
      const response = await page.goto(`/${r.route}/no-such-record/`)
      expect(response?.status()).toBe(404)
      await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    })

    test.describe('offline', () => {
      test.use({ serviceWorkers: 'allow' })

      test('a visited record opens again offline, drawn from its stored data files', async ({
        page,
        context,
      }) => {
        // every data file the page reads besides the catalogue index, which the worker precaches
        const read = new Set<string>()
        page.on('request', (req) => {
          const { pathname } = new URL(req.url())
          if (pathname.includes('/api/') && !pathname.includes('/catalogue/')) read.add(pathname)
        })
        await gotoHydrated(page, path)
        await expectLoaded(page, r)
        expect(read).toContain(file)
        // the page and the worker store the page and its data files of the first visit
        await page.evaluate(() => navigator.serviceWorker.ready)
        await expect
          .poll(() =>
            page.evaluate(
              async ([html, files]) => {
                const found = await Promise.all([html, ...files].map((u) => caches.match(u)))
                return found.every(Boolean)
              },
              [path, [...read]] as const,
            ),
          )
          .toBe(true)
        await context.setOffline(true)
        await page.reload()
        await expectLoaded(page, r)
        await context.setOffline(false)
      })
    })
  })
}
