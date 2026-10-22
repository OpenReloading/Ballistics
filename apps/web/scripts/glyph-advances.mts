// Writes packages/drawing/src/core/advances.json: the advance of each drawing character in the drawing font
// (src/app/fonts/Inter-Regular.woff2) in em, measured with canvas measureText in Chromium, kerning
// off as in the drawing CSS. Run after changing the font: node scripts/glyph-advances.mts
import { readFileSync, writeFileSync } from 'node:fs'
// biome-ignore lint/correctness/noUndeclaredDependencies: dev dependency of the e2e workspace, hoisted to the root
import { chromium } from '@playwright/test'

const font = new URL('../src/app/fonts/Inter-Regular.woff2', import.meta.url)
const out = new URL('../../../packages/drawing/src/core/advances.json', import.meta.url)
const characters = [
  ...Array.from({ length: 95 }, (_, k) => String.fromCharCode(32 + k)),
  '°', // degree
  'α', // alpha
  'β', // beta
  'δ', // delta
  '∅', // diameter sign (empty set glyph)
  '−', // minus
]

const browser = await chromium.launch()
const page = await browser.newPage()
const advances = await page.evaluate(
  async ({ bytes, characters }) => {
    const face = new FontFace('Drawing', new Uint8Array(bytes))
    document.fonts.add(await face.load())
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D
    ctx.font = '1000px Drawing'
    ctx.fontKerning = 'none'
    return Object.fromEntries(
      characters.map((c) => [c, Math.round(ctx.measureText(c).width * 10) / 10000]),
    )
  },
  { bytes: [...readFileSync(font)], characters },
)
await browser.close()
writeFileSync(out, `${JSON.stringify({ font: 'Inter 4.1 Regular', advances }, null, 2)}\n`)
console.log(`${Object.keys(advances).length} advances in ${out.pathname}`)
