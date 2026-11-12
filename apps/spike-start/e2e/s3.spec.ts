import { expect, type Page, test } from '@playwright/test'

// S3 (TanStack/router#8473) under the /next/ base: the page as the HTML shows it before any script runs, then after
// hydration. Prerendered pages must not change; the shell paths show what the defect does where it fires.
const cases = [
  { path: '/next/cartridges/308-win/', prerendered: true, type: false, language: 'en' },
  { path: '/next/workbench/', prerendered: true, type: true, language: 'en' },
  { path: '/next/workbench/', prerendered: true, type: true, language: 'de' },
  { path: '/next/cartridges/10-3-capra/', prerendered: false, type: false, language: 'en' },
  { path: '/next/no-such-page/', prerendered: false, type: false, language: 'en' },
]

/** Pixels that differ between two PNG screenshots, counted in a blank page. */
async function differingPixels(page: Page, a: Buffer, b: Buffer) {
  await page.goto('about:blank')
  return page.evaluate(
    async ([x, y]) => {
      const load = async (s: string) =>
        createImageBitmap(await (await fetch(`data:image/png;base64,${s}`)).blob())
      const [p, q] = [await load(x), await load(y)]
      if (p.width !== q.width || p.height !== q.height) return -1
      const pixels = (img: ImageBitmap) => {
        const c = new OffscreenCanvas(img.width, img.height).getContext('2d')
        c?.drawImage(img, 0, 0)
        return c?.getImageData(0, 0, img.width, img.height).data ?? new Uint8ClampedArray()
      }
      const [d, e] = [pixels(p), pixels(q)]
      let n = 0
      for (let i = 0; i < d.length; i += 4)
        if (d[i] !== e[i] || d[i + 1] !== e[i + 1] || d[i + 2] !== e[i + 2]) n++
      return n
    },
    [a.toString('base64'), b.toString('base64')],
  )
}

for (const c of cases)
  test(`S3 ${c.path} ${c.language}`, async ({ page, browserName }, info) => {
    test.skip(
      browserName === 'webkit',
      'WebKit renders no frame while the entry module loads: S3 webkit spec below',
    )
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 60)))
    if (c.language !== 'en')
      await page.addInitScript((l) => {
        if (location.protocol === 'http:') localStorage.setItem('next:language', l)
      }, c.language)
    let release = () => {}
    const gate = new Promise<void>((r) => {
      release = r
    })
    // the module scripts wait until the page as prerendered has been measured and typed into
    await page.route('**/next/assets/*.js', async (route) => {
      await gate
      await route.continue()
    })
    await page.goto(c.path, { waitUntil: 'commit' })
    await expect(page.locator('header')).toBeVisible()
    // WebKit never settles document.fonts.ready while the scripts are held
    await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loaded')
    await page.evaluate(() => {
      const probe = {
        h1: document.querySelector('h1'),
        header: document.querySelector('header'),
        removed: 0,
        framesWithoutHeader: 0,
        framesWithoutH1: 0,
        frames: 0,
        shift: 0,
        sources: [] as string[],
      }
      Object.assign(window, { probe })
      new MutationObserver((list) => {
        for (const m of list) for (const n of m.removedNodes) if (n.nodeType === 1) probe.removed++
      }).observe(document, { childList: true, subtree: true })
      if (PerformanceObserver.supportedEntryTypes.includes('layout-shift'))
        new PerformanceObserver((l) => {
          for (const e of l.getEntries() as unknown as {
            value: number
            sources: { node?: Node; previousRect: DOMRect; currentRect: DOMRect }[]
          }[]) {
            probe.shift += e.value
            for (const x of e.sources)
              probe.sources.push(
                `${x.node?.nodeName} ${JSON.stringify(x.previousRect)} -> ${JSON.stringify(x.currentRect)}`,
              )
          }
        }).observe({ type: 'layout-shift' })
      const frame = () => {
        probe.frames++
        if (!document.querySelector('header')) probe.framesWithoutHeader++
        if (probe.h1 && !document.querySelector('h1')) probe.framesWithoutH1++
        if (!document.documentElement.dataset.hydrated) requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
    })
    const typed = { cartridge: '308 Win.', charge: '42,5' }
    if (c.type) {
      await page.getByTestId('cartridge').click()
      await page.keyboard.type(typed.cartridge)
      await page.keyboard.press('Tab')
      await page.keyboard.type(typed.charge)
    }
    const rects = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('h1, input, textarea, main, header')].map((e) => {
          const r = e.getBoundingClientRect()
          return `${e.tagName} ${r.x},${r.y},${r.width},${r.height}`
        }),
      )
    // shell paths: the menu link holds the focus before hydration, as a reader tabbing into the page would leave it
    if (!c.prerendered) {
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
    }
    const focusedBefore = await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 40))
    const before = { rects: await rects(), shot: await page.screenshot({ animations: 'disabled' }) }
    // shifts before this point are the prerendered page settling (fonts, table columns), not hydration
    await page.evaluate(() => {
      const p = (window as unknown as { probe: { shift: number; sources: string[] } }).probe
      p.shift = 0
      p.sources = []
    })
    release()
    await expect(page.locator('html[data-hydrated]')).toBeAttached()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    const probe = await page.evaluate(() => {
      const p = (
        window as unknown as { probe: Record<string, unknown> & { h1: Element; header: Element } }
      ).probe
      return {
        sameH1: p.h1 === null ? 'none before' : p.h1 === document.querySelector('h1'),
        sameHeader: p.header === document.querySelector('header'),
        removed: p.removed,
        frames: p.frames,
        framesWithoutHeader: p.framesWithoutHeader,
        framesWithoutH1: p.framesWithoutH1,
        layoutShift: PerformanceObserver.supportedEntryTypes.includes('layout-shift')
          ? p.shift
          : 'not supported',
        shiftSources: p.sources,
        focus:
          document.activeElement?.getAttribute('data-testid') ??
          document.activeElement?.outerHTML.slice(0, 40),
        values: [...document.querySelectorAll('input')].map((i) => i.value),
      }
    })
    const after = { rects: await rects(), shot: await page.screenshot({ animations: 'disabled' }) }
    const diff = await differingPixels(page, before.shot, after.shot)
    const result = {
      browserName,
      focusedBefore,
      ...probe,
      rectsEqual: JSON.stringify(before.rects) === JSON.stringify(after.rects),
      diff,
      errors,
    }
    info.annotations.push({ type: 's3', description: JSON.stringify(result) })
    await info.attach('before', { body: before.shot, contentType: 'image/png' })
    await info.attach('after', { body: after.shot, contentType: 'image/png' })
    if (!c.prerendered) return
    if (c.type) {
      expect(probe.values).toEqual([typed.cartridge, typed.charge])
      expect(probe.focus).toBe('charge')
    }
    expect(probe.sameH1).toBe(true)
    expect(probe.sameHeader).toBe(true)
    expect(probe.framesWithoutH1).toBe(0)
    if (c.language === 'en') {
      expect(result.rectsEqual).toBe(true)
      expect(diff).toBe(0)
      if (typeof probe.layoutShift === 'number') expect(probe.layoutShift).toBe(0)
    }
    expect(errors).toEqual([])
  })

// WebKit draws its first frame only once the entry module has loaded (measured: first frame 3,024 to 3,054 ms with
// the entry held 3,000 ms on the server), so nothing can be seen or typed before hydration; this measures what the
// first frame shows against the hydrated page.
for (const c of cases)
  test(`S3 webkit ${c.path} ${c.language}`, async ({ page, browserName }, info) => {
    test.skip(browserName !== 'webkit')
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 60)))
    await page.addInitScript((l) => {
      if (location.protocol === 'http:') localStorage.setItem('next:language', l)
      const probe = {
        first: '',
        h1: null as Element | null,
        header: null as Element | null,
        removed: 0,
        frames: 0,
        framesWithoutH1: 0,
        before: 0,
      }
      Object.assign(window, { probe })
      const rects = () =>
        [...document.querySelectorAll('h1, input, textarea, main, header')]
          .map((e) => {
            const r = e.getBoundingClientRect()
            return `${e.tagName} ${r.x},${r.y},${r.width},${r.height}`
          })
          .join('|')
      const frame = () => {
        probe.frames++
        const hydrated = !!document.documentElement.dataset.hydrated
        if (probe.frames === 1) {
          Object.assign(probe, {
            first: rects(),
            h1: document.querySelector('h1'),
            header: document.querySelector('header'),
          })
          new MutationObserver((list) => {
            for (const m of list)
              for (const n of m.removedNodes) if (n.nodeType === 1) probe.removed++
          }).observe(document, { childList: true, subtree: true })
        }
        if (!hydrated) probe.before++
        if (probe.h1 && !document.querySelector('h1')) probe.framesWithoutH1++
        if (!hydrated || probe.frames < 5) requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
      Object.assign(window, { rects })
    }, c.language)
    const response = await page.goto(c.path)
    expect(response?.status()).toBe(c.prerendered ? 200 : 404)
    await expect(page.locator('html[data-hydrated]')).toBeAttached()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    const result = await page.evaluate(() => {
      const w = window as unknown as {
        probe: {
          first: string
          h1: Element | null
          header: Element | null
          removed: number
          frames: number
          framesWithoutH1: number
          before: number
        }
        rects: () => string
      }
      const p = w.probe
      return {
        framesBeforeHydration: p.before,
        sameH1: p.h1 === null ? 'none in first frame' : p.h1 === document.querySelector('h1'),
        sameHeader: p.header === document.querySelector('header'),
        removed: p.removed,
        framesWithoutH1: p.framesWithoutH1,
        rectsEqual: p.first === w.rects(),
      }
    })
    info.annotations.push({
      type: 's3',
      description: JSON.stringify({ browserName, ...result, errors }),
    })
    if (!c.prerendered) return
    expect(result.sameH1).toBe(true)
    expect(result.sameHeader).toBe(true)
    expect(result.framesWithoutH1).toBe(0)
    if (c.language === 'en') expect(result.rectsEqual).toBe(true)
    expect(errors).toEqual([])
  })
