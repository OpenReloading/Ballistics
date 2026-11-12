import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const docs = fileURLToPath(new URL('../', import.meta.url))
const root = fileURLToPath(new URL('../../../', import.meta.url))
// the page keeps its file name and URL when the package is renamed
const libraries = [
  { page: 'schema', name: 'schema' },
  { page: 'drawing', name: 'svg-drawings' },
  { page: 'importers', name: 'importers' },
  { page: 'catalog', name: 'catalog' },
]

for (const { page: pageName, name } of libraries) {
  const page = readFileSync(`${docs}docs/libraries/${pageName}.md`, 'utf8')

  test(`${name}: install line, entry points, reference link and homepage`, () => {
    const manifest = JSON.parse(readFileSync(`${root}packages/${name}/package.json`, 'utf8'))
    const pkg: string = manifest.name
    // either scope while the packages move to @rangefoundry
    assert.match(pkg, new RegExp(`^@(open-reloading|rangefoundry)/${name}$`))
    assert.match(page, new RegExp(`\`\`\`sh\\nnpm install ${pkg}\\n\`\`\``))
    // a table cell, padded to its column's width
    const cell = (path: string) =>
      new RegExp(`\\| \`${path.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\` +\\|`)
    for (const entry of Object.keys(manifest.exports))
      assert.match(page, cell(`${pkg}${entry.slice(1)}`), `entry point ${entry} not listed`)
    assert.ok(
      page.includes(`(pathname:///library/modules/_${pkg.slice(1).replace('/', '_')}.html)`),
    )
    assert.equal(
      manifest.homepage,
      `https://openreloading.github.io/Ballistics/docs/libraries/${pageName}/`,
    )
  })

  // the example runs from apps/docs, where the workspace packages resolve to their dist/
  test(`${name}: the example prints what its comments say`, () => {
    const example = page.match(/^## Example\n[\s\S]*?```js\n([\s\S]*?)```/m)?.[1]
    assert.ok(example, 'no js block under ## Example')
    const expected = [...example.matchAll(/^console\.log\(.*\) \/\/ (.*)$/gm)].map((m) => m[1])
    assert.ok(expected.length > 0, 'no console.log line with its output')
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', example], {
      cwd: docs,
      encoding: 'utf8',
    })
    assert.deepEqual(out.trimEnd().split('\n'), expected)
  })
}
