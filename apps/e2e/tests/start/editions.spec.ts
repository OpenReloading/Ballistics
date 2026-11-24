import { expect, test } from '@playwright/test'
import { editions, listen, unexplained } from './console.ts'

const site = '/Ballistics/'

for (const { name, base } of editions) {
  test(`${name}: a record the build left out boots from 404.html in its own edition`, async ({
    page,
    browserName,
  }) => {
    const messages = listen(page)
    const requests: string[] = []
    page.on('request', (r) => requests.push(new URL(r.url()).pathname))
    const response = await page.goto(`${base}cartridges/17-hmr/`)
    expect(response?.status()).toBe(404)
    // only the booted app renders the record's name: the fallback and the shell lack it
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('17 HMR')
    await page.waitForLoadState('networkidle')
    expect(requests).toContain(`${site}${base}404.edition.html`)
    expect(requests.filter((p) => !p.startsWith(`${site}${base}`))).toEqual([])
    if (name === 'stable') expect(requests.filter((p) => p.startsWith(`${site}next/`))).toEqual([])
    await expect(page).toHaveTitle(/17 HMR/)
    expect(unexplained(messages, browserName, name)).toEqual([])
  })

  test(`${name}: a miss keeps the static fallback when 404.edition.html is missing`, async ({
    page,
    request,
  }) => {
    // as GitHub Pages answers a missing file: the root 404.html with status 404
    const root = await (await request.get('404.html')).text()
    await page.route('**/404.edition.html', (route) =>
      route.fulfill({ status: 404, contentType: 'text/html', body: root }),
    )
    const fetched: string[] = []
    page.on('request', (r) => {
      if (r.url().endsWith('/404.edition.html')) fetched.push(new URL(r.url()).pathname)
    })
    const response = await page.goto(`${base}no-such-page/`)
    expect(response?.status()).toBe(404)
    await page.waitForLoadState('networkidle')
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toHaveCount(1)
    await expect(heading).toBeVisible()
    await expect(heading).toHaveText('Page not found')
    // a next miss gets its own edition's home: the stable body below the script is inert text
    const home = page.getByRole('link', { name: 'RangeFoundry Workbench' })
    await expect(home).toBeVisible()
    await expect(home).toHaveAttribute('href', `${site}${base}`)
    expect(fetched).toEqual([`${site}${base}404.edition.html`])
  })

  test(`${name}: home has its own prerendered page and a sitemap entry`, async ({ request }) => {
    // the shell takes `/` until TanStack/router#8741 closes: the `/?root` entry writes home
    const home = await request.get(base)
    expect(home.status()).toBe(200)
    expect(await home.text()).toMatch(/<h1[^>]*>RangeFoundry Workbench<\/h1>/)
    const sitemap = await (await request.get(`${base}sitemap.xml`)).text()
    expect(sitemap).toContain(`<loc>https://openreloading.github.io${site}${base}</loc>`)
  })

  test(`${name}: the manifest starts in its own edition and its icons are served as PNG`, async ({
    request,
  }) => {
    const res = await request.get(`${base}manifest.webmanifest`)
    expect(res.status()).toBe(200)
    const manifest: { start_url: string; icons: { src: string }[] } = await res.json()
    expect(manifest.start_url).toBe(`${site}${base}`)
    const srcs = [...manifest.icons.map((icon) => icon.src), `${site}${base}apple-icon.png`]
    expect(srcs).toContain(`${site}${base}icon-192.png`)
    for (const src of srcs) {
      const icon = await request.get(src)
      expect(icon.status(), src).toBe(200)
      expect(icon.headers()['content-type'], src).toBe('image/png')
    }
  })
}
