import { globSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const head = `<meta name="robots" content="noindex"><style>.preview-label{position:fixed;left:0;bottom:0;z-index:2147483647;padding:1px 10px;border:1px solid #1a1a1a;border-left:0;border-bottom:0;background:#ffe08a;color:#1a1a1a;font:600 11px/1.5 system-ui,sans-serif;white-space:nowrap;pointer-events:none}@media print{.preview-label{display:none}}</style>`
const label =
  '<div class="preview-label" role="note">Development preview, not the released site</div>'

/**
 * Marks a built Pages site as the development preview: every `.html` file gets `noindex` and a
 * label fixed to the window's bottom left corner, which takes no room in the page (the workbench fills the
 * window without scrolling) and no clicks. The sitemaps are deleted. Gives the number of pages
 * marked and the sitemaps deleted, relative to `dir`; throws for a page without `<head>` or
 * `</body>`.
 */
export function markPreview(dir: string) {
  const pages = globSync('**/*.html', { cwd: dir })
  for (const page of pages) {
    const file = path.join(dir, page)
    const html = readFileSync(file, 'utf8')
    const open = /<head(\s[^>]*)?>/i.exec(html)
    const end = open ? html.indexOf('</head>', open.index) : -1
    // the last one: an earlier `</body>` can sit in an inline script
    const close = html.lastIndexOf('</body>')
    if (end < 0 || close < end) throw new Error(`${page}: no <head> or </body> to mark as preview`)
    // before `</head>`, so `<meta charset>` stays among the first bytes
    writeFileSync(
      file,
      `${html.slice(0, end)}${head}${html.slice(end, close)}${label}${html.slice(close)}`,
    )
  }
  const sitemaps = globSync('**/sitemap*.xml', { cwd: dir })
  for (const s of sitemaps) rmSync(path.join(dir, s))
  return { pages: pages.length, sitemaps }
}
