import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, expect, it } from 'vitest'
import { markPreview } from '../src/pages-preview.ts'

const dir = mkdtempSync(path.join(tmpdir(), 'pages-preview-'))
afterAll(() => rmSync(dir, { recursive: true }))
const page = (script = '') =>
  `<!DOCTYPE html><html><head lang="en"><meta charSet="utf-8"/><title>x</title><script>"</head>"</script></head><body><main>x</main>${script}</body></html>`
mkdirSync(path.join(dir, 'docs'), { recursive: true })
writeFileSync(path.join(dir, 'index.html'), page('<script>"</body>"</script>'))
writeFileSync(path.join(dir, 'docs', 'index.html'), page())
writeFileSync(path.join(dir, 'docs', 'sitemap.xml'), '<urlset/>')
writeFileSync(path.join(dir, 'index.txt'), '</body>')

it('marks every page with noindex in its head and one label before the last </body>', () => {
  expect(markPreview(dir)).toEqual({ pages: 2, sitemaps: ['docs/sitemap.xml'] })
  for (const f of ['index.html', 'docs/index.html']) {
    const html = readFileSync(path.join(dir, f), 'utf8')
    // after the charset, and the text `</head>` of a script is left alone
    expect(html).toMatch(
      /<meta charSet="utf-8"\/><meta name="robots" content="noindex"><style>.*<\/style><title>/,
    )
    expect(html).toContain('<script>"</head>"</script></head>')
    expect(html.match(/class="preview-label"/g)).toHaveLength(1)
    expect(html).toMatch(/Development preview, not the released site<\/div><\/body><\/html>$/)
  }
  // an inline script's text is left alone, other files too, and the sitemap is gone
  expect(readFileSync(path.join(dir, 'index.html'), 'utf8')).toContain('<script>"</body>"</script>')
  expect(readFileSync(path.join(dir, 'index.txt'), 'utf8')).toBe('</body>')
  expect(readdirSync(path.join(dir, 'docs'))).toEqual(['index.html'])
})

it('refuses a page it cannot mark', () => {
  writeFileSync(path.join(dir, 'bare.html'), '<p>x</p>')
  expect(() => markPreview(dir)).toThrow('bare.html')
})
