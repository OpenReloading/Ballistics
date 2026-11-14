import assert from 'node:assert/strict'
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
    assert.match(pkg, new RegExp(`^@rangefoundry/${name}$`))
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
}
