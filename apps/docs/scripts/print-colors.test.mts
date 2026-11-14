import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const require = createRequire(import.meta.url)
// Infima comes with the classic theme, not as a dependency of this site
const infima = createRequire(require.resolve('@docusaurus/theme-classic')).resolve(
  'infima/dist/css/default/default.css',
)

type Rule = { selectors: string[]; declarations: Map<string, string>; print: boolean }

/** The rules of `css` with their custom properties; nested only one level, as in these files. */
function rules(css: string): Rule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const found: Rule[] = []
  let print = false
  let depth = 0
  for (const match of text.matchAll(/([^{}]*)([{}])/g)) {
    const [, head = '', brace] = match
    if (brace === '}') {
      depth = Math.max(0, depth - 1)
      if (depth === 0) print = false
      continue
    }
    const selector = head.trim()
    if (selector.startsWith('@')) {
      print = selector.replace(/\s+/g, ' ') === '@media print'
      depth++
      continue
    }
    const end = text.indexOf('}', match.index + match[0].length)
    const body = text.slice(match.index + match[0].length, end)
    const declarations = new Map<string, string>()
    for (const [, name = '', value = ''] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g))
      declarations.set(name, value.trim().replace(/\s+/g, ' '))
    found.push({ selectors: selector.split(',').map((s) => s.trim()), declarations, print })
    depth++
  }
  return found
}

const declared = (list: Rule[], match: (rule: Rule) => boolean) =>
  new Map(list.filter(match).flatMap((rule) => [...rule.declarations]))

test("a page printed with the dark theme on keeps none of Infima's dark values", () => {
  const theme = rules(readFileSync(infima, 'utf8'))
  const ours = rules(
    readFileSync(require.resolve('@rangefoundry/design-tokens/docusaurus.css'), 'utf8'),
  )
  const light = declared(theme, (r) => r.selectors.includes(':root'))
  const dark = declared(theme, (r) => r.selectors.includes("html[data-theme='dark']"))
  const mapped = declared(ours, (r) => !r.print && r.selectors.includes(':root[data-theme]'))
  const printed = declared(ours, (r) => r.print && r.selectors.includes(':root[data-theme="dark"]'))
  assert.ok(dark.size > 10, 'no dark rule found in Infima')
  for (const name of dark.keys()) {
    // the mapping on the token variables is light in print already (tokens.css)
    if (mapped.has(name)) continue
    assert.equal(printed.get(name), light.get(name) ?? 'none', name)
  }
})
