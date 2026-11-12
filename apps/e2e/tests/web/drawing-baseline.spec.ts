import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { recordFigures } from '../../../../packages/svg-drawings/src/cartridge/figures.ts'
import type { SpecValue } from '../../../../packages/svg-drawings/src/core/types.ts'
import { gotoHydrated } from './nav.ts'

// the pixels depend on the fonts: this runs only in the Playwright image of the installed version, in CI and locally (pnpm run drawing-baseline); DRAWING_BASELINE=full shoots the full set on demand (pnpm run drawing-baseline:full)
test.skip(!process.env.DRAWING_BASELINE, 'runs in the Playwright image: pnpm run drawing-baseline')
const full = process.env.DRAWING_BASELINE === 'full'

/** The default baseline: the most common cartridge of each drawing case, then a record for a geometry they do not draw, a shotshell in one variant; Vitest compares the SVG markup of every sample and verified figure (apps/web/test/drawing-markup.test.tsx), these pixels what only a browser draws: fonts, CSS and the figure's scaling. */
const common: { id: string; variant?: string }[] = [
  // I: rimless rifle; also dark and at 1280 px, and the style test below
  { id: 'cip-308-win-2008-09-23' },
  // I: steep shoulder (60 degrees)
  { id: 'cip-6-5-creedmoor-2020-04-21' },
  // I: rebated rim
  { id: 'cip-284-win-2005-05-25' },
  // I: semi-rimmed
  { id: 'cip-220-swift-2008-09-23' },
  // II: rimmed rifle
  { id: 'cip-30-30-win-2002-05-15' },
  // II: rimmed, double taper, rim fillet r0
  { id: 'cip-8-x-51-r-lebel-2015-05-19' },
  // III: belted magnum
  { id: 'cip-300-win-mag-2002-05-15' },
  // III: double-radius shoulder fillets
  { id: 'cip-300-weath-mag-2002-05-15' },
  // IV: straight-wall pistol
  { id: 'cip-9-mm-luger-2008-09-23' },
  // V: rimfire
  { id: 'cip-22-long-rifle-2024-05-14' },
  // VII: shotshell
  { id: 'cip-12-2018-10-17', variant: '12/70' },
]

/** The full baseline adds every drawn table, the extremes, the notes the audit checks and every verified record. */
const samples = [
  // I: rimless, rebated (headBelowP1), mouthStep, both
  'cip-308-win-2008-09-23',
  'cip-458-socom-2021-11-09',
  'cip-400-legend-2023-11-08',
  'cip-9-x-39-2018-05-16',
  // II: rimmed, shoulderPartial, double taper, chamber only (cartridge without R1), the widest
  'cip-30-30-win-2002-05-15',
  'cip-6-5-x-58-r-2002-05-15',
  'cip-8-x-51-r-lebel-2015-05-19',
  'cip-7-x-67-r-luyven-2006-05-16',
  // III: belted, with double-radius shoulder fillets
  'cip-308-norma-mag-2016-10-18',
  'cip-300-weath-mag-2002-05-15',
  // IV: pistol, grooveDerivedE, shoulderOrder with a closed front
  'cip-9-mm-luger-2008-09-23',
  'cip-454-casull-2015-05-19',
  'cip-7-62-nagant-2000-06-07',
  // V: rimfire, the tallest, closedFront (chamber only), the 22 BB Cap rim with its data conflict
  'cip-22-long-rifle-2024-05-14',
  'cip-6mm-me-flobert-court-2006-05-24',
  'cip-22-long-shot-2000-06-07',
  'cip-22-bb-cap-2000-06-07',
  // VII shotshell with its cone, IX
  'cip-9-c-f-mori-2006-09-19',
  'cip-35-r-gr-1994-03-01',
]

type View = [number, 'light' | 'dark']
type Spec = {
  id: string
  cartridge: string
  standard: string
  table?: string
  verification?: string
  values: SpecValue[]
}
const dir = path.join(__dirname, '../../../../packages/catalog/records/cartridges')
/** The record in `file` with the id of its C.I.P. sheet, `cip-<cartridge id>-<revised or published date>`, which figure ids and shot names carry. */
const readFile = (file: string) => {
  const c = JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as Spec & {
    published: string
    revised?: string
  }
  return { ...c, id: `cip-${c.id}-${c.revised ?? c.published}`, cartridge: c.id, standard: 'CIP' }
}
const read = (id: string) =>
  readFile(`${id.replace(/^cip-/, '').replace(/-\d{4}-\d{2}-\d{2}$/, '')}.json`)

/** Page, SVG id and name of every drawn side (of one variant if given) in the given views; a figure with both sides drawn is two SVGs, `<figure id>-<side>`, and the record page shows both. */
const shotsOf = (r: Spec, views: View[], variant?: string) =>
  recordFigures(r)
    .filter((f) => variant === undefined || f.variant === variant)
    .flatMap((f) =>
      f.drawn.map(({ side }) => ({
        spec: r.id,
        cartridge: r.cartridge,
        svg: f.drawn.length > 1 ? `${f.id}-${side}` : f.id,
        // a shotshell shows one variant at a time: the test picks it
        variant: f.variant,
        name: `${r.id}${f.id.slice(`${r.id}-drawing`.length)}-${side}`,
        views,
      })),
    )

// default: 390 px light, and 308 Win. also dark (the colors of every part) and at 1280 px (the figure beside its table); full: the samples light and dark at 390 px, the verified records also at 1280 px
const shots = [
  ...common.flatMap(({ id, variant }) =>
    shotsOf(
      read(id),
      id === 'cip-308-win-2008-09-23'
        ? [
            [390, 'light'],
            [390, 'dark'],
            [1280, 'light'],
          ]
        : [[390, 'light']],
      variant,
    ),
  ),
  ...(full
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .map(readFile)
        .filter((r) => r.verification === 'verified' || samples.includes(r.id))
        .flatMap((r) =>
          shotsOf(
            r,
            (r.verification === 'verified' ? [390, 1280] : [390]).flatMap((w) =>
              (['light', 'dark'] as const).map((c): View => [w, c]),
            ),
          ),
        )
    : []),
]
const lost = [...common.map((c) => c.id), ...(full ? samples : [])].filter(
  (spec) => !shots.some((s) => s.spec === spec),
)
if (lost.length) throw new Error(`samples without a drawn side: ${lost.join(', ')}`)
/** Each test once: the full set repeats the shots of the default one. */
const tests = new Map(
  shots.flatMap(({ views, ...shot }) =>
    views.map(([width, colorScheme]) => {
      const at = width === 390 ? '' : ` ${width}`
      return [`${shot.name} ${colorScheme}${at}`, { ...shot, width, colorScheme, at }] as const
    }),
  ),
)

for (const [title, { cartridge, svg, name, variant, width, colorScheme, at }] of tests)
  test(title, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.emulateMedia({ colorScheme })
    await gotoHydrated(page, `/cartridges/${cartridge}`)
    const figure = page.locator(`svg[aria-labelledby="${svg}-title"]`)
    if (variant !== undefined) {
      await page.getByRole('combobox', { name: 'Variant' }).click()
      await page.getByRole('option', { name: variant, exact: true }).click()
      await expect(figure).toBeVisible()
    }
    // the default threshold 0.2 lets every pixel shift by about 52 gray levels (such as the page background behind the transparent figure); 0.04 lets it shift by about 10
    await expect(figure).toHaveScreenshot(`${name}-${colorScheme}${at.replace(' ', '-')}.png`, {
      maxDiffPixelRatio: 0.002,
      threshold: 0.04,
    })
  })
