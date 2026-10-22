// Pairs the screenshots of two drawing runs by sheet id, theme and width (the note
// codes in the file names may differ) and tiles them before | after, 3 pairs by 6 per sheet:
// node scripts/pair-sheets.mts <before> <after> <out>, each a shots folder or a folder holding one
// <out>/<table>__<theme>__<width>__<n>.png; shots without a partner are listed, not drawn
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const [before, after, out] = process.argv.slice(2)
if (!out) {
  console.error('usage: node scripts/pair-sheets.mts <before> <after> <out>')
  process.exit(1)
}
const [columns, rows, tile] = [3, 6, 300]

/** Shots by key `<table>/<sheet id>__<theme>__<width>`. */
function shots(folder: string) {
  const root = existsSync(path.join(folder, 'shots')) ? path.join(folder, 'shots') : folder
  const found = new Map<string, string>()
  for (const table of readdirSync(root).sort())
    for (const name of readdirSync(path.join(root, table)).sort()) {
      if (!name.endsWith('.png')) continue
      const [stem, , theme, width] = name.slice(0, -'.png'.length).split('__')
      found.set(`${table}/${stem}__${theme}__${width}`, path.join(root, table, name))
    }
  return found
}

const [a, b] = [shots(before), shots(after)]
const groups = new Map<string, { stem: string; files: [string, string] }[]>()
for (const [key, file] of a) {
  const other = b.get(key)
  if (!other) continue
  const [table, rest] = key.split('/')
  const [stem, theme, width] = rest.split('__')
  const group = `${table}__${theme}__${width}`
  groups.set(group, [...(groups.get(group) ?? []), { stem, files: [file, other] }])
}
const unpaired = [...a.keys()].filter((k) => !b.has(k)).map((k) => `before only: ${k}`)
unpaired.push(...[...b.keys()].filter((k) => !a.has(k)).map((k) => `after only: ${k}`))

mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: columns * (2 * tile + 16) + 8, height: 600 },
})
const image = (file: string) =>
  `<img src="data:image/png;base64,${readFileSync(file).toString('base64')}">`
let made = 0
for (const [group, pairs] of groups) {
  const total = Math.ceil(pairs.length / (columns * rows))
  for (let n = 0; n < total; n++) {
    const tiles = pairs
      .slice(n * columns * rows, (n + 1) * columns * rows)
      .map(
        ({ stem, files: [x, y] }) =>
          `<figure><div>${image(x)}${image(y)}</div><figcaption>${stem}: before | after</figcaption></figure>`,
      )
    await page.setContent(`<!doctype html><style>
body { margin: 0; padding: 8px; background: #777; font: 13px/1.3 sans-serif }
h1 { margin: 0 0 8px; font-size: 16px; color: #fff }
main { display: grid; grid-template-columns: repeat(${columns}, ${2 * tile + 8}px); gap: 8px; align-items: start }
figure { margin: 0; background: #fff }
div { display: grid; grid-template-columns: ${tile}px ${tile}px; gap: 8px; align-items: start }
img { display: block; width: 100% }
figcaption { padding: 2px 4px; overflow-wrap: anywhere }
</style><h1>${group.replaceAll('__', ', ')} px: sheet ${n + 1} of ${total}, ${pairs.length} pairs</h1><main>${tiles.join('')}</main>`)
    await page.screenshot({
      path: path.join(out, `${group}__${String(n + 1).padStart(2, '0')}.png`),
      fullPage: true,
    })
    made++
  }
}
await browser.close()
for (const line of unpaired) console.log(line)
console.log(`${made} paired sheets in ${out}, ${unpaired.length} shots without a partner`)
